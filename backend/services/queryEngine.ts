import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export type Platform = 'openai' | 'anthropic'

export type QueryResult = {
  platform: Platform
  raw_response: string
  error?: string
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

// Wraps a query with context to make it realistic
function buildPrompt(queryText: string): string {
  return `${queryText}

Please provide a helpful, informative response listing relevant businesses, services, or options. Be specific and include business names where appropriate.`
}

export async function runQueryOnPlatforms(
  queryText: string,
  platforms: Platform[]
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

export function getAvailablePlatforms(): Platform[] {
  const platforms: Platform[] = []
  if (process.env.OPENAI_API_KEY) platforms.push('openai')
  if (process.env.ANTHROPIC_API_KEY) platforms.push('anthropic')
  return platforms
}
