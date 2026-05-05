import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'

const router = Router()

// GET /api/results/:scanId
// Returns full scan results including per-platform, per-query breakdown
router.get('/:scanId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { scanId } = req.params
  const userId = req.userId!

  // Fetch scan and verify ownership via business
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select(`
      id, status, visibility_score, triggered_by, started_at, completed_at,
      businesses!inner(id, name, user_id)
    `)
    .eq('id', scanId)
    .single()

  if (scanError || !scan) {
    res.status(404).json({ data: null, error: 'Scan not found' })
    return
  }

  const business = (scan as any).businesses
  if (business.user_id !== userId) {
    res.status(403).json({ data: null, error: 'Forbidden' })
    return
  }

  // If still running, return status only
  if (scan.status === 'running' || scan.status === 'pending') {
    res.json({
      data: {
        scan_id: scan.id,
        status: scan.status,
        visibility_score: null,
        results: [],
      },
      error: null,
    })
    return
  }

  // Fetch all results with query text
  const { data: results, error: resultsError } = await supabase
    .from('scan_results')
    .select(`
      id, platform, raw_response, mentioned, mention_position, sentiment,
      competitors_mentioned, mention_score, position_score, sentiment_score,
      queries!inner(id, query_text, source, intent, generation_reason)
    `)
    .eq('scan_id', scanId)
    .order('created_at', { ascending: true })

  if (resultsError) {
    res.status(500).json({ data: null, error: 'Failed to fetch results' })
    return
  }

  // Group results by query for easier frontend consumption
  const byQuery: Record<string, any> = {}
  for (const r of results ?? []) {
    const query = (r as any).queries
    if (!byQuery[query.id]) {
      byQuery[query.id] = {
        query_id: query.id,
        query_text: query.query_text,
        source: query.source,
        intent: query.intent,
        generation_reason: query.generation_reason,
        platforms: {},
      }
    }
    byQuery[query.id].platforms[r.platform] = {
      mentioned: r.mentioned,
      mention_position: r.mention_position,
      sentiment: r.sentiment,
      competitors_mentioned: r.competitors_mentioned,
      raw_response: r.raw_response,
      scores: {
        mention: r.mention_score,
        position: r.position_score,
        sentiment: r.sentiment_score,
        total: r.mention_score + r.position_score + r.sentiment_score,
        max: 18,
      },
    }
  }

  const scoreDetails = buildScoreDetails(results ?? [])

  res.json({
    data: {
      scan_id: scan.id,
      status: scan.status,
      visibility_score: scan.visibility_score,
      business_name: business.name,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      score_details: scoreDetails,
      results: Object.values(byQuery),
    },
    error: null,
  })
})

function buildScoreDetails(results: any[]) {
  const max_per_result = 18
  const result_count = results.length
  const mentioned_results = results.filter(r => r.mentioned).length
  const max_points = result_count * max_per_result
  const mention_points = results.reduce((sum, r) => sum + (r.mention_score ?? 0), 0)
  const position_points = results.reduce((sum, r) => sum + (r.position_score ?? 0), 0)
  const sentiment_points = results.reduce((sum, r) => sum + (r.sentiment_score ?? 0), 0)
  const earned_points = mention_points + position_points + sentiment_points
  const sentiment_counts = results.reduce(
    (counts, r) => {
      if (r.sentiment === 'positive') counts.positive += 1
      else if (r.sentiment === 'negative') counts.negative += 1
      else if (r.sentiment === 'neutral') counts.neutral += 1
      return counts
    },
    { positive: 0, neutral: 0, negative: 0 }
  )

  return {
    formula_version: 'v1',
    formula:
      'AI Visibility Score = earned points / max points * 100. Each query/platform result can earn 10 mention points, up to 5 position points, and up to 3 sentiment points.',
    result_count,
    mentioned_results,
    sentiment_counts,
    max_per_result,
    max_points,
    earned_points,
    mention_points,
    position_points,
    sentiment_points,
  }
}

// GET /api/results/business/:businessId
// Returns all scans for a business (history)
router.get('/business/:businessId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { businessId } = req.params
  const userId = req.userId!

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .eq('user_id', userId)
    .single()

  if (bizError || !business) {
    res.status(404).json({ data: null, error: 'Business not found' })
    return
  }

  const { data: scans, error: scansError } = await supabase
    .from('scans')
    .select('id, status, visibility_score, triggered_by, started_at, completed_at')
    .eq('business_id', businessId)
    .order('started_at', { ascending: false })
    .limit(20)

  if (scansError) {
    res.status(500).json({ data: null, error: 'Failed to fetch scans' })
    return
  }

  res.json({ data: { business, scans: scans ?? [] }, error: null })
})

export default router
