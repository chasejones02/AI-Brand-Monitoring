import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, requireSubscription } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { runQueryOnPlatforms, getAvailablePlatforms, analyzeMention } from '../services/queryEngine.js'
import { scoreResult, calculateVisibilityScore } from '../services/scorer.js'

const router = Router()

const ScanRequestSchema = z.object({
  business_id: z.string().uuid(),
})

// POST /api/scan
// Triggers a full scan for a business across all configured AI platforms
router.post('/', requireAuth, requireSubscription, async (req: Request, res: Response): Promise<void> => {
  const parsed = ScanRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const { business_id } = parsed.data
  const userId = req.userId!

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

  // Return the scan ID immediately so frontend can poll
  res.status(202).json({ data: { scan_id: scan.id }, error: null })

  // Run the scan asynchronously (fire and forget)
  runScan(scan.id, business.name, queries).catch(err => {
    console.error(`Scan ${scan.id} failed:`, err)
  })
})

async function runScan(
  scanId: string,
  businessName: string,
  queries: { id: string; query_text: string }[]
) {
  const platforms = getAvailablePlatforms()

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

      const analysis = await analyzeMention(pr.raw_response, businessName)
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
}

export default router
