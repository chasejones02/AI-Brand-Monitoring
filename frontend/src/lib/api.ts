import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL as string

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
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json
}

export async function createBusiness(payload: {
  name: string
  website?: string
  industry?: string
  queries: string[]
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
