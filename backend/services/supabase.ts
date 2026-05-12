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
  location: string | null
  website: string | null
  industry: string | null
  created_at: string
}

export type TrackingSet = {
  id: string
  business_id: string
  slot_number: number
  name: string
  first_scanned_at: string | null
  locked_until: string | null
  created_at: string
}

export type Query = {
  id: string
  business_id: string
  tracking_set_id: string
  query_text: string
  is_active: boolean
  source: 'generated' | 'custom'
  intent: string | null
  generation_reason: string | null
  created_at: string
}

export type Scan = {
  id: string
  business_id: string
  tracking_set_id: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  triggered_by: 'manual' | 'scheduled'
  started_at: string
  completed_at: string | null
}

export const TIER_SET_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  growth: 3,
  agency: 3,
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
  variant_used: string | null
  mention_score: number
  position_score: number
  sentiment_score: number
  created_at: string
}
