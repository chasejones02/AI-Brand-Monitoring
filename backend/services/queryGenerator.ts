import OpenAI from 'openai'
import 'dotenv/config'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export type GeneratedQuery = {
  query_text: string
  intent: 'category' | 'local_comparison' | 'problem' | 'recommendation' | 'attribute'
  reason: string
}

type GenerateInput = {
  name: string
  location: string
  description: string
  count?: number
  // Online/national businesses have no physical location. In this mode we skip
  // the location anchoring + filtering and generate category/intent queries.
  online?: boolean
}

const INTENTS: GeneratedQuery['intent'][] = [
  'category',
  'local_comparison',
  'problem',
  'recommendation',
  'attribute',
]

function normalizeCount(count?: number): number {
  if (!count) return 5
  return Math.min(5, Math.max(3, Math.round(count)))
}

function locationAnchor(location: string): string {
  return location.split(',')[0]?.trim().toLowerCase() || location.trim().toLowerCase()
}

function locationState(location: string): string {
  return location.split(',')[1]?.trim().toLowerCase() || ''
}

// A query is considered location-valid only if it mentions BOTH the city
// and the state. Many town names repeat across states (Brookings exists in
// SD, OR, etc.), and without the state the AI platform can return results
// from the wrong town entirely.
function includesLocation(query: string, location: string): boolean {
  const anchor = locationAnchor(location)
  const state = locationState(location)
  const q = query.toLowerCase()
  if (!anchor || !q.includes(anchor)) return false
  if (!state) return true
  return q.includes(state)
}

function includesBusinessName(query: string, businessName: string): boolean {
  return query.toLowerCase().includes(businessName.toLowerCase())
}

// Split a distilled category into independent facets so multi-category
// businesses (e.g. "bar and club", "pizza and pasta", "salon/spa") produce
// varied queries instead of forcing every query to mention every facet.
function splitFacets(category: string): string[] {
  const parts = category
    .split(/\s+(?:and|or|&)\s+|\s*[/,]\s*/i)
    .map(s => s.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : [category.trim()]
}

// Heuristic for distilling a clean category noun phrase out of a free-form
// description. Only used when the LLM is unavailable or its call fails — the
// happy path is that the LLM returns a `category` field directly.
function cleanCategoryFromDescription(description: string, location: string): string {
  let text = description.trim().toLowerCase()
  if (!text) return ''

  // 1. Take the first comma-separated chunk — descriptions like
  //    "fast food shop, we sell burgers and fries..." carry the useful noun
  //    phrase up front.
  text = text.split(',')[0]?.trim() ?? text

  // 2. Strip first-person preambles ("we sell X" → "X").
  text = text.replace(
    /^(we(?:'re| are)?|i(?:'m| am)?|the)\s+(sell|offer|provide|serve|do|make|are|a|an)\s+/i,
    ''
  )
  text = text.replace(/^(we|i)\s+/i, '')

  // 3. Strip an embedded location suffix like "in brookings sd" if the
  //    user's location is repeated inside the description.
  const anchor = locationAnchor(location)
  if (anchor) {
    text = text.replace(new RegExp(`\\s+in\\s+${anchor}.*$`, 'i'), '')
  }

  // 4. Strip street/landmark suffixes ("on main street", "near downtown").
  text = text.replace(/\s+(on|near|at|by)\s+[a-z0-9\s]+$/i, '')

  text = text.trim().replace(/\s+/g, ' ')

  // 5. If we ended up with something unreasonably long, keep the first six
  //    words so templates don't read like a paragraph.
  const words = text.split(' ')
  if (words.length > 6) text = words.slice(0, 6).join(' ')

  return text
}

function dedupeAndLimit(
  queries: GeneratedQuery[],
  count: number,
  location: string,
  businessName: string,
  requireLocation = true
): GeneratedQuery[] {
  const seen = new Set<string>()
  const clean: GeneratedQuery[] = []

  for (const query of queries) {
    const text = query.query_text.trim().replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (text.length < 3 || text.length > 500 || seen.has(key)) continue
    if (requireLocation && !includesLocation(text, location)) continue
    if (includesBusinessName(text, businessName)) continue
    seen.add(key)
    clean.push({
      query_text: text,
      intent: INTENTS.includes(query.intent) ? query.intent : 'category',
      reason: query.reason.trim().slice(0, 240) || 'Chosen to test a realistic customer search pattern.',
    })
    if (clean.length >= count) break
  }

  return clean
}

// Safety-net template set used only when the LLM is unavailable or returns
// too few valid queries. Templates rotate through the description's facets so
// "bar and club" produces "best bar..." + "top rated club..." rather than the
// same phrase five times in a row.
function fallbackQueries(
  input: { name: string; location: string; category: string },
  count: number
): GeneratedQuery[] {
  const category = input.category.trim()
  const location = input.location.trim()
  const facets = splitFacets(category)
  const pick = (i: number) => facets[i % facets.length] || category

  return dedupeAndLimit([
    {
      query_text: `best ${pick(0)} in ${location}`,
      intent: 'category',
      reason: 'Tests visibility in a broad local best-of search — the most common AI prompt for finding a new business.',
    },
    {
      query_text: `top rated ${pick(1)} in ${location}`,
      intent: 'local_comparison',
      reason: 'Checks visibility in comparison-style searches with rating intent.',
    },
    {
      query_text: `popular ${pick(2)} in ${location}`,
      intent: 'recommendation',
      reason: 'Simulates a customer asking AI for a recommendation of well-known options.',
    },
    {
      query_text: `where to find ${pick(3)} in ${location}`,
      intent: 'problem',
      reason: 'Captures a high-intent discovery search where the customer knows what they want but not where to go.',
    },
    {
      query_text: `affordable ${pick(4)} in ${location}`,
      intent: 'attribute',
      reason: 'Tests visibility on price-sensitive searches — one of the most common consumer attribute filters.',
    },
  ], count, location, input.name)
}

// Fill the LLM's output up to the target count by appending fallback templates.
// No intent matching — we just want variety, not a rigid 1-of-each split.
function fillToCount(
  clean: GeneratedQuery[],
  fallback: GeneratedQuery[],
  count: number,
  location: string,
  businessName: string,
  requireLocation = true
): GeneratedQuery[] {
  if (clean.length >= count) return clean
  return dedupeAndLimit([...clean, ...fallback], count, location, businessName, requireLocation)
}

// Safety-net templates for ONLINE businesses — no location anchor. Kept
// deliberately plain/broad so the resulting score is an honest reflection of
// how the business actually competes in category searches.
function onlineFallbackQueries(
  input: { name: string; category: string },
  count: number
): GeneratedQuery[] {
  const facets = splitFacets(input.category.trim())
  const pick = (i: number) => facets[i % facets.length] || input.category.trim()

  return dedupeAndLimit([
    {
      query_text: `best ${pick(0)}`,
      intent: 'category',
      reason: 'Tests visibility in the broadest category search — the most common AI prompt for discovering a product or service.',
    },
    {
      query_text: `top rated ${pick(1)}`,
      intent: 'recommendation',
      reason: 'Checks visibility in comparison-style searches with rating intent.',
    },
    {
      query_text: `${pick(2)} for small businesses`,
      intent: 'attribute',
      reason: 'Simulates an audience-qualified search, a common way customers narrow online options.',
    },
    {
      query_text: `affordable ${pick(3)}`,
      intent: 'attribute',
      reason: 'Tests visibility on price-sensitive searches — one of the most common consumer filters.',
    },
    {
      query_text: `most recommended ${pick(4)}`,
      intent: 'recommendation',
      reason: 'Simulates a customer asking AI for a recommendation of well-known options.',
    },
  ], count, '', input.name, false)
}

// Online/national variant of the generator. Same JSON contract and dedupe
// pipeline as the local path, but no location anchoring or filtering.
async function generateOnlineQueries(
  input: { name: string; description: string; count: number }
): Promise<GeneratedQuery[]> {
  const { name, description, count } = input

  if (!openai) {
    const category = cleanCategoryFromDescription(description, '') || description
    return onlineFallbackQueries({ name, category }, count)
  }

  const prompt = `You are generating realistic customer searches for an AI visibility scan of an ONLINE business that has no single physical location (it serves customers nationally or on the web). The goal: ${count} different prompts a stranger might type into ChatGPT, Gemini, Claude, or Perplexity when looking for this kind of product or service — WITHOUT already knowing this company's name.

Business name: ${name}
Business description (free-form, may be a full sentence): ${description}

STEP 1 — Distill the description into a clean, short CATEGORY noun phrase (2–5 words). If the business covers multiple distinct categories, keep them all — you'll vary across them in Step 2.
  "we build a saas tool for scheduling social media posts" → "social media scheduling software"
  "online store selling handmade leather wallets and belts" → "handmade leather goods"

STEP 2 — Generate ${count} DIFFERENT customer searches. Think about how a real person types into AI when they DON'T know which specific company to use.

Hard rules — non-negotiable:
- The business name "${name}" MUST NOT appear in any query.
- Do NOT include any city, state, or geographic location — this business is online / national.
- Stay faithful to the description — do NOT invent features, audiences, or niches the description doesn't support. The point is an accurate read of how this business competes, not a flattering one.

Variety rules — this is where the queries actually become useful:
- VARY phrasing across the ${count}. Mix discovery ("best X"), comparison ("top rated X", "X alternatives"), problem-led ("how to ...", "best way to ..."), audience-led ("X for small businesses", "X for freelancers"), attribute-led ("affordable X", "easiest X to use"), and review-led ("most recommended X").
- If the description covers multiple facets, SPLIT them across the queries rather than forcing every query to mention all of them.
- Synonyms and broader category words are encouraged when natural.

Return ONLY valid JSON with this exact shape:
{
  "category": "string — the distilled category noun phrase from Step 1",
  "queries": [
    {
      "query_text": "string",
      "intent": "category | local_comparison | problem | recommendation | attribute",
      "reason": "short plain-English reason this query was chosen"
    }
  ]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    const generated = Array.isArray(parsed.queries) ? parsed.queries : []
    const llmCategory = typeof parsed.category === 'string' ? parsed.category.trim() : ''
    const category = llmCategory || cleanCategoryFromDescription(description, '') || description

    const clean = dedupeAndLimit(generated, count, '', name, false)
    if (clean.length >= count) return clean
    return fillToCount(clean, onlineFallbackQueries({ name, category }, count), count, '', name, false)
  } catch (err) {
    console.warn('generateOnlineQueries failed, using fallback templates:', err)
    const category = cleanCategoryFromDescription(description, '') || description
    return onlineFallbackQueries({ name, category }, count)
  }
}

export async function generateQueriesForBusiness(input: GenerateInput): Promise<GeneratedQuery[]> {
  const count = normalizeCount(input.count)
  const name = input.name.trim()
  const location = input.location.trim()
  const description = input.description.trim()

  // Online/national businesses have no location — use the non-geographic path.
  if (input.online) {
    return generateOnlineQueries({ name, description, count })
  }

  if (!openai) {
    const category = cleanCategoryFromDescription(description, location) || description
    return fallbackQueries({ name, location, category }, count)
  }

  const prompt = `You are generating realistic customer searches for an AI visibility scan. The goal: ${count} different prompts this business would HOPE to appear in if a stranger searched them on ChatGPT, Gemini, Claude, or Perplexity.

Business name: ${name}
Location: ${location}
Business description (free-form, may be a full sentence): ${description}

STEP 1 — Distill the description into a clean, short CATEGORY noun phrase (2–5 words). If the business covers multiple distinct categories, keep them all — you'll vary across them in Step 2.
  "we make wood-fired pizzas and pastas" → "wood-fired pizza and pasta restaurant"
  "fast food shop, we sell burgers and fries on main street in brookings sd" → "burger restaurant"
  "bar and club" → "bar and club"
  "residential roofing company specializing in storm damage repair" → "residential roofers"

STEP 2 — Generate ${count} DIFFERENT customer searches. Think about how a real person types into AI when they DON'T know which specific business to use.

Hard rules — non-negotiable:
- The business name "${name}" MUST NOT appear in any query.
- Every query MUST include BOTH the city AND the state from this location: "${location}". Write both pieces in each query (e.g. "best burgers in ${locationAnchor(location)}, ${locationState(location) || 'STATE'}"). Many towns share names across states — without the state the AI returns results from the wrong town.
- Do not duplicate the location or restate trivia from the description (e.g. "on main street").

Variety rules — this is where the queries actually become useful:
- VARY phrasing across the ${count}. Do not repeat the same template (e.g. "best X in city") five times with different words. Mix discovery ("best X"), comparison ("top rated X", "X vs X"), problem-led ("where to go for X", "good X near downtown"), broader category ("nightlife", "places to eat lunch"), attribute-led ("casual X", "late-night X", "affordable X"), and review-led ("X reviews", "highly recommended X").
- If the description covers multiple facets (e.g. "bar and club", "salon and spa", "pizza and pasta"), SPLIT them across the queries. One query might be about bars, another about clubs, another about the broader scene ("nightlife", "places to dance"). Do NOT force every single query to mention every facet.
- Synonyms and broader category words are encouraged when natural (e.g. "burger spots" for a burger restaurant, "drinks" for a bar, "nightlife" for a club). The point is realism — a real customer wouldn't repeat the exact same wording in every search.
- Avoid awkward forced phrasings like "who should I hire for [bar]" — use whatever phrasing feels natural for the category.

Return ONLY valid JSON with this exact shape:
{
  "category": "string — the distilled category noun phrase from Step 1",
  "queries": [
    {
      "query_text": "string",
      "intent": "category | local_comparison | problem | recommendation | attribute",
      "reason": "short plain-English reason this query was chosen"
    }
  ]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    const generated = Array.isArray(parsed.queries) ? parsed.queries : []
    const llmCategory = typeof parsed.category === 'string' ? parsed.category.trim() : ''
    const category =
      llmCategory ||
      cleanCategoryFromDescription(description, location) ||
      description

    const clean = dedupeAndLimit(generated, count, location, name)

    if (clean.length >= count) return clean
    return fillToCount(
      clean,
      fallbackQueries({ name, location, category }, count),
      count,
      location,
      name
    )
  } catch (err) {
    console.warn('generateQueriesForBusiness failed, using fallback templates:', err)
    const category = cleanCategoryFromDescription(description, location) || description
    return fallbackQueries({ name, location, category }, count)
  }
}
