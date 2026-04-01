import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { runQueryOnPlatforms, getAvailablePlatforms, analyzeMention } from '../services/queryEngine.js'
import { scoreResult, calculateVisibilityScore } from '../services/scorer.js'

const router = Router()

const ScanRequestSchema = z.object({
  business_id: z.string().uuid(),
})

// POST /api/scan
// Triggers a full scan for a business across all configured AI platforms
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = ScanRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const { business_id } = parsed.data
  const userId = req.userId!

  // Check subscription — free users get one scan, active subscribers get unlimited
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single()

  if (profile?.subscription_status !== 'active') {
    // Count all completed/running scans across all this user's businesses
    const { data: userBusinesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)

    const businessIds = (userBusinesses ?? []).map((b: { id: string }) => b.id)

    let priorScanCount = 0
    if (businessIds.length > 0) {
      const { count } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .in('business_id', businessIds)
        .in('status', ['completed', 'running'])
      priorScanCount = count ?? 0
    }

    if (priorScanCount >= 1) {
      res.status(403).json({
        data: null,
        error: 'Active subscription required',
        code: 'subscription_required',
      })
      return
    }
  }

  // Verify the business belongs to this user
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', business_id)
    .eq('user_id', userId)
    .single()

  if (bizError || !business) {
    res.status(404).json({ data: null, error: 'Business not found' })
    return
  }

  // Load queries for this business
  const { data: queries, error: queryError } = await supabase
    .from('queries')
    .select('id, query_text')
    .eq('business_id', business_id)
    .eq('is_active', true)

  if (queryError || !queries?.length) {
    res.status(400).json({ data: null, error: 'No active queries found for this business' })
    return
  }

  // Create a scan record
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({ business_id, status: 'running', triggered_by: 'manual' })
    .select()
    .single()

  if (scanError || !scan) {
    res.status(500).json({ data: null, error: 'Failed to create scan' })
    return
  }

  const isFree = profile?.subscription_status !== 'active'

  // Return the scan ID immediately so frontend can poll
  res.status(202).json({ data: { scan_id: scan.id }, error: null })

  // Run the scan asynchronously (fire and forget)
  runScan(scan.id, business.name, queries, isFree).catch(err => {
    console.error(`Scan ${scan.id} failed:`, err)
  })
})

async function runScan(
  scanId: string,
  businessName: string,
  queries: { id: string; query_text: string }[],
  isFree: boolean = false
) {
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

  for (const query of queries) {
    const platformResults = await runQueryOnPlatforms(query.query_text, platforms)

    for (const pr of platformResults) {
      if (pr.error) {
        console.warn(`Platform ${pr.platform} error for query ${query.id}:`, pr.error)
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
        competitors_mentioned: [],
      })

      allResults.push({
        scan_id: scanId,
        query_id: query.id,
        platform: pr.platform,
        raw_response: pr.raw_response,
        mentioned: analysis.mentioned,
        mention_position: analysis.position_index,
        sentiment: analysis.sentiment,
        competitors_mentioned: [],
        ...scores,
      })
    }
  }

  // Insert all results
  if (allResults.length > 0) {
    await supabase.from('scan_results').insert(allResults)
  }

  // Calculate overall visibility score
  const visibility_score = calculateVisibilityScore(allResults)

  // Mark scan complete
  await supabase
    .from('scans')
    .update({
      status: 'completed',
      visibility_score,
      completed_at: new Date().toISOString(),
    })
    .eq('id', scanId)
  } catch (err) {
    console.error(`Scan ${scanId} unhandled error:`, err)
    await supabase
      .from('scans')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', scanId)
  }
}

export default router
