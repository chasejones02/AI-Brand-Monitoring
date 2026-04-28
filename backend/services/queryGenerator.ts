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
  description?: string
  count?: number
}

const INTENTS: GeneratedQuery['intent'][] = [
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

function dedupeAndLimit(queries: GeneratedQuery[], count: number): GeneratedQuery[] {
  const seen = new Set<string>()
  const clean: GeneratedQuery[] = []

  for (const query of queries) {
    const text = query.query_text.trim().replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (text.length < 3 || text.length > 500 || seen.has(key)) continue
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

function fallbackQueries(input: Required<Pick<GenerateInput, 'name' | 'location'>> & Pick<GenerateInput, 'description'>, count: number): GeneratedQuery[] {
  const description = input.description?.trim()
  const category = description && description.length >= 3 ? description : `${input.name} alternatives`
  const location = input.location.trim()

  return dedupeAndLimit([
    {
      query_text: `best ${category} in ${location}`,
      intent: 'category',
      reason: 'Tests whether AI includes the business in a broad local best-of recommendation.',
    },
    {
      query_text: `top rated ${category} near ${location}`,
      intent: 'local_comparison',
      reason: 'Checks visibility in comparison-style local searches with rating intent.',
    },
    {
      query_text: `who should I hire for ${category} in ${location}`,
      intent: 'recommendation',
      reason: 'Simulates a customer asking AI for a direct hiring recommendation.',
    },
    {
      query_text: `${category} near me ${location}`,
      intent: 'problem',
      reason: 'Captures a high-intent local discovery search where AI may name nearby providers.',
    },
    {
      query_text: `is ${input.name} in ${location} any good`,
      intent: 'brand',
      reason: 'Measures what AI says when the customer already knows the brand name.',
    },
  ], count)
}

export async function generateQueriesForBusiness(input: GenerateInput): Promise<GeneratedQuery[]> {
  const count = normalizeCount(input.count)
  const name = input.name.trim()
  const location = input.location.trim()
  const description = input.description?.trim()

  if (!openai) {
    return fallbackQueries({ name, location, description }, count)
  }

  const prompt = `Generate ${count} realistic customer search queries for an AI visibility scan.

Business name: ${name}
Location: ${location}
Optional description/category: ${description || 'Not provided'}

Rules:
- These should be queries a real customer might ask ChatGPT, Gemini, Claude, or Perplexity.
- Include a mix of discovery, comparison, problem/need, recommendation, and direct brand checks.
- Do not make claims about the business.
- Use the location naturally.
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
    const clean = dedupeAndLimit(generated, count)

    if (clean.length >= 3) return clean
    return fallbackQueries({ name, location, description }, count)
  } catch (err) {
    console.warn('generateQueriesForBusiness failed, using fallback templates:', err)
    return fallbackQueries({ name, location, description }, count)
  }
}
