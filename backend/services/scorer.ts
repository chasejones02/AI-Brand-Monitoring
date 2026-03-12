import type { ScanResult } from './supabase.js'

// Scoring per CLAUDE.md v1 algorithm
// mention_score:   +10 per platform that mentions the business
// position_score:  +5 if first, +3 if top 3, +1 if mentioned at all
// sentiment_score: +3 positive, +1 neutral, -2 negative

export type ParsedResponse = {
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
}

export function scoreResult(parsed: ParsedResponse): {
  mention_score: number
  position_score: number
  sentiment_score: number
} {
  const mention_score = parsed.mentioned ? 10 : 0

  let position_score = 0
  if (parsed.mentioned) {
    if (parsed.mention_position === 1) position_score = 5
    else if (parsed.mention_position !== null && parsed.mention_position <= 3) position_score = 3
    else position_score = 1
  }

  let sentiment_score = 0
  if (parsed.mentioned && parsed.sentiment) {
    if (parsed.sentiment === 'positive') sentiment_score = 3
    else if (parsed.sentiment === 'neutral') sentiment_score = 1
    else if (parsed.sentiment === 'negative') sentiment_score = -2
  }

  return { mention_score, position_score, sentiment_score }
}

export function calculateVisibilityScore(results: ScanResult[]): number {
  if (results.length === 0) return 0

  // Max possible per result: 10 + 5 + 3 = 18
  const MAX_PER_RESULT = 18
  const totalMax = results.length * MAX_PER_RESULT

  const totalActual = results.reduce((sum, r) => {
    return sum + r.mention_score + r.position_score + r.sentiment_score
  }, 0)

  const raw = (totalActual / totalMax) * 100
  // Clamp to 0-100
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100))
}

export function parseAIResponse(
  response: string,
  businessName: string
): ParsedResponse {
  const lower = response.toLowerCase()
  const businessLower = businessName.toLowerCase()

  // Check if business is mentioned
  const mentioned = lower.includes(businessLower)

  // Find mention position (rough heuristic: split into sentences, find which sentence first mentions it)
  let mention_position: number | null = null
  if (mentioned) {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const mentionIdx = sentences.findIndex(s =>
      s.toLowerCase().includes(businessLower)
    )
    // Convert sentence index to rough position (1-based)
    mention_position = mentionIdx >= 0 ? mentionIdx + 1 : 1
  }

  // Sentiment detection (simple keyword-based for MVP)
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null
  if (mentioned) {
    const positiveWords = ['best', 'excellent', 'great', 'top', 'recommended', 'popular', 'leading', 'trusted', 'highly rated', 'award']
    const negativeWords = ['worst', 'poor', 'bad', 'avoid', 'complaint', 'issue', 'problem', 'scam', 'unreliable', 'negative']

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length

    if (positiveCount > negativeCount) sentiment = 'positive'
    else if (negativeCount > positiveCount) sentiment = 'negative'
    else sentiment = 'neutral'
  }

  // Extract competitor-like mentions (any proper nouns near the business mention)
  // MVP: return empty array — will improve in Phase 2
  const competitors_mentioned: string[] = []

  return { mentioned, mention_position, sentiment, competitors_mentioned }
}
