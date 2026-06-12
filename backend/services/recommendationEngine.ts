import OpenAI from 'openai'

export interface Recommendation {
  priority: number
  title: string
  body: string
  evidence: string
  impact: 'high' | 'medium' | 'low'
  platform: 'all' | 'perplexity' | 'openai' | 'anthropic' | 'gemini'
}

const TOTAL_RECS = 7
const RAW_SNIPPET_CHARS = 600

export const TIER_REC_LIMITS: Record<string, number> = {
  free: 1,
  starter: 3,
  growth: TOTAL_RECS,
}

function isRealKey(val: string | undefined): boolean {
  return !!val && !val.includes('REPLACE_ME') && val.length > 20
}

type RecInput = {
  query_text: string
  platform: string
  mentioned: boolean
  mention_position: number | null
  sentiment: string | null
  competitors_mentioned: string[]
  raw_response: string | null
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function formatResults(results: RecInput[]): string {
  // Group by query so the model sees each query's full cross-platform picture together.
  const byQuery: Record<string, RecInput[]> = {}
  for (const r of results) {
    if (!byQuery[r.query_text]) byQuery[r.query_text] = []
    byQuery[r.query_text].push(r)
  }

  return Object.entries(byQuery).map(([query, rows]) => {
    const blocks = rows.map(r => {
      const status = r.mentioned ? 'MENTIONED' : 'NOT MENTIONED'
      const pos = r.mention_position != null ? ` (position #${r.mention_position})` : ''
      const sent = r.sentiment ? `, sentiment: ${r.sentiment}` : ''
      const rivals = r.competitors_mentioned.length > 0
        ? `\n    Competitors named: ${r.competitors_mentioned.slice(0, 6).join(', ')}`
        : ''
      const snippet = r.raw_response && r.raw_response.trim().length > 0
        ? `\n    Response excerpt: """${truncate(r.raw_response.trim(), RAW_SNIPPET_CHARS)}"""`
        : ''
      return `  - ${r.platform}: ${status}${pos}${sent}${rivals}${snippet}`
    }).join('\n')
    return `QUERY: "${query}"\n${blocks}`
  }).join('\n\n')
}

export async function generateRecommendations(
  businessName: string,
  results: RecInput[],
  overallScore: number
): Promise<Recommendation[]> {
  if (!isRealKey(process.env.OPENAI_API_KEY)) {
    console.warn('generateRecommendations: OpenAI not configured, skipping')
    return []
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const formattedResults = formatResults(results)
  const platformsPresent = [...new Set(results.map(r => r.platform))].join(', ')

  const prompt = `You are an AI visibility consultant analyzing why AI search platforms do or don't mention a specific business. You will produce concrete, grounded recommendations — NOT generic SEO advice.

Business: ${businessName}
Overall visibility score: ${Math.round(overallScore)}/100
Platforms scanned: ${platformsPresent}

Below is the full scan: each query, what every AI platform actually returned, which competitors they named instead, and whether they mentioned ${businessName}.

=== SCAN DATA ===
${formattedResults}
=== END SCAN DATA ===

Your task: produce exactly ${TOTAL_RECS} recommendations, ranked #1 (highest impact) to #${TOTAL_RECS}.

Each recommendation MUST include an "evidence" field that cites the specific observation from the scan data above that justifies the recommendation. Reference the actual query, platform, competitor names, or response excerpts. If you cannot cite specific evidence from the scan, do NOT include the recommendation.

Examples of good vs bad evidence:
- BAD evidence: "AI platforms favor sites with strong content."
- GOOD evidence: "Perplexity's response to 'best pizza in austin' ranks Joe's Pizza #1 and cites their 4.8-star rating with 2,000+ reviews; ${businessName} is not mentioned in any of the 3 platforms for this query."

Rules:
- Do NOT repeat the same advice across recommendations — diversify by lever (content, citations, schema, reviews, partnerships, press, etc.)
- Each recommendation must be specific to ${businessName} and its actual scan data — no generic playbook items
- If a competitor keeps appearing across queries, name them and explain what they're doing right
- "platform" = the platform this advice primarily targets, or "all" if universal
- "impact" must reflect estimated score lift, not effort

Respond with a JSON array only, no markdown, no other text:
[
  {
    "priority": 1,
    "title": "Short actionable title (max 70 chars)",
    "body": "2-3 sentences explaining what to do.",
    "evidence": "1-2 sentences citing the specific scan observation that motivates this rec. Reference actual query text, platform, or competitor names from the data above.",
    "impact": "high",
    "platform": "all"
  }
]
impact must be "high", "medium", or "low".
platform must be one of: "all", "perplexity", "openai", "anthropic", "gemini".`

  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    reasoning_effort: 'low',
    max_completion_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''

  // gpt-5 with json_object mode returns a JSON object; the array may be at the
  // top level or wrapped under a key. Tolerate both.
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: unknown = JSON.parse(stripped)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const arrayValue = Object.values(obj).find(v => Array.isArray(v))
    if (arrayValue) parsed = arrayValue
  }
  if (!Array.isArray(parsed)) throw new Error('Expected array of recommendations')

  const recs: Recommendation[] = parsed
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r, i) => ({
      priority: typeof r.priority === 'number' ? r.priority : i + 1,
      title: typeof r.title === 'string' ? r.title.slice(0, 90) : 'Recommendation',
      body: typeof r.body === 'string' ? r.body : '',
      evidence: typeof r.evidence === 'string' ? r.evidence : '',
      impact: ['high', 'medium', 'low'].includes(r.impact as string)
        ? (r.impact as 'high' | 'medium' | 'low')
        : 'medium',
      platform: ['all', 'perplexity', 'openai', 'anthropic', 'gemini'].includes(r.platform as string)
        ? (r.platform as Recommendation['platform'])
        : 'all',
    }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, TOTAL_RECS)

  return recs
}
