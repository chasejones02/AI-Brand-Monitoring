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

// GET /api/results/business/:businessId/trends
// Returns time-series data across the last N completed scans for a business:
//   - scans:        overall visibility score per scan (chronological)
//   - by_platform:  per-platform 0-100 scores per scan
//   - by_query:     per-query trend points (mentioned, position, total)
router.get('/business/:businessId/trends', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { businessId } = req.params
  const userId = req.userId!
  const limit = Math.min(parseInt(String(req.query.limit ?? '30'), 10) || 30, 30)

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

  // Pull the last N completed scans (most recent first), then reverse
  // server-side so the frontend gets oldest-to-newest for trend rendering.
  const { data: rawScans, error: scansError } = await supabase
    .from('scans')
    .select('id, visibility_score, started_at, completed_at')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (scansError) {
    res.status(500).json({ data: null, error: 'Failed to fetch scans' })
    return
  }

  const scans = (rawScans ?? []).slice().reverse()
  const scanIds = scans.map(s => s.id)

  if (scanIds.length === 0) {
    res.json({
      data: { scans: [], by_platform: {}, by_query: [] },
      error: null,
    })
    return
  }

  const { data: results, error: resultsError } = await supabase
    .from('scan_results')
    .select(`
      scan_id, platform, mentioned, mention_position,
      mention_score, position_score, sentiment_score,
      queries!inner(id, query_text)
    `)
    .in('scan_id', scanIds)

  if (resultsError) {
    res.status(500).json({ data: null, error: 'Failed to fetch result trends' })
    return
  }

  // Per-platform scores: average normalized score per platform per scan.
  const platformBuckets: Record<string, Record<string, { sum: number; count: number }>> = {}
  // Per-query points keyed by query_id, then by scan_id.
  const queryBuckets: Record<
    string,
    {
      query_id: string
      query_text: string
      points: Record<string, { mentioned: boolean; mention_position: number | null; total_score: number }>
    }
  > = {}

  for (const r of results ?? []) {
    const total = (r.mention_score ?? 0) + (r.position_score ?? 0) + (r.sentiment_score ?? 0)
    const normalized = (total / 18) * 100

    if (!platformBuckets[r.platform]) platformBuckets[r.platform] = {}
    if (!platformBuckets[r.platform][r.scan_id]) {
      platformBuckets[r.platform][r.scan_id] = { sum: 0, count: 0 }
    }
    platformBuckets[r.platform][r.scan_id].sum += normalized
    platformBuckets[r.platform][r.scan_id].count += 1

    const query = (r as any).queries
    if (!queryBuckets[query.id]) {
      queryBuckets[query.id] = { query_id: query.id, query_text: query.query_text, points: {} }
    }
    // For per-query points we collapse all platforms into one line; if the
    // same query was scanned on multiple platforms we keep the best mention
    // position and OR mentioned together.
    const existing = queryBuckets[query.id].points[r.scan_id]
    if (existing) {
      existing.mentioned = existing.mentioned || !!r.mentioned
      if (
        r.mention_position != null &&
        (existing.mention_position == null || r.mention_position < existing.mention_position)
      ) {
        existing.mention_position = r.mention_position
      }
      existing.total_score = Math.max(existing.total_score, total)
    } else {
      queryBuckets[query.id].points[r.scan_id] = {
        mentioned: !!r.mentioned,
        mention_position: r.mention_position,
        total_score: total,
      }
    }
  }

  const by_platform: Record<string, { scan_id: string; score: number }[]> = {}
  for (const platform of Object.keys(platformBuckets)) {
    by_platform[platform] = scanIds.map(scanId => {
      const bucket = platformBuckets[platform][scanId]
      return {
        scan_id: scanId,
        score: bucket ? bucket.sum / bucket.count : 0,
      }
    })
  }

  const by_query = Object.values(queryBuckets).map(q => ({
    query_id: q.query_id,
    query_text: q.query_text,
    points: scanIds.map(scanId => {
      const p = q.points[scanId]
      return {
        scan_id: scanId,
        mentioned: p?.mentioned ?? false,
        mention_position: p?.mention_position ?? null,
        total_score: p?.total_score ?? 0,
      }
    }),
  }))

  res.json({
    data: {
      scans: scans.map(s => ({
        scan_id: s.id,
        visibility_score: s.visibility_score,
        completed_at: s.completed_at,
        started_at: s.started_at,
      })),
      by_platform,
      by_query,
    },
    error: null,
  })
})

export default router
