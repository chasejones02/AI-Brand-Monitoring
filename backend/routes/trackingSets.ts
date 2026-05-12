import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { supabase, TIER_SET_LIMITS } from '../services/supabase.js'

const router = Router()

// Per-business tracking-set CRUD. The actual scan-trigger lives in
// routes/scan.ts — this router only handles the set lifecycle.

const NameSchema = z.string().min(1).max(60)
const QueryListSchema = z.array(z.string().min(3).max(500)).min(1).max(5)

function decorateLockStatus<
  T extends { locked_until: string | null; first_scanned_at: string | null }
>(set: T) {
  const now = Date.now()
  const lockedUntilMs = set.locked_until ? new Date(set.locked_until).getTime() : 0
  const isLocked = lockedUntilMs > now
  return {
    ...set,
    is_locked: isLocked,
    days_until_unlock: isLocked
      ? Math.ceil((lockedUntilMs - now) / (1000 * 60 * 60 * 24))
      : 0,
  }
}

async function loadUserTier(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_tier')
    .eq('id', userId)
    .single()
  if (data?.subscription_status === 'active' && data.subscription_tier) {
    return data.subscription_tier
  }
  return 'free'
}

async function assertOwnership(businessId: string, userId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .single()
  return !error && !!data
}

// GET /api/business/:businessId/tracking-sets
//
// Returns all sets for the business, each with its queries inlined and a
// computed lock status. The frontend uses this to render set tabs and the
// query editor.
router.get(
  '/business/:businessId/tracking-sets',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const businessId = req.params.businessId as string
    const userId = req.userId!

    if (!(await assertOwnership(businessId, userId))) {
      res.status(404).json({ data: null, error: 'Business not found' })
      return
    }

    const { data: sets, error } = await supabase
      .from('tracking_sets')
      .select(`
        id, slot_number, name, first_scanned_at, locked_until, created_at,
        queries(id, query_text, source, intent, generation_reason, is_active)
      `)
      .eq('business_id', businessId)
      .order('slot_number', { ascending: true })

    if (error) {
      res.status(500).json({ data: null, error: 'Failed to load tracking sets' })
      return
    }

    const tier = await loadUserTier(userId)
    const limit = TIER_SET_LIMITS[tier] ?? 1
    const decorated = (sets ?? []).map(s => decorateLockStatus(s))

    res.json({
      data: {
        sets: decorated,
        tier,
        max_sets: limit,
        can_create_more: decorated.length < limit,
      },
      error: null,
    })
  }
)

// POST /api/business/:businessId/tracking-sets
//
// Body: { name: string, queries: string[5] }
//
// Tier-gated: Free=1, Starter=2, Growth=3. The slot_number is auto-assigned
// to the lowest unused integer in [1, max_sets].
router.post(
  '/business/:businessId/tracking-sets',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const businessId = req.params.businessId as string
    const userId = req.userId!

    if (!(await assertOwnership(businessId, userId))) {
      res.status(404).json({ data: null, error: 'Business not found' })
      return
    }

    const schema = z.object({ name: NameSchema, queries: QueryListSchema })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ data: null, error: parsed.error.flatten() })
      return
    }

    const tier = await loadUserTier(userId)
    const limit = TIER_SET_LIMITS[tier] ?? 1

    const { data: existingSets } = await supabase
      .from('tracking_sets')
      .select('slot_number')
      .eq('business_id', businessId)
      .order('slot_number', { ascending: true })

    const used = (existingSets ?? []).map(s => s.slot_number)
    if (used.length >= limit) {
      res.status(403).json({
        data: null,
        error: `Your ${tier} plan allows ${limit} tracking set${limit === 1 ? '' : 's'}. Upgrade for more.`,
        code: 'set_limit_reached',
      })
      return
    }

    // Find the lowest unused slot in [1, max_sets].
    let nextSlot = 1
    while (used.includes(nextSlot)) nextSlot += 1

    const { data: newSet, error: createError } = await supabase
      .from('tracking_sets')
      .insert({
        business_id: businessId,
        slot_number: nextSlot,
        name: parsed.data.name,
      })
      .select('id, slot_number, name, first_scanned_at, locked_until, created_at')
      .single()

    if (createError || !newSet) {
      console.error('Failed to create tracking set:', createError)
      res.status(500).json({ data: null, error: 'Failed to create tracking set' })
      return
    }

    const queryRows = parsed.data.queries.map(query_text => ({
      business_id: businessId,
      tracking_set_id: newSet.id,
      query_text,
      is_active: true,
      source: 'custom' as const,
    }))
    const { error: queryError } = await supabase.from('queries').insert(queryRows)

    if (queryError) {
      console.error('Set created but queries failed:', queryError)
      res.status(500).json({ data: null, error: 'Set created but queries failed to save' })
      return
    }

    res.status(201).json({ data: decorateLockStatus(newSet), error: null })
  }
)

// PUT /api/tracking-sets/:setId
//
// Body: { name?: string, queries?: string[5] }
//
// Renaming is always allowed. Editing queries is blocked while the set is
// locked (within 30 days of first scan). When queries are edited after the
// lock expires, the lock resets — next scan starts a fresh 30-day window.
router.put('/tracking-sets/:setId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { setId } = req.params
  const userId = req.userId!

  const { data: set, error: fetchError } = await supabase
    .from('tracking_sets')
    .select(`
      id, business_id, slot_number, name, first_scanned_at, locked_until,
      businesses!inner(user_id)
    `)
    .eq('id', setId)
    .single()

  if (fetchError || !set) {
    res.status(404).json({ data: null, error: 'Tracking set not found' })
    return
  }

  if ((set as any).businesses.user_id !== userId) {
    res.status(403).json({ data: null, error: 'Forbidden' })
    return
  }

  const schema = z.object({
    name: NameSchema.optional(),
    queries: QueryListSchema.optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const updates: { name?: string; first_scanned_at?: null; locked_until?: null } = {}
  if (parsed.data.name) updates.name = parsed.data.name

  if (parsed.data.queries) {
    const lockedUntilMs = set.locked_until ? new Date(set.locked_until).getTime() : 0
    if (lockedUntilMs > Date.now()) {
      res.status(403).json({
        data: null,
        error: 'This set is locked. Queries cannot be edited until the lock expires.',
        code: 'set_locked',
        locked_until: set.locked_until,
      })
      return
    }

    // Replace queries: deactivate old, insert new. Lock resets to null
    // here; the next scan re-stamps first_scanned_at + locked_until.
    const { error: deactivateError } = await supabase
      .from('queries')
      .update({ is_active: false })
      .eq('tracking_set_id', set.id)

    if (deactivateError) {
      res.status(500).json({ data: null, error: 'Failed to update queries' })
      return
    }

    const newRows = parsed.data.queries.map(query_text => ({
      business_id: set.business_id,
      tracking_set_id: set.id,
      query_text,
      is_active: true,
      source: 'custom' as const,
    }))
    const { error: insertError } = await supabase.from('queries').insert(newRows)
    if (insertError) {
      res.status(500).json({ data: null, error: 'Failed to save new queries' })
      return
    }

    updates.first_scanned_at = null
    updates.locked_until = null
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('tracking_sets')
      .update(updates)
      .eq('id', set.id)
    if (updateError) {
      res.status(500).json({ data: null, error: 'Failed to update tracking set' })
      return
    }
  }

  const { data: refreshed } = await supabase
    .from('tracking_sets')
    .select('id, slot_number, name, first_scanned_at, locked_until, created_at')
    .eq('id', set.id)
    .single()

  res.json({ data: refreshed ? decorateLockStatus(refreshed) : null, error: null })
})

// DELETE /api/tracking-sets/:setId
//
// Deletes a non-primary tracking set and cascades its queries + scans. The
// auto-generated slot 1 cannot be deleted — it's the user's baseline.
router.delete('/tracking-sets/:setId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { setId } = req.params
  const userId = req.userId!

  const { data: set, error: fetchError } = await supabase
    .from('tracking_sets')
    .select('id, slot_number, businesses!inner(user_id)')
    .eq('id', setId)
    .single()

  if (fetchError || !set) {
    res.status(404).json({ data: null, error: 'Tracking set not found' })
    return
  }

  if ((set as any).businesses.user_id !== userId) {
    res.status(403).json({ data: null, error: 'Forbidden' })
    return
  }

  if (set.slot_number === 1) {
    res.status(403).json({
      data: null,
      error: 'The primary tracking set cannot be deleted.',
      code: 'cannot_delete_primary',
    })
    return
  }

  const { error: deleteError } = await supabase
    .from('tracking_sets')
    .delete()
    .eq('id', set.id)

  if (deleteError) {
    res.status(500).json({ data: null, error: 'Failed to delete tracking set' })
    return
  }

  res.json({ data: { deleted: true }, error: null })
})

export default router
