import OpenAI from 'openai'
import 'dotenv/config'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export type GeneratedQuery = {
  query_text: string
  intent: 'category' | 'local_comparison' | 'problem' | 'recommendation' | 'brand'
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
  'brand',
]

const INTENT_ORDER: GeneratedQuery['intent'][] = [
  'category',
  'local_comparison',
  'problem',
  'recommendation',
  'brand',
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

const CATEGORY_STOPWORDS = new Set([
  'and',
  'the',
  'for',
  'near',
  'with',
  'shop',
  'shops',
  'shopping',
  'store',
  'stores',
  'clothes',
  'clothing',
  'company',
  'companies',
  'business',
  'businesses',
  'service',
  'services',
  'place',
  'places',
])

function distinctiveCategoryTerms(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length >= 4 && !CATEGORY_STOPWORDS.has(term))
}

function preservesCategoryLanguage(query: string, description: string): boolean {
  const terms = distinctiveCategoryTerms(description)
  if (terms.length === 0) return true
  const lower = query.toLowerCase()
  return terms.every(term => lower.includes(term))
}

function dedupeAndLimit(
  queries: GeneratedQuery[],
  count: number,
  location: string,
  businessName: string,
  description: string
): GeneratedQuery[] {
  const seen = new Set<string>()
  const clean: GeneratedQuery[] = []
  let brandCount = 0

  for (const query of queries) {
    const text = query.query_text.trim().replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (text.length < 3 || text.length > 500 || seen.has(key)) continue
    if (!includesLocation(text, location)) continue
    if (query.intent !== 'brand' && includesBusinessName(text, businessName)) continue
    if (query.intent !== 'brand' && !preservesCategoryLanguage(text, description)) continue
    if (query.intent === 'brand') {
      if (brandCount >= 1) continue
      brandCount += 1
    }
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

function fallbackQueries(input: Pick<GenerateInput, 'name' | 'location' | 'description'>, count: number): GeneratedQuery[] {
  const category = input.description.trim()
  const location = input.location.trim()

  return dedupeAndLimit([
    {
      query_text: `best ${category} in ${location}`,
      intent: 'category',
      reason: 'Tests whether AI includes the business in a broad local best-of recommendation.',
    },
    {
      query_text: `compare ${category} in ${location}`,
      intent: 'local_comparison',
      reason: 'Checks visibility in comparison-style local searches with rating intent.',
    },
    {
      query_text: `who should I hire for ${category} in ${location}`,
      intent: 'recommendation',
      reason: 'Simulates a customer asking AI for a direct hiring recommendation.',
    },
    {
      query_text: `where can I find ${category} in ${location}`,
      intent: 'problem',
      reason: 'Captures a high-intent discovery search while preserving the stated business category.',
    },
    {
      query_text: `is ${input.name} in ${location} any good`,
      intent: 'brand',
      reason: 'Measures what AI says when the customer already knows the brand name.',
    },
  ], count, location, input.name, input.description)
}

function fillMissingIntents(
  clean: GeneratedQuery[],
  fallback: GeneratedQuery[],
  count: number,
  location: string,
  businessName: string,
  description: string
): GeneratedQuery[] {
  let merged = [...clean]

  for (const intent of INTENT_ORDER) {
    if (merged.length >= count) break
    if (merged.some(query => query.intent === intent)) continue

    const candidate = fallback.find(query => query.intent === intent)
    if (candidate) {
      merged = dedupeAndLimit([...merged, candidate], count, location, businessName, description)
    }
  }

  if (merged.length < count) {
    merged = dedupeAndLimit([...merged, ...fallback], count, location, businessName, description)
  }

  return merged
}

export async function generateQueriesForBusiness(input: GenerateInput): Promise<GeneratedQuery[]> {
  const count = normalizeCount(input.count)
  const name = input.name.trim()
  const location = input.location.trim()
  const description = input.description.trim()

  if (!openai) {
    return fallbackQueries({ name, location, description }, count)
  }

  const prompt = `Generate ${count} realistic customer search queries for an AI visibility scan.

Business name: ${name}
Location: ${location}
Short description/category: ${description}

Rules:
- These should be queries a real customer might ask ChatGPT, Gemini, Claude, or Perplexity.
- For a 5-query scan, create exactly this mix:
  1 category/local discovery query
  1 comparison query
  1 problem/need query
  1 recommendation/hiring query
  1 direct brand-check query
- Only one query may use the business name directly. The other queries should describe the category/service, not the brand.
- Do not make claims about the business.
- Every query must include the city/location.
- Preserve the short description's category language closely. Do not narrow, broaden, or swap in adjacent categories.
- Avoid generic wording like "businesses like"; use the short description as the service/category.
- Return ONLY valid JSON with this shape:
{
  "queries": [
    {
      "query_text": "string",
      "intent": "category | local_comparison | problem | recommendation | brand",
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
    const clean = dedupeAndLimit(generated, count, location, name, description)

    if (clean.length >= count) return clean
    if (clean.length >= 3) {
      return fillMissingIntents(
        clean,
        fallbackQueries({ name, location, description }, count),
        count,
        location,
        name,
        description
      )
    }
    return fallbackQueries({ name, location, description }, count)
  } catch (err) {
    console.warn('generateQueriesForBusiness failed, using fallback templates:', err)
    return fallbackQueries({ name, location, description }, count)
  }
}
