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

// ─── Tracking sets ───────────────────────────────────────────────────────────

export interface TrackingSetQuery {
  id: string
  query_text: string
  is_active: boolean
  source?: 'generated' | 'custom'
  intent?: string | null
  generation_reason?: string | null
}

export interface TrackingSet {
  id: string
  slot_number: number
  name: string
  first_scanned_at: string | null
  locked_until: string | null
  is_locked: boolean
  days_until_unlock: number
  created_at: string
  queries: TrackingSetQuery[]
}

export interface TrackingSetsResponse {
  sets: TrackingSet[]
  tier: 'free' | 'starter' | 'growth' | 'agency'
  max_sets: number
  can_create_more: boolean
}

export async function getBusinessTrackingSets(
  businessId: string
): Promise<TrackingSetsResponse> {
  const { data } = await authFetch(`/api/business/${businessId}/tracking-sets`)
  return data
}

export async function createTrackingSet(
  businessId: string,
  payload: { name: string; queries: string[] }
): Promise<TrackingSet> {
  const { data } = await authFetch(`/api/business/${businessId}/tracking-sets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function updateTrackingSet(
  setId: string,
  payload: { name?: string; queries?: string[] }
): Promise<TrackingSet> {
  const { data } = await authFetch(`/api/tracking-sets/${setId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data
}

export async function deleteTrackingSet(setId: string): Promise<void> {
  await authFetch(`/api/tracking-sets/${setId}`, { method: 'DELETE' })
}

// ─── Business ────────────────────────────────────────────────────────────────

export interface BusinessWithTrackingSets {
  id: string
  name: string
  location: string | null
  website: string | null
  industry: string | null
  created_at: string
  tracking_sets: TrackingSet[]
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
}): Promise<{ business_id: string; default_set_id: string }> {
  const { data } = await authFetch('/api/business', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function getBusinesses(): Promise<BusinessWithTrackingSets[]> {
  const { data } = await authFetch('/api/business')
  return data
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export async function triggerScan(
  businessId: string,
  trackingSetId?: string
): Promise<{ scan_id: string }> {
  const { data } = await authFetch('/api/scan', {
    method: 'POST',
    body: JSON.stringify({
      business_id: businessId,
      ...(trackingSetId ? { tracking_set_id: trackingSetId } : {}),
    }),
  })
  return data
}

export async function getScanResults(scanId: string) {
  const { data } = await authFetch(`/api/results/${scanId}`)
  return data
}

export async function getBusinessHistory(businessId: string, trackingSetId?: string) {
  const qs = trackingSetId ? `?set_id=${encodeURIComponent(trackingSetId)}` : ''
  const { data } = await authFetch(`/api/results/business/${businessId}${qs}`)
  return data
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

export async function createCheckoutSession(tier: 'starter' | 'growth' | 'agency'): Promise<{ url: string }> {
  const { data } = await authFetch('/api/stripe/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  })
  return data
}

export async function verifyCheckoutSession(sessionId: string): Promise<{
  status: string
  activated: boolean
  tier?: string
}> {
  const { data } = await authFetch('/api/stripe/verify-session', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  })
  return data
}

// ─── Quota ───────────────────────────────────────────────────────────────────

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

// ─── Trends ──────────────────────────────────────────────────────────────────

export interface TrendScanPoint {
  scan_id: string
  visibility_score: number | null
  completed_at: string | null
  started_at: string
  tracking_set_id: string | null
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

export async function getBusinessTrends(
  businessId: string,
  trackingSetId?: string
): Promise<BusinessTrends> {
  const qs = trackingSetId ? `?set_id=${encodeURIComponent(trackingSetId)}` : ''
  const { data } = await authFetch(`/api/results/business/${businessId}/trends${qs}`)
  return data
}
