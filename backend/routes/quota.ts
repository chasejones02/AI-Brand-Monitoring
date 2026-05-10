import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'

const router = Router()

// GET /api/quota
// Returns the caller's current scan quota window — used by the dashboard pill.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!

  const { data, error } = await supabase
    .rpc('get_scan_quota_status', { p_user_id: userId })

  const row = Array.isArray(data) ? data[0] : data

  if (error || !row) {
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
