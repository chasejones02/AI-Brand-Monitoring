import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'

const router = Router()

// GET /api/quota
// Returns the caller's current scan quota window — used by the dashboard pill.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!

  const setId = typeof req.query.setId === 'string' ? req.query.setId : null

  const { data, error } = await supabase
    .rpc('get_scan_quota_status', {
      p_user_id: userId,
      ...(setId ? { p_tracking_set_id: setId } : {}),
    })

  const row = Array.isArray(data) ? data[0] : data

  if (error || !row) {
    // Log the underlying Postgres error — without this, RPC failures (e.g. an
    // ambiguous-overload "function is not unique") surface only as the generic
    // client message and are impossible to diagnose.
    console.error('get_scan_quota_status RPC failed:', error ?? 'no row returned', { userId, setId })
    res.status(500).json({ data: null, error: 'Failed to fetch quota' })
    return
  }

  res.json({
    data: {
      tier: row.tier,
      daily_limit: row.daily_limit,
      used_in_window: row.used_in_window,
      remaining: row.remaining,
      next_reset_at: row.next_reset_at,
    },
    error: null,
  })
})

export default router
