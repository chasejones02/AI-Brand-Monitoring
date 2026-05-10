import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL as string

export class ApiError extends Error {
  code?: string
  status: number
  details?: Record<string, unknown>
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const json = await res.json()
  if (!res.ok) {
    const { error, code, ...rest } = json ?? {}
    throw new ApiError(error ?? 'Request failed', res.status, code, rest)
  }
  return json
}

export async function createBusiness(payload: {
  name: string
  location?: string
  description?: string
  website?: string
  industry?: string
  queries?: string[]
  generate_queries?: boolean
  query_count?: number
}): Promise<{ business_id: string }> {
  const { data } = await authFetch('/api/business', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function triggerScan(business_id: string): Promise<{ scan_id: string }> {
  const { data } = await authFetch('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ business_id }),
  })
  return data
}

export async function getScanResults(scanId: string) {
  const { data } = await authFetch(`/api/results/${scanId}`)
  return data
}

export async function getBusinesses() {
  const { data } = await authFetch('/api/business')
  return data
}

export async function getBusinessHistory(businessId: string) {
  const { data } = await authFetch(`/api/results/business/${businessId}`)
  return data
}

export async function updateBusinessQueries(businessId: string, queries: string[]): Promise<{ business_id: string }> {
  const { data } = await authFetch(`/api/business/${businessId}`, {
    method: 'PUT',
    body: JSON.stringify({ queries }),
  })
  return data
}

export async function createCheckoutSession(tier: 'starter' | 'growth' | 'agency'): Promise<{ url: string }> {
  const { data } = await authFetch('/api/stripe/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  })
  return data
}

export interface QuotaStatus {
  tier: 'free' | 'starter' | 'growth' | 'agency'
  daily_limit: number
  used_in_window: number
  remaining: number
  next_reset_at: string | null
}

export async function getQuota(): Promise<QuotaStatus> {
  const { data } = await authFetch('/api/quota')
  return data
}

export interface TrendScanPoint {
  scan_id: string
  visibility_score: number | null
  completed_at: string | null
  started_at: string
}

export interface TrendPlatformPoint {
  scan_id: string
  score: number
}

export interface TrendQueryPoint {
  scan_id: string
  mentioned: boolean
  mention_position: number | null
  total_score: number
}

export interface BusinessTrends {
  scans: TrendScanPoint[]
  by_platform: Record<string, TrendPlatformPoint[]>
  by_query: Array<{
    query_id: string
    query_text: string
    points: TrendQueryPoint[]
  }>
}

export async function getBusinessTrends(businessId: string): Promise<BusinessTrends> {
  const { data } = await authFetch(`/api/results/business/${businessId}/trends`)
  return data
}
