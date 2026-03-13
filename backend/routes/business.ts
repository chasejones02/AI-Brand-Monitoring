import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'

const router = Router()

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  queries: z.array(z.string().min(3).max(500)).min(1).max(10),
})

// POST /api/business — create business + queries in one shot (onboarding)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBusinessSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const { name, website, industry, queries } = parsed.data
  const userId = req.userId!

  // Create the business
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({ user_id: userId, name, website: website || null, industry: industry || null })
    .select()
    .single()

  if (bizError || !business) {
    res.status(500).json({ data: null, error: 'Failed to create business' })
    return
  }

  // Insert queries
  const queryRows = queries.map(query_text => ({
    business_id: business.id,
    query_text,
  }))

  const { error: queryError } = await supabase.from('queries').insert(queryRows)

  if (queryError) {
    res.status(500).json({ data: null, error: 'Business created but failed to save queries' })
    return
  }

  res.status(201).json({ data: { business_id: business.id }, error: null })
})

// GET /api/business — list user's businesses
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!

  const { data, error } = await supabase
    .from('businesses')
    .select(`
      id, name, website, industry, created_at,
      queries(id, query_text, is_active)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ data: null, error: 'Failed to fetch businesses' })
    return
  }

  res.json({ data, error: null })
})

export default router
