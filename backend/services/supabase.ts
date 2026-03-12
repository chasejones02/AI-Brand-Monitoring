import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
}

// Service client — bypasses RLS, backend use only
export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false }
})

// Types matching our schema
export type Profile = {
  id: string
  email: string
  full_name: string | null
  stripe_customer_id: string | null
  subscription_status: 'free' | 'active' | 'canceled' | 'past_due'
  subscription_tier: 'starter' | 'growth' | 'agency'
  created_at: string
}

export type Business = {
  id: string
  user_id: string
  name: string
  website: string | null
  industry: string | null
  created_at: string
}

export type Query = {
  id: string
  business_id: string
  query_text: string
  is_active: boolean
  created_at: string
}

export type Scan = {
  id: string
  business_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  triggered_by: 'manual' | 'scheduled'
  started_at: string
  completed_at: string | null
}

export type ScanResult = {
  id: string
  scan_id: string
  query_id: string
  platform: 'openai' | 'anthropic' | 'perplexity' | 'gemini'
  raw_response: string | null
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
  mention_score: number
  position_score: number
  sentiment_score: number
  created_at: string
}
