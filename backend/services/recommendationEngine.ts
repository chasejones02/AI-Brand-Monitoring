import OpenAI from 'openai'

export interface Recommendation {
  priority: number
  title: string
  body: string
  impact: 'high' | 'medium' | 'low'
  platform: 'all' | 'perplexity' | 'openai' | 'anthropic' | 'gemini'
}

const TOTAL_RECS = 7

export const TIER_REC_LIMITS: Record<string, number> = {
  free: 1,
  starter: 3,
  growth: TOTAL_RECS,
  agency: TOTAL_RECS,
}

function isRealKey(val: string | undefined): boolean {
  return !!val && !val.includes('REPLACE_ME') && val.length > 20
}

function formatResults(
  results: Array<{
    query_text: string
    platform: string
    mentioned: boolean
    mention_position: number | null
    sentiment: string | null
    competitors_mentioned: string[]
  }>
): string {
  // Group by query for compact representation
  const byQuery: Record<string, typeof results> = {}
  for (const r of results) {
    if (!byQuery[r.query_text]) byQuery[r.query_text] = []
    byQuery[r.query_text].push(r)
  }

  return Object.entries(byQuery).map(([query, rows]) => {
    const platforms = rows.map(r => {
      if (!r.mentioned) return `${r.platform}: not mentioned`
      const pos = r.mention_position != null ? ` #${r.mention_position}` : ''
      const sent = r.sentiment ? ` ${r.sentiment}` : ''
      const rivals = r.competitors_mentioned.length > 0
        ? ` [rivals: ${r.competitors_mentioned.slice(0, 3).join(', ')}]`
        : ''
      return `${r.platform}: MENTIONED${pos}${sent}${rivals}`
    }).join(' | ')
    return `"${query}" → ${platforms}`
  }).join('\n')
}

export async function generateRecommendations(
  businessName: string,
  results: Array<{
    query_text: string
    platform: string
    mentioned: boolean
    mention_position: number | null
    sentiment: string | null
    competitors_mentioned: string[]
  }>,
  overallScore: number
): Promise<Recommendation[]> {
  if (!isRealKey(process.env.OPENAI_API_KEY)) {
    console.warn('generateRecommendations: OpenAI not configured, skipping')
    return []
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const formattedResults = formatResults(results)
  const platformsPresent = [...new Set(results.map(r => r.platform))].join(', ')

  const prompt = `You are an AI visibility consultant. A business owner wants to improve how AI platforms mention their business in search results.

Business: ${businessName}
Overall visibility score: ${Math.round(overallScore)}/100
Platforms scanned: ${platformsPresent}

Scan results (each query across platforms):
${formattedResults}

Generate exactly ${TOTAL_RECS} actionable recommendations to improve this business's AI visibility score, ranked by estimated impact. Reference the actual queries and platforms where issues were found.

Rules:
- Do NOT repeat the same advice for different queries — generalize and prioritize
- Be specific to THIS business and its actual queries, not generic SEO advice
- "platform" = the platform this advice primarily targets, or "all" if universal
- Rank #1 = highest estimated impact on visibility score

Respond with a JSON array only, no other text:
[
  {
    "priority": 1,
    "title": "Short actionable title (max 65 chars)",
    "body": "2-3 sentences explaining what to do and why it will improve AI visibility.",
    "impact": "high",
    "platform": "all"
  }
]
impact must be "high", "medium", or "low".
platform must be one of: "all", "perplexity", "openai", "anthropic", "gemini".`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''

  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Expected array')

  const recs: Recommendation[] = parsed
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r, i) => ({
      priority: typeof r.priority === 'number' ? r.priority : i + 1,
      title: typeof r.title === 'string' ? r.title.slice(0, 80) : 'Recommendation',
      body: typeof r.body === 'string' ? r.body : '',
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
