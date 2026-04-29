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

export type QueryResult = {
  platform: Platform
  raw_response: string
  error?: string
}

export type QueryContext = {
  location?: string | null
}

async function queryOpenAI(prompt: string): Promise<string> {
  if (!openai) throw new Error('OpenAI API key not configured')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content ?? ''
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

async function queryPerplexity(prompt: string, context?: QueryContext): Promise<string> {
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

  return response.choices[0]?.message?.content ?? ''
}

async function queryAnthropic(prompt: string): Promise<string> {
  if (!anthropic) throw new Error('Anthropic API key not configured')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') return ''
  return block.text
}

async function queryGemini(prompt: string): Promise<string> {
  if (!gemini) throw new Error('Gemini API key not configured')

  const response = await gemini.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      maxOutputTokens: 500,
      temperature: 0.7,
    },
  })

  return response.text ?? ''
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
        const raw_response = await queryOpenAI(prompt)
        return { platform, raw_response }
      } else if (platform === 'anthropic') {
        const raw_response = await queryAnthropic(prompt)
        return { platform, raw_response }
      } else if (platform === 'perplexity') {
        const raw_response = await queryPerplexity(prompt, context)
        return { platform, raw_response }
      } else if (platform === 'gemini') {
        const raw_response = await queryGemini(prompt)
        return { platform, raw_response }
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

Return ONLY valid JSON, no markdown:
{
  "mentioned": true or false,
  "variant_used": "the exact text from the response, or null",
  "position_index": 1-indexed position among all brands/products listed (or null if not mentioned),
  "sentiment": "positive", "neutral", or "negative" based on how the business is portrayed (or null if not mentioned)
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
  }
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
