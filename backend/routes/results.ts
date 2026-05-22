import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { TIER_REC_LIMITS, type Recommendation } from '../services/recommendationEngine.js'

const router = Router()

async function loadUserTier(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_tier')
    .eq('id', userId)
    .single()
  if (data?.subscription_status === 'active' && data.subscription_tier) return data.subscription_tier
  return 'free'
}

function gateRecommendations(recs: Recommendation[], tier: string) {
  const limit = TIER_REC_LIMITS[tier] ?? 1
  return recs.map(r => r.priority <= limit
    ? r
    : { priority: r.priority, title: r.title, body: null, impact: r.impact, platform: r.platform, locked: true }
  )
}

// GET /api/results/:scanId
// Returns full scan results including per-platform, per-query breakdown
router.get('/:scanId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { scanId } = req.params
  const userId = req.userId!

  // Fetch scan and verify ownership via business
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select(`
      id, status, visibility_score, triggered_by, started_at, completed_at, tracking_set_id, recommendations,
      businesses!inner(id, name, user_id),
      tracking_sets(slot_number, name)
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
      competitors_mentioned, variant_used, citations,
      mention_score, position_score, sentiment_score,
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
      variant_used: r.variant_used ?? null,
      citations: Array.isArray((r as any).citations) ? (r as any).citations : null,
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

  const tier = await loadUserTier(userId)
  const rawRecs: Recommendation[] = Array.isArray((scan as any).recommendations)
    ? (scan as any).recommendations
    : []
  const recommendations = gateRecommendations(rawRecs, tier)

  const setMeta = (scan as any).tracking_sets
  res.json({
    data: {
      scan_id: scan.id,
      status: scan.status,
      visibility_score: scan.visibility_score,
      business_name: business.name,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      score_details: scoreDetails,
      tracking_set_id: scan.tracking_set_id ?? null,
      tracking_set_slot: setMeta?.slot_number ?? null,
      tracking_set_name: setMeta?.name ?? null,
      results: Object.values(byQuery),
      recommendations,
      tier,
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
    formula_version: 'v2',
    formula:
      'AI Visibility Score = earned points / max points * 100. Each query/platform result can earn 10 mention points, up to 5 position points (smooth log decay — #1 scores 5, #2 ≈ 3.15, #3 ≈ 2.50, dropping off toward 1 as position increases), and up to 3 sentiment points.',
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
// Returns scans for a business (history). Filterable by tracking set:
//   GET /api/results/business/:id              → all scans
//   GET /api/results/business/:id?set_id=UUID  → just that set's scans
router.get('/business/:businessId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { businessId } = req.params
  const userId = req.userId!
  const setId = typeof req.query.set_id === 'string' ? req.query.set_id : null

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

  let q = supabase
    .from('scans')
    .select('id, status, visibility_score, triggered_by, started_at, completed_at, tracking_set_id')
    .eq('business_id', businessId)
    .order('started_at', { ascending: false })
    .limit(20)
  if (setId) q = q.eq('tracking_set_id', setId)

  const { data: scans, error: scansError } = await q

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
  const setId = typeof req.query.set_id === 'string' ? req.query.set_id : null

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
  // Filter to a single tracking set when ?set_id= is supplied — that's the
  // apples-to-apples comparison the dashboard renders by default.
  let scanQuery = supabase
    .from('scans')
    .select('id, visibility_score, started_at, completed_at, tracking_set_id')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (setId) scanQuery = scanQuery.eq('tracking_set_id', setId)
  const { data: rawScans, error: scansError } = await scanQuery

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
        tracking_set_id: s.tracking_set_id ?? null,
      })),
      by_platform,
      by_query,
    },
    error: null,
  })
})

export default router
