import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import 'dotenv/config'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// Perplexity uses an OpenAI-compatible API but searches the web in real-time,
// making it the best platform for finding local/small businesses by name.
const perplexity = process.env.PERPLEXITY_API_KEY
  ? new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
  : null

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null

export type Platform = 'openai' | 'anthropic' | 'perplexity' | 'gemini'

export type Citation = {
  uri: string
  title: string | null
}

export type UsageMetrics = {
  input_tokens: number
  output_tokens: number
  search_calls: number
}

export type QueryResult = {
  platform: Platform
  raw_response: string
  citations?: Citation[]
  usage?: UsageMetrics
  error?: string
}

export type QueryContext = {
  location?: string | null
}

// Live web search via Responses API + web_search tool. gpt-4.1-mini balances
// cost and quality for "list businesses in X" style prompts — gpt-5.5 ran
// ~$0.84/scan in early testing because it's agentic (multiple searches per
// query) and pricey per token. If we see quality regress, step up to
// 'gpt-4.1'. search_context_size: 'low' caps the hidden search-context tokens.
const OPENAI_MODEL = 'gpt-4.1-mini'

async function queryOpenAI(prompt: string): Promise<{ text: string; citations: Citation[]; usage: UsageMetrics }> {
  if (!openai) throw new Error('OpenAI API key not configured')

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    tools: [{ type: 'web_search', search_context_size: 'low' }],
    input: prompt,
  })

  const text = response.output_text ?? ''

  const seen = new Set<string>()
  const citations: Citation[] = []
  let search_calls = 0
  for (const item of response.output ?? []) {
    if (item.type === 'web_search_call') {
      search_calls += 1
      continue
    }
    if (item.type !== 'message') continue
    for (const content of item.content ?? []) {
      if (content.type !== 'output_text') continue
      for (const ann of content.annotations ?? []) {
        if (ann.type !== 'url_citation') continue
        if (seen.has(ann.url)) continue
        seen.add(ann.url)
        citations.push({ uri: ann.url, title: ann.title || null })
        if (citations.length >= 10) break
      }
    }
  }

  return {
    text,
    citations,
    usage: {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      search_calls,
    },
  }
}

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
}

function parseUserLocation(location?: string | null) {
  if (!location) return null
  const [cityRaw, regionRaw] = location.split(',').map(part => part.trim())
  if (!cityRaw) return null
  const region = regionRaw
    ? US_STATE_NAMES[regionRaw.toUpperCase()] ?? regionRaw
    : undefined

  return {
    country: 'US',
    city: cityRaw,
    ...(region ? { region } : {}),
  }
}

async function queryPerplexity(prompt: string, context?: QueryContext): Promise<{ text: string; usage: UsageMetrics }> {
  if (!perplexity) throw new Error('Perplexity API key not configured')

  const userLocation = parseUserLocation(context?.location)
  const request = {
    model: 'sonar',
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant with real-time web search. When answering questions about local businesses, services, or products, prioritize the exact city and state in the user query, include specific named businesses, and do not substitute similarly named cities in other states.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.2,
    ...(userLocation
      ? {
          web_search_options: {
            search_context_size: 'high',
            user_location: userLocation,
          },
        }
      : { web_search_options: { search_context_size: 'medium' } }),
  }

  const response = await perplexity.chat.completions.create({
    ...(request as any),
  } as any)

  // Perplexity bills per request (search built into model), so search_calls = 1.
  return {
    text: response.choices[0]?.message?.content ?? '',
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
      search_calls: 1,
    },
  }
}

async function queryAnthropic(prompt: string): Promise<{ text: string; usage: UsageMetrics }> {
  if (!anthropic) throw new Error('Anthropic API key not configured')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  const text = block?.type === 'text' ? block.text : ''
  return {
    text,
    usage: {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      search_calls: 0,
    },
  }
}

async function queryGemini(prompt: string): Promise<{ text: string; citations: Citation[]; usage: UsageMetrics }> {
  if (!gemini) throw new Error('Gemini API key not configured')

  // Grounding with Google Search — Gemini issues live web queries before
  // synthesizing, which is essential for surfacing small/local businesses
  // that aren't in the training data. Free tier: 1,500 grounded RPD shared
  // across the 2.5 family; paid overage is $35 per 1k grounded prompts.
  // 2.5 bills per grounded prompt, not per query, so search_calls is 0 or 1.
  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  })

  const text = response.text ?? ''
  const groundingMetadata: any = response.candidates?.[0]?.groundingMetadata
  const chunks: any[] = Array.isArray(groundingMetadata?.groundingChunks)
    ? groundingMetadata.groundingChunks
    : []

  const seen = new Set<string>()
  const citations: Citation[] = []
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri
    if (typeof uri !== 'string' || !uri || seen.has(uri)) continue
    seen.add(uri)
    const title = typeof chunk?.web?.title === 'string' ? chunk.web.title : null
    citations.push({ uri, title })
    if (citations.length >= 10) break
  }

  return {
    text,
    citations,
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      search_calls: groundingMetadata ? 1 : 0,
    },
  }
}

// Send the user's query as-is — adding extra instructions changes how the AI responds
// compared to a real user typing the same query, which defeats the purpose of the scan.
function buildPrompt(queryText: string): string {
  return queryText
}

export async function runQueryOnPlatforms(
  queryText: string,
  platforms: Platform[],
  context?: QueryContext
): Promise<QueryResult[]> {
  const prompt = buildPrompt(queryText)

  const results = await Promise.allSettled(
    platforms.map(async (platform): Promise<QueryResult> => {
      if (platform === 'openai') {
        const { text, citations, usage } = await queryOpenAI(prompt)
        return { platform, raw_response: text, citations, usage }
      } else if (platform === 'anthropic') {
        const { text, usage } = await queryAnthropic(prompt)
        return { platform, raw_response: text, usage }
      } else if (platform === 'perplexity') {
        const { text, usage } = await queryPerplexity(prompt, context)
        return { platform, raw_response: text, usage }
      } else if (platform === 'gemini') {
        const { text, citations, usage } = await queryGemini(prompt)
        return { platform, raw_response: text, citations, usage }
      }
      throw new Error(`Unknown platform: ${platform}`)
    })
  )

  return results.map((result, i): QueryResult => {
    if (result.status === 'fulfilled') return result.value
    return {
      platform: platforms[i],
      raw_response: '',
      error: result.reason?.message ?? 'Unknown error',
    }
  })
}

export type MentionAnalysis = {
  mentioned: boolean
  variant_used: string | null       // exact text used in response, e.g. "Google Chrome" when searching "Chrome"
  position_index: number | null     // 1 = first brand mentioned, 2 = second, etc.
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]   // other businesses/brands recommended alongside the target
}

// Uses OpenAI to determine if a business is mentioned in a raw AI response,
// handling name variations, abbreviations, and parent brands automatically.
export async function analyzeMention(
  rawResponse: string,
  businessName: string
): Promise<MentionAnalysis> {
  if (!openai) {
    console.warn('analyzeMention: OpenAI not configured, falling back to string match — results will be less accurate')
    return fallbackMentionAnalysis(rawResponse, businessName)
  }

  const userPrompt = `Business to find: "${businessName}"

AI response to analyze:
"""
${rawResponse}
"""

Does this response mention "${businessName}" or any common variation of it (abbreviations, alternative spellings, parent brand names, compound names like "Google Chrome" for "Chrome")?

Also extract other named businesses, brands, products, or competitors that are recommended, compared, listed, or mentioned as alternatives alongside "${businessName}". Exclude "${businessName}" and its variants. Return at most 8 competitor names, using the exact names from the response.

Return ONLY valid JSON, no markdown:
{
  "mentioned": true or false,
  "variant_used": "the exact text from the response, or null",
  "position_index": 1-indexed position among all brands/products listed (or null if not mentioned),
  "sentiment": "positive", "neutral", or "negative" based on how the business is portrayed (or null if not mentioned),
  "competitors_mentioned": ["competitor name", "another competitor"]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 300,
      temperature: 0,
      response_format: { type: 'json_object' },
    })
    const content = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)

    return {
      mentioned: Boolean(parsed.mentioned),
      variant_used: parsed.variant_used ?? null,
      position_index: typeof parsed.position_index === 'number' ? parsed.position_index : null,
      sentiment: (['positive', 'neutral', 'negative'] as const).includes(parsed.sentiment)
        ? parsed.sentiment
        : parsed.mentioned ? 'neutral' : null,
      competitors_mentioned: normalizeCompetitors(parsed.competitors_mentioned, businessName),
    }
  } catch (err) {
    console.error('analyzeMention failed, falling back to string match:', err)
    return fallbackMentionAnalysis(rawResponse, businessName)
  }
}

function fallbackMentionAnalysis(response: string, businessName: string): MentionAnalysis {
  const lower = response.toLowerCase()
  const nameLower = businessName.toLowerCase()
  const mentioned = lower.includes(nameLower)

  let position_index: number | null = null
  if (mentioned) {
    const sentences = response.split(/[.!?\n]+/).filter(s => s.trim().length > 0)
    const idx = sentences.findIndex(s => s.toLowerCase().includes(nameLower))
    position_index = idx >= 0 ? idx + 1 : 1
  }

  return {
    mentioned,
    variant_used: mentioned ? businessName : null,
    position_index,
    sentiment: mentioned ? 'neutral' : null,
    competitors_mentioned: [],
  }
}

function normalizeCompetitors(value: unknown, businessName: string): string[] {
  if (!Array.isArray(value)) return []
  const target = businessName.trim().toLowerCase()
  const seen = new Set<string>()
  const competitors: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) continue
    const key = name.toLowerCase()
    if (key === target || target.includes(key) || key.includes(target)) continue
    if (seen.has(key)) continue
    seen.add(key)
    competitors.push(name)
    if (competitors.length >= 8) break
  }

  return competitors
}

function isRealKey(key: string | undefined): boolean {
  return !!key && !key.includes('REPLACE') && key.length > 20
}

export function getAvailablePlatforms(): Platform[] {
  const platforms: Platform[] = []
  if (isRealKey(process.env.OPENAI_API_KEY)) platforms.push('openai')
  if (isRealKey(process.env.ANTHROPIC_API_KEY)) platforms.push('anthropic')
  if (isRealKey(process.env.PERPLEXITY_API_KEY)) platforms.push('perplexity')
  if (isRealKey(process.env.GEMINI_API_KEY)) platforms.push('gemini')
  return platforms
}
