import { Router, Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { runQueryOnPlatforms, getAvailablePlatforms, analyzeMention } from '../services/queryEngine.js'
import { scoreResult, calculateVisibilityScore } from '../services/scorer.js'
import { generateRecommendations } from '../services/recommendationEngine.js'

const router = Router()

const ScanRequestSchema = z.object({
  business_id: z.string().uuid(),
  tracking_set_id: z.string().uuid().optional(),
})

// POST /api/scan
// Triggers a full scan for a business across all configured AI platforms.
// Caller specifies which tracking set to scan against; defaults to slot 1.
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = ScanRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const { business_id, tracking_set_id } = parsed.data
  const userId = req.userId!

  // Check subscription — free users get one scan, active subscribers get unlimited
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single()

  // Verify the business belongs to this user
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, location')
    .eq('id', business_id)
    .eq('user_id', userId)
    .single()

  if (bizError || !business) {
    res.status(404).json({ data: null, error: 'Business not found' })
    return
  }

  // Resolve the target tracking set so we know which queries to scan.
  // The RPC also validates this, but we need the set_id here to load queries.
  let targetSetId: string | null = tracking_set_id ?? null
  if (!targetSetId) {
    const { data: defaultSet } = await supabase
      .from('tracking_sets')
      .select('id')
      .eq('business_id', business_id)
      .order('slot_number', { ascending: true })
      .limit(1)
      .maybeSingle()
    targetSetId = defaultSet?.id ?? null
  }

  if (!targetSetId) {
    res.status(400).json({ data: null, error: 'No tracking set found for this business' })
    return
  }

  // Load queries belonging to the target tracking set.
  const { data: queries, error: queryError } = await supabase
    .from('queries')
    .select('id, query_text')
    .eq('tracking_set_id', targetSetId)
    .eq('is_active', true)

  if (queryError || !queries?.length) {
    res.status(400).json({ data: null, error: 'No active queries found for this tracking set' })
    return
  }

  // Create a scan record atomically with tier-aware quota enforcement.
  const { data: scanCreateRows, error: scanError } = await supabase
    .rpc('create_scan_if_allowed', {
      p_business_id: business_id,
      p_user_id: userId,
      p_tracking_set_id: targetSetId,
    })

  const scanCreate = Array.isArray(scanCreateRows) ? scanCreateRows[0] : null

  if (scanError || !scanCreate) {
    res.status(500).json({ data: null, error: 'Failed to create scan' })
    return
  }

  if (!scanCreate.allowed) {
    if (scanCreate.reason === 'subscription_required') {
      res.status(403).json({
        data: null,
        error: 'Active subscription required',
        code: 'subscription_required',
      })
      return
    }
    if (scanCreate.reason === 'daily_quota_exceeded') {
      const { data: quotaRows } = await supabase
        .rpc('get_scan_quota_status', { p_user_id: userId })
      const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows
      res.status(403).json({
        data: null,
        error: 'Daily scan limit reached',
        code: 'daily_quota_exceeded',
        next_reset_at: quota?.next_reset_at ?? null,
      })
      return
    }
    res.status(404).json({ data: null, error: 'Business not found' })
    return
  }

  const isFree = profile?.subscription_status !== 'active'

  // Return the scan ID immediately so frontend can poll
  res.status(202).json({ data: { scan_id: scanCreate.scan_id }, error: null })

  // Run the scan asynchronously (fire and forget).
  // The HTTP response has already been sent, so any error here is invisible
  // to the user — Sentry is the only way we'll know it happened.
  runScan(scanCreate.scan_id, business.name, business.location, queries, isFree).catch(err => {
    console.error(`Scan ${scanCreate.scan_id} failed:`, err)
    Sentry.captureException(err, {
      tags: { area: 'scan_runner', scan_id: scanCreate.scan_id },
      user: { id: userId },
    })
  })
})

async function runScan(
  scanId: string,
  businessName: string,
  businessLocation: string | null,
  queries: { id: string; query_text: string }[],
  isFree: boolean = false
) {
  const timeout = setTimeout(async () => {
    console.error(`Scan ${scanId} timed out after 5 minutes`)
    Sentry.captureMessage(`Scan timed out after 5 minutes`, {
      level: 'warning',
      tags: { area: 'scan_runner', scan_id: scanId, reason: 'timeout' },
    })
    await supabase
      .from('scans')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', scanId)
  }, 5 * 60 * 1000)

  try {
  let platforms = getAvailablePlatforms()

  // Free scans use Perplexity only — it has real-time web search, which is
  // essential for finding small/local businesses. OpenAI has no web access and
  // will almost never mention a business not in its training data, which would
  // unfairly drag down the score. Fall back to all platforms if Perplexity
  // isn't configured.
  if (isFree) {
    const perplexityOnly = platforms.filter(p => p === 'perplexity')
    if (perplexityOnly.length > 0) platforms = perplexityOnly
  }

  if (platforms.length === 0) {
    await supabase
      .from('scans')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', scanId)
    return
  }

  const allResults: any[] = []
  const platformErrors: Record<string, string> = {}

  for (const query of queries) {
    const platformResults = await runQueryOnPlatforms(query.query_text, platforms, {
      location: businessLocation,
    })

    for (const pr of platformResults) {
      if (pr.error) {
        console.warn(`Platform ${pr.platform} error for query ${query.id}:`, pr.error)
        platformErrors[pr.platform] = pr.error
        continue
      }

      if (!pr.raw_response.trim()) {
        console.warn(`Platform ${pr.platform} returned empty response for query ${query.id}`)
        continue
      }

      const analysis = await analyzeMention(pr.raw_response, businessName)
      console.log(`[scan ${scanId}] ${pr.platform} | query "${query.query_text.slice(0, 60)}" | mentioned=${analysis.mentioned} variant="${analysis.variant_used}" pos=${analysis.position_index} sentiment=${analysis.sentiment}`)

      const scores = scoreResult({
        mentioned: analysis.mentioned,
        mention_position: analysis.position_index,
        sentiment: analysis.sentiment,
        competitors_mentioned: analysis.competitors_mentioned,
      })

      allResults.push({
        scan_id: scanId,
        query_id: query.id,
        platform: pr.platform,
        raw_response: pr.raw_response,
        mentioned: analysis.mentioned,
        mention_position: analysis.position_index,
        sentiment: analysis.sentiment,
        competitors_mentioned: analysis.competitors_mentioned,
        variant_used: analysis.variant_used ?? null,
        ...scores,
      })
    }
  }

  // Insert all results
  if (allResults.length > 0) {
    await supabase.from('scan_results').insert(allResults)
  }

  if (allResults.length === 0) {
    console.error(`Scan ${scanId} produced no usable platform results`, platformErrors)
    await supabase
      .from('scans')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', scanId)
    return
  }

  // Calculate overall visibility score
  const visibility_score = calculateVisibilityScore(allResults)

  // Generate recommendations (non-fatal — scan completes even if this fails)
  let recommendations: object[] = []
  try {
    const recInputs = allResults.map(r => ({
      query_text: queries.find(q => q.id === r.query_id)?.query_text ?? '',
      platform: r.platform,
      mentioned: r.mentioned,
      mention_position: r.mention_position,
      sentiment: r.sentiment,
      competitors_mentioned: r.competitors_mentioned ?? [],
    }))
    recommendations = await generateRecommendations(businessName, recInputs, visibility_score)
    console.log(`[scan ${scanId}] generated ${recommendations.length} recommendations`)
  } catch (err) {
    console.error(`[scan ${scanId}] recommendation generation failed (non-fatal):`, err)
    Sentry.captureException(err, {
      level: 'warning',
      tags: { area: 'recommendation_engine', scan_id: scanId },
    })
  }

  // Mark scan complete
  clearTimeout(timeout)
  await supabase
    .from('scans')
    .update({
      status: 'completed',
      visibility_score,
      recommendations: recommendations.length > 0 ? recommendations : null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', scanId)
  } catch (err) {
    clearTimeout(timeout)
    console.error(`Scan ${scanId} unhandled error:`, err)
    Sentry.captureException(err, {
      tags: { area: 'scan_runner', scan_id: scanId },
    })
    await supabase
      .from('scans')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', scanId)
  }
}

export default router
