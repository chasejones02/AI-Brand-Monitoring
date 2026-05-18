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

function includesLocation(query: string, location: string): boolean {
  const anchor = locationAnchor(location)
  return anchor.length > 0 && query.toLowerCase().includes(anchor)
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
  businessName: string
): GeneratedQuery[] {
  const seen = new Set<string>()
  const clean: GeneratedQuery[] = []

  for (const query of queries) {
    const text = query.query_text.trim().replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (text.length < 3 || text.length > 500 || seen.has(key)) continue
    if (!includesLocation(text, location)) continue
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
  businessName: string
): GeneratedQuery[] {
  if (clean.length >= count) return clean
  return dedupeAndLimit([...clean, ...fallback], count, location, businessName)
}

export async function generateQueriesForBusiness(input: GenerateInput): Promise<GeneratedQuery[]> {
  const count = normalizeCount(input.count)
  const name = input.name.trim()
  const location = input.location.trim()
  const description = input.description.trim()

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
- Every query MUST include the city: "${locationAnchor(location)}".
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
