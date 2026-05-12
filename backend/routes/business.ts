import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { generateQueriesForBusiness, type GeneratedQuery } from '../services/queryGenerator.js'

const router = Router()

function hasRegionLevelLocation(location: string): boolean {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean)
  return parts.length >= 2 && parts[0].length >= 2 && parts[1].length >= 2
}

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(1000).optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  queries: z.array(z.string().min(3).max(500)).min(1).max(10).optional(),
  generate_queries: z.boolean().optional(),
  query_count: z.number().int().min(3).max(5).optional(),
}).superRefine((data, ctx) => {
  if (data.generate_queries && !data.location?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Location is required for generated free-scan queries',
    })
  }
  if (data.generate_queries && data.location?.trim() && !hasRegionLevelLocation(data.location)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Use a precise location like "Brookings, SD" or "Brookings, South Dakota"',
    })
  }
  if (data.generate_queries && !data.description?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'A short business description is required for generated free-scan queries',
    })
  }
  if (!data.generate_queries && !data.queries?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['queries'],
      message: 'Add at least one query or enable generated queries',
    })
  }
})

// POST /api/business — create business + auto-generated tracking set (slot 1)
// + its queries in one shot. The auto-generated set is named "Default" and
// is the only set Free users have access to.
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateBusinessSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ data: null, error: parsed.error.flatten() })
    return
  }

  const { name, location, description, website, industry, generate_queries, query_count } = parsed.data
  const userId = req.userId!
  const businessDescription = description?.trim() || industry?.trim() || ''

  let queryInputs: GeneratedQuery[]
  if (generate_queries) {
    queryInputs = await generateQueriesForBusiness({
      name,
      location: location!,
      description: businessDescription,
      count: query_count,
    })
  } else {
    queryInputs = (parsed.data.queries ?? []).map(query_text => ({
      query_text,
      intent: 'category' as const,
      reason: '',
    }))
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      user_id: userId,
      name,
      location: location || null,
      website: website || null,
      industry: businessDescription || null,
    })
    .select()
    .single()

  if (bizError || !business) {
    console.error('Failed to create business:', bizError)
    res.status(500).json({ data: null, error: 'Failed to create business' })
    return
  }

  const { data: defaultSet, error: setError } = await supabase
    .from('tracking_sets')
    .insert({ business_id: business.id, slot_number: 1, name: 'Default' })
    .select('id')
    .single()

  if (setError || !defaultSet) {
    console.error('Business created but slot 1 tracking set failed:', setError)
    res.status(500).json({ data: null, error: 'Failed to initialize tracking set' })
    return
  }

  const queryRows = queryInputs.map(query => ({
    business_id: business.id,
    tracking_set_id: defaultSet.id,
    query_text: query.query_text,
    source: generate_queries ? 'generated' : 'custom',
    intent: generate_queries ? query.intent : null,
    generation_reason: generate_queries ? query.reason : null,
  }))

  const { error: queryError } = await supabase.from('queries').insert(queryRows)

  if (queryError) {
    console.error('Business created but failed to save queries:', queryError)
    res.status(500).json({ data: null, error: 'Business created but failed to save queries' })
    return
  }

  res.status(201).json({
    data: { business_id: business.id, default_set_id: defaultSet.id },
    error: null,
  })
})

// GET /api/business — list user's businesses with their tracking sets and
// queries inlined. The dashboard uses this to bootstrap.
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!

  const { data, error } = await supabase
    .from('businesses')
    .select(`
      id, name, location, website, industry, created_at,
      tracking_sets(
        id, slot_number, name, first_scanned_at, locked_until, created_at,
        queries(id, query_text, is_active, source, intent, generation_reason)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ data: null, error: 'Failed to fetch businesses' })
    return
  }

  // Sort tracking_sets by slot_number for predictable tab order.
  const businesses = (data ?? []).map(b => ({
    ...b,
    tracking_sets: ((b as any).tracking_sets ?? []).sort(
      (a: { slot_number: number }, z: { slot_number: number }) => a.slot_number - z.slot_number
    ),
  }))

  res.json({ data: businesses, error: null })
})

export default router
