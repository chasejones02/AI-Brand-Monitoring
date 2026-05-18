/**
 * Dashboard — full product dashboard.
 *
 * States:
 *   loading  → fetching businesses on mount
 *   setup    → no business found, show setup form
 *   main     → has businesses; sub-modes: results | new-scan | no-scans
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { GlowCard } from '../components/ui/spotlight-card'
import { TiltCard } from '../components/ui/tilt-card'
import { CrystalCursor } from '../components/crystal-cursor'
import { QuotaPill } from '../components/quota-pill'
import { HistoryTrendsSection } from '../components/history-trends-section'
import { TrendChart } from '../components/trend-chart'
import { TrackingSetTabs } from '../components/tracking-set-tabs'
import { TrackingSetEditor, type EditorMode } from '../components/tracking-set-editor'
import { QueryAccordion } from '../components/query-accordion'
import { RecommendationsPanel } from '../components/recommendations-panel'
import {
  getBusinesses,
  getBusinessHistory,
  getScanResults,
  createBusiness,
  triggerScan,
  getQuota,
  getBusinessTrends,
  getBusinessTrackingSets,
  createTrackingSet,
  updateTrackingSet,
  deleteTrackingSet,
  ApiError,
  type QuotaStatus,
  type BusinessTrends,
  type TrackingSet,
  type TrackingSetQuery,
  type BusinessWithTrackingSets,
  type BusinessesResponse,
} from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
  variant_used: string | null
  raw_response: string | null
  scores: { mention: number; position: number; sentiment: number; total: number; max: number }
}

interface QueryResult {
  query_id: string
  query_text: string
  source?: 'generated' | 'custom'
  intent?: string | null
  generation_reason?: string | null
  platforms: Record<string, PlatformResult>
}

interface ScoreDetails {
  formula_version: string
  formula: string
  result_count: number
  mentioned_results: number
  sentiment_counts: { positive: number; neutral: number; negative: number }
  max_per_result: number
  max_points: number
  earned_points: number
  mention_points: number
  position_points: number
  sentiment_points: number
}

export interface Recommendation {
  priority: number
  title: string
  body: string | null
  impact: 'high' | 'medium' | 'low'
  platform: 'all' | 'perplexity' | 'openai' | 'anthropic' | 'gemini'
  locked?: boolean
}

interface ScanData {
  scan_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  business_name: string
  started_at: string
  completed_at: string | null
  score_details?: ScoreDetails
  tracking_set_id?: string | null
  tracking_set_slot?: number | null
  tracking_set_name?: string | null
  results: QueryResult[]
  recommendations?: Recommendation[]
  tier?: string
}

interface ScanSummary {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  triggered_by: string
  started_at: string
  completed_at: string | null
}

type AppState = 'loading' | 'setup' | 'main'
type MainMode = 'results' | 'no-scans'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
}

const PLATFORM_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97706',
  gemini: '#4285f4',
  perplexity: '#7c3aed',
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--accent)'
  return 'var(--red)'
}

function formatScanLabel(scan: ScanSummary): string {
  const date = new Date(scan.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (scan.status === 'running' || scan.status === 'pending') return `${date} · Running…`
  if (scan.status === 'failed') return `${date} · Failed`
  const score = scan.visibility_score != null ? `Score ${Math.round(scan.visibility_score)}` : 'No score'
  return `${date} · ${score}`
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

// Lowest mention_position seen across every (query, platform) pair in the
// scan. Used to surface "best position #N" as a quick-read indicator that
// matches the score explanation, instead of showing raw point math.
function bestMentionPosition(results: QueryResult[]): number | null {
  let best: number | null = null
  for (const r of results) {
    for (const platform of Object.keys(r.platforms)) {
      const pr = r.platforms[platform]
      if (pr?.mentioned && pr.mention_position != null) {
        if (best == null || pr.mention_position < best) best = pr.mention_position
      }
    }
  }
  return best
}

function sentimentSummary(counts: ScoreDetails['sentiment_counts']) {
  const total = counts.positive + counts.neutral + counts.negative
  if (total === 0) return 'No sentiment detected yet.'
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const label = dominant[0]
  const count = dominant[1]
  return `${pluralize(count, label)} mention${count === 1 ? '' : 's'} led the scan.`
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [appState, setAppState] = useState<AppState>('loading')
  const [businesses, setBusinesses] = useState<BusinessWithTrackingSets[]>([])
  const [activeBusiness, setActiveBusiness] = useState<BusinessWithTrackingSets | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanSummary[]>([])
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const [mode, setMode] = useState<MainMode>('no-scans')

  const [scan, setScan] = useState<ScanData | null>(null)
  const [scanError, setScanError] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const [globalError, setGlobalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [trendsRefreshKey, setTrendsRefreshKey] = useState(0)
  const [trends, setTrends] = useState<BusinessTrends | null>(null)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState('')

  // Tracking-set state. trackingSets is the source of truth for the tab strip
  // and active set selection; the queries on activeBusiness.tracking_sets are
  // a snapshot from the initial getBusinesses() call and may be slightly stale.
  const [trackingSets, setTrackingSets] = useState<TrackingSet[]>([])
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [maxSets, setMaxSets] = useState(1)
  const [canCreateMore, setCanCreateMore] = useState(false)
  const [tier, setTier] = useState<'free' | 'starter' | 'growth' | 'agency'>('free')
  const [canAddBusiness, setCanAddBusiness] = useState(false)
  const [maxBusinesses, setMaxBusinesses] = useState(1)
  const [showAddBusiness, setShowAddBusiness] = useState(false)

  // Set editor modal state — covers both create (new tab) and edit (unlocked set).
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null)
  const [editorError, setEditorError] = useState('')

  const [cursorActive, setCursorActive] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setCursorActive(true), 700)
    return () => clearTimeout(t)
  }, [])

  const refreshQuota = useCallback(async (setId?: string) => {
    try {
      const q = await getQuota(setId ?? activeSetId ?? undefined)
      setQuota(q)
    } catch {
      // Non-fatal — pill just hides if quota fails to load.
    }
  }, [activeSetId])

  const applyBusinessesResponse = useCallback((raw: BusinessesResponse) => {
    const bizList = raw.businesses ?? []
    setBusinesses(bizList)
    setCanAddBusiness(raw.can_add_more ?? false)
    setMaxBusinesses(raw.max_businesses ?? 1)
    return bizList
  }, [])

  const refreshTrackingSets = useCallback(async (businessId: string): Promise<TrackingSet[]> => {
    try {
      const resp = await getBusinessTrackingSets(businessId)
      setTrackingSets(resp.sets)
      setMaxSets(resp.max_sets)
      setCanCreateMore(resp.can_create_more)
      setTier(resp.tier)
      return resp.sets
    } catch {
      return []
    }
  }, [])

  const activeSet = trackingSets.find(s => s.id === activeSetId) ?? null

  // Trends fetch — scoped to the active tracking set so the chart only shows
  // apples-to-apples comparisons. Re-runs when the active set, the active
  // business, or the refresh key change.
  useEffect(() => {
    if (!activeBusiness || !activeSetId) {
      setTrends(null)
      return
    }
    let cancelled = false
    setTrendsLoading(true)
    setTrendsError('')
    getBusinessTrends(activeBusiness.id, activeSetId)
      .then(data => {
        if (cancelled) return
        setTrends(data)
        setTrendsLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setTrendsError(err.message ?? 'Failed to load trends')
        setTrendsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeBusiness, activeSetId, trendsRefreshKey])

  const MAX_POLLS = 120 // ~6 minutes at 3s intervals — defense-in-depth beyond backend timeout
  const isTerminalStatus = scan?.status === 'completed' || scan?.status === 'failed'
  const isRunning = !!(
    activeScanId &&
    !scanError &&
    !isTerminalStatus &&
    pollCount < MAX_POLLS &&
    (!scan || scan.status === 'pending' || scan.status === 'running')
  )
  const pollTimedOut = !!(activeScanId && !isTerminalStatus && !scanError && pollCount >= MAX_POLLS)

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const urlScanId = searchParams.get('scanId')
    const urlSetId = searchParams.get('setId')
    async function init() {
      try {
        const raw = await getBusinesses()
        const bizList = applyBusinessesResponse(raw)
        if (bizList.length === 0) {
          setAppState('setup')
          return
        }
        const biz = bizList[0]
        setActiveBusiness(biz)

        const sets = await refreshTrackingSets(biz.id)
        const initialSetId =
          (urlSetId && sets.some(s => s.id === urlSetId) ? urlSetId : null) ??
          sets[0]?.id ??
          null
        setActiveSetId(initialSetId)
        refreshQuota(initialSetId ?? undefined)

        const histData = await getBusinessHistory(biz.id, initialSetId ?? undefined)
        const scans: ScanSummary[] = histData?.scans ?? []
        setScanHistory(scans)

        if (scans.length === 0) {
          setMode('no-scans')
        } else {
          const targetId =
            urlScanId && scans.some(s => s.id === urlScanId) ? urlScanId : scans[0].id
          setActiveScanId(targetId)
          setMode('results')
        }
        setAppState('main')
      } catch (err: any) {
        setGlobalError(err.message ?? 'Failed to load dashboard')
        setAppState('main')
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch + poll ──────────────────────────────────────────────────────────
  const activeScanIdRef = useRef<string | null>(null)
  useEffect(() => { activeScanIdRef.current = activeScanId }, [activeScanId])

  const fetchScan = useCallback(async (scanId: string) => {
    try {
      const data = await getScanResults(scanId)
      // Guard against late responses after the user moved to a different scan
      if (activeScanIdRef.current !== scanId) return
      setScan(data)
      if (data.status === 'completed' || data.status === 'failed') {
        setScanError('')
        setScanHistory(prev =>
          prev.map(s =>
            s.id === scanId
              ? { ...s, status: data.status, visibility_score: data.visibility_score, completed_at: data.completed_at }
              : s
          )
        )
        if (data.status === 'completed') {
          // A completed scan changes the trend chart and consumes a quota slot.
          setTrendsRefreshKey(k => k + 1)
          refreshQuota()
        }
      }
    } catch (err: any) {
      if (activeScanIdRef.current !== scanId) return
      setScanError(err.message ?? 'Failed to load results')
      // Mark the history entry as failed so the dropdown label reflects reality
      setScanHistory(prev =>
        prev.map(s => (s.id === scanId ? { ...s, status: 'failed' as const } : s))
      )
    }
  }, [refreshQuota])

  useEffect(() => {
    if (!activeScanId) return
    setScan(null)
    setScanError('')
    setPollCount(0)
    fetchScan(activeScanId)
  }, [activeScanId, fetchScan])

  useEffect(() => {
    if (!isRunning || !activeScanId) return
    const timer = setTimeout(() => {
      fetchScan(activeScanId)
      setPollCount(c => c + 1)
    }, 3000)
    return () => clearTimeout(timer)
  }, [isRunning, pollCount, activeScanId, fetchScan])

  // ── Business change ────────────────────────────────────────────────────────
  async function handleBusinessChange(bizId: string) {
    const biz = businesses.find(b => b.id === bizId)
    if (!biz) return
    setActiveBusiness(biz)
    setScan(null)
    setActiveScanId(null)
    setScanError('')
    setScanHistory([])
    setTrackingSets([])
    setActiveSetId(null)
    try {
      const sets = await refreshTrackingSets(biz.id)
      const firstSetId = sets[0]?.id ?? null
      setActiveSetId(firstSetId)
      const histData = await getBusinessHistory(biz.id, firstSetId ?? undefined)
      const scans: ScanSummary[] = histData?.scans ?? []
      setScanHistory(scans)
      if (scans.length === 0) {
        setMode('no-scans')
      } else {
        setActiveScanId(scans[0].id)
        setMode('results')
      }
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to load business data')
    }
  }

  // ── Set change ────────────────────────────────────────────────────────────
  // Switching tabs swaps in this set's scan history + trend. Each set has
  // its own independent timeline.
  async function handleSetChange(setId: string) {
    if (!activeBusiness || setId === activeSetId) return
    setActiveSetId(setId)
    setScan(null)
    setActiveScanId(null)
    setScanError('')
    setScanHistory([])
    refreshQuota(setId)
    try {
      const histData = await getBusinessHistory(activeBusiness.id, setId)
      const scans: ScanSummary[] = histData?.scans ?? []
      setScanHistory(scans)
      if (scans.length === 0) {
        setMode('no-scans')
      } else {
        setActiveScanId(scans[0].id)
        setMode('results')
      }
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to load set data')
    }
  }

  // ── Scan select ────────────────────────────────────────────────────────────
  function handleScanSelect(scanId: string) {
    setActiveScanId(scanId)
    setMode('results')
  }

  // ── Run scan ───────────────────────────────────────────────────────────────
  // Tracking-set model: queries are locked at the set level, so "run scan"
  // is a single button that scans the active set's existing queries. No more
  // edit-then-scan combined flow.
  async function handleRunScan() {
    if (!activeBusiness || !activeSetId || isSubmitting) return
    setIsSubmitting(true)
    setActiveScanId(null)
    setScan(null)
    setScanError('')
    setPollCount(0)
    try {
      const { scan_id } = await triggerScan(activeBusiness.id, activeSetId)
      try {
        const histData = await getBusinessHistory(activeBusiness.id, activeSetId)
        setScanHistory(histData?.scans ?? [])
      } catch {
        setScanHistory(prev => [{
          id: scan_id,
          status: 'running',
          visibility_score: null,
          triggered_by: 'manual',
          started_at: new Date().toISOString(),
          completed_at: null,
        }, ...prev])
      }
      setActiveScanId(scan_id)
      setMode('results')
      // First scan of a set starts the 30-day lock — refresh the set metadata
      // so the tab's lock chip lights up immediately.
      refreshTrackingSets(activeBusiness.id)
      refreshQuota()
      setTrendsRefreshKey(k => k + 1)
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'subscription_required') {
        navigate('/pricing')
        return
      }
      if (err instanceof ApiError && err.code === 'daily_quota_exceeded') {
        refreshQuota()
        setScanError(err.message)
        setMode(scanHistory.length > 0 ? 'results' : 'no-scans')
        return
      }
      setScanError(err.message ?? 'Failed to start scan')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Tracking-set CRUD ─────────────────────────────────────────────────────
  function openCreateEditor() {
    if (!canCreateMore) {
      navigate('/pricing')
      return
    }
    setEditorError('')
    setEditorMode({ kind: 'create' })
  }

  function openEditEditor() {
    if (!activeSet) return
    if (activeSet.is_locked) return
    setEditorError('')
    setEditorMode({ kind: 'edit', set: activeSet })
  }

  function closeEditor() {
    if (isSubmitting) return
    setEditorMode(null)
    setEditorError('')
  }

  async function handleEditorSubmit(payload: { name: string; queries: string[] }) {
    if (!activeBusiness || !editorMode) return
    setIsSubmitting(true)
    setEditorError('')
    try {
      if (editorMode.kind === 'create') {
        const created = await createTrackingSet(activeBusiness.id, payload)
        await refreshTrackingSets(activeBusiness.id)
        setActiveSetId(created.id)
        setScanHistory([])
        setActiveScanId(null)
        setScan(null)
        setMode('no-scans')
      } else {
        await updateTrackingSet(editorMode.set.id, payload)
        await refreshTrackingSets(activeBusiness.id)
        setTrendsRefreshKey(k => k + 1)
      }
      setEditorMode(null)
    } catch (err: any) {
      setEditorError(err.message ?? 'Failed to save tracking set')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRename(setId: string, name: string) {
    if (!activeBusiness) return
    try {
      await updateTrackingSet(setId, { name })
      await refreshTrackingSets(activeBusiness.id)
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to rename set')
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!activeBusiness) return
    const target = trackingSets.find(s => s.id === setId)
    if (!target || target.slot_number === 1) return
    const ok = window.confirm(
      `Delete "${target.name}"? All scans and queries in this set will be permanently removed.`
    )
    if (!ok) return
    try {
      await deleteTrackingSet(setId)
      const remaining = await refreshTrackingSets(activeBusiness.id)
      const newActive = remaining[0]?.id ?? null
      setActiveSetId(newActive)
      if (newActive) {
        const histData = await getBusinessHistory(activeBusiness.id, newActive)
        setScanHistory(histData?.scans ?? [])
        if (histData?.scans?.length) {
          setActiveScanId(histData.scans[0].id)
          setMode('results')
        } else {
          setMode('no-scans')
        }
      }
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to delete set')
    }
  }

  // ── Setup submit ───────────────────────────────────────────────────────────
  async function handleSetupSubmit(
    name: string,
    website: string,
    industry: string,
    queries: string[]
  ) {
    setIsSubmitting(true)
    try {
      const { business_id, default_set_id } = await createBusiness({
        name,
        website: website || undefined,
        industry: industry || undefined,
        queries,
      })
      const { scan_id } = await triggerScan(business_id, default_set_id)
      const raw = await getBusinesses()
      const bizList = applyBusinessesResponse(raw)
      const newBiz = bizList.find(b => b.id === business_id) ?? bizList[0]
      setActiveBusiness(newBiz)
      await refreshTrackingSets(business_id)
      setActiveSetId(default_set_id)
      const newEntry: ScanSummary = {
        id: scan_id,
        status: 'running',
        visibility_score: null,
        triggered_by: 'manual',
        started_at: new Date().toISOString(),
        completed_at: null,
      }
      setScanHistory([newEntry])
      setActiveScanId(scan_id)
      setScan(null)
      setScanError('')
      setPollCount(0)
      setMode('results')
      setAppState('main')
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to set up business')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Add additional business (Growth users) ────────────────────────────────
  async function handleAddBusiness(name: string, website: string, industry: string, queries: string[]) {
    setIsSubmitting(true)
    setGlobalError('')
    try {
      const { business_id, default_set_id } = await createBusiness({
        name,
        website: website || undefined,
        industry: industry || undefined,
        queries,
      })
      const raw = await getBusinesses()
      const bizList = applyBusinessesResponse(raw)
      const newBiz = bizList.find(b => b.id === business_id) ?? bizList[0]
      setActiveBusiness(newBiz)
      const sets = await refreshTrackingSets(business_id)
      setActiveSetId(default_set_id ?? sets[0]?.id ?? null)
      setScanHistory([])
      setScan(null)
      setActiveScanId(null)
      setScanError('')
      setMode('no-scans')
      setShowAddBusiness(false)
    } catch (err: any) {
      setGlobalError(err.message ?? 'Failed to create business')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (appState === 'loading') {
    return (
      <div style={s.page}>
        <div style={s.loadingScreen}>
          <div style={s.loadingSpinner} />
          <p style={s.loadingText}>Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (showAddBusiness) {
    return (
      <div style={s.page}>
        <CrystalCursor active={cursorActive} />
        <DashboardNav
          email={user?.email}
          onSignOut={signOut}
          businesses={businesses}
          activeBusiness={activeBusiness}
          onBusinessChange={handleBusinessChange}
          scanHistory={[]}
          activeScanId={null}
          onScanSelect={() => {}}
          onNewScan={() => {}}
          quota={null}
          canAddBusiness={false}
          onAddBusiness={() => {}}
          businessCount={businesses.length}
          maxBusinesses={maxBusinesses}
        />
        <BusinessSetupForm
          title={`Add business (${businesses.length + 1} of ${maxBusinesses})`}
          onSubmit={handleAddBusiness}
          onCancel={() => { setShowAddBusiness(false); setGlobalError('') }}
          isSubmitting={isSubmitting}
          error={globalError}
        />
      </div>
    )
  }

  if (appState === 'setup') {
    return (
      <div style={s.page}>
        <nav style={s.nav}>
          <span style={s.navLogo}>
            <img src="/logo-eye.png" alt="Visaion" style={{ height: '40px', width: 'auto', display: 'block' }} />
            <span>Vis<span style={{ color: 'var(--accent)' }}>ai</span>on</span>
          </span>
          <div style={s.navRight}>
            {user?.email && <span style={s.navEmail}>{user.email}</span>}
            <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
          </div>
        </nav>
        <BusinessSetupForm
          onSubmit={handleSetupSubmit}
          isSubmitting={isSubmitting}
          error={globalError}
        />
      </div>
    )
  }

  const setEditDisabledReason = activeSet?.is_locked
    ? `Editable in ${activeSet.days_until_unlock} ${activeSet.days_until_unlock === 1 ? 'day' : 'days'}`
    : null

  return (
    <div style={s.page}>
      <CrystalCursor active={cursorActive} />

      <DashboardNav
        email={user?.email}
        onSignOut={signOut}
        businesses={businesses}
        activeBusiness={activeBusiness}
        onBusinessChange={handleBusinessChange}
        scanHistory={scanHistory}
        activeScanId={activeScanId}
        onScanSelect={handleScanSelect}
        onNewScan={handleRunScan}
        quota={quota}
        canAddBusiness={canAddBusiness}
        onAddBusiness={() => setShowAddBusiness(true)}
        businessCount={businesses.length}
        maxBusinesses={maxBusinesses}
      />

      {globalError && (
        <div style={s.errorBanner}>
          <span>{globalError}</span>
          <button onClick={() => setGlobalError('')} style={s.errorDismiss}>×</button>
        </div>
      )}

      {activeBusiness && trackingSets.length > 0 && (
        <div style={s.setTabsWrap}>
          <TrackingSetTabs
            sets={trackingSets}
            activeSetId={activeSetId}
            maxSets={maxSets}
            canCreateMore={canCreateMore}
            tier={tier}
            onSelect={handleSetChange}
            onAddSet={openCreateEditor}
            onRename={handleRename}
            onDeleteRequest={handleDeleteSet}
          />

          {activeSet && (
            <div style={s.setActions}>
              <div style={s.setActionsMeta}>
                {activeSet.is_locked ? (
                  <>
                    <span style={{ ...s.setMetaDot, background: 'var(--text-dim)' }} />
                    <span>
                      Queries locked · {activeSet.days_until_unlock}{' '}
                      {activeSet.days_until_unlock === 1 ? 'day' : 'days'} remaining
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ ...s.setMetaDot, background: 'var(--accent)' }} />
                    <span>
                      {activeSet.first_scanned_at
                        ? 'Editable — next scan will start a fresh 30-day window.'
                        : 'Queries will lock for 30 days on first scan.'}
                    </span>
                  </>
                )}
              </div>

              <div style={s.setActionsBtns}>
                <button
                  type="button"
                  onClick={openEditEditor}
                  disabled={!!setEditDisabledReason}
                  title={setEditDisabledReason ?? 'Edit queries in this set'}
                  style={{
                    ...s.secondaryBtn,
                    opacity: setEditDisabledReason ? 0.45 : 1,
                    cursor: setEditDisabledReason ? 'not-allowed' : 'pointer',
                  }}
                >
                  Edit queries
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'no-scans' && (
        <NoScansState
          businessName={activeBusiness?.name}
          setName={activeSet?.name ?? null}
          queries={activeSet?.queries ?? []}
          onNewScan={handleRunScan}
          onEdit={openEditEditor}
          editDisabled={!!setEditDisabledReason}
          editDisabledReason={setEditDisabledReason ?? null}
          isRunning={isSubmitting}
          showWelcome={searchParams.get('welcome') === '1'}
          tier={tier}
        />
      )}

      {mode === 'results' && (
        <>
          {trends && trends.scans.length >= 2 && (
            <div style={{ ...s.content, paddingBottom: '0.5rem' }}>
              <TrendChart
                scans={trends.scans}
                title={`${activeSet?.name ?? 'Set'} · visibility trend`}
              />
            </div>
          )}
          <ScanResultsView
            scan={scan}
            scanError={scanError}
            isRunning={isRunning}
            pollTimedOut={pollTimedOut}
            activeScanId={activeScanId}
            activeSet={activeSet}
            onNewScan={handleRunScan}
            onRetry={handleRunScan}
            isRetrying={isSubmitting}
          />
          {activeBusiness && scan?.status === 'completed' && scanHistory.length > 0 && (
            <div style={s.content}>
              <HistoryTrendsSection
                trends={trends}
                trendsLoading={trendsLoading}
                trendsError={trendsError}
                scanHistory={scanHistory}
                activeScanId={activeScanId}
                onScanSelect={handleScanSelect}
              />
            </div>
          )}
        </>
      )}

      <TrackingSetEditor
        open={editorMode != null}
        mode={editorMode ?? { kind: 'create' }}
        onCancel={closeEditor}
        onSubmit={handleEditorSubmit}
        isSubmitting={isSubmitting}
        error={editorError}
      />
    </div>
  )
}

// ─── DashboardNav ─────────────────────────────────────────────────────────────

interface DashboardNavProps {
  email?: string
  onSignOut: () => void
  businesses: BusinessWithTrackingSets[]
  activeBusiness: BusinessWithTrackingSets | null
  onBusinessChange: (id: string) => void
  scanHistory: ScanSummary[]
  activeScanId: string | null
  onScanSelect: (id: string) => void
  onNewScan: () => void
  quota: QuotaStatus | null
  canAddBusiness: boolean
  onAddBusiness: () => void
  businessCount: number
  maxBusinesses: number
}

function DashboardNav({
  email,
  onSignOut,
  businesses,
  activeBusiness,
  onBusinessChange,
  scanHistory,
  activeScanId,
  onScanSelect,
  onNewScan,
  quota,
  canAddBusiness,
  onAddBusiness,
  businessCount,
  maxBusinesses,
}: DashboardNavProps) {
  const quotaExhausted = !!quota && quota.remaining <= 0
  return (
    <nav style={s.nav}>
      <div style={s.navLeft}>
        <Link to="/" style={s.navLogo}>
          <img src="/logo-eye.png" alt="Visaion" style={{ height: '40px', width: 'auto', display: 'block' }} />
          <span>Vis<span style={{ color: 'var(--accent)' }}>ai</span>on</span>
        </Link>

        {activeBusiness && (
          <>
            <span style={s.navDivider}>|</span>
            {businesses.length <= 1 ? (
              <span style={s.navBusinessName}>{activeBusiness.name}</span>
            ) : (
              <select
                style={s.navSelect}
                value={activeBusiness.id}
                onChange={e => onBusinessChange(e.target.value)}
              >
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {canAddBusiness && (
              <button
                onClick={onAddBusiness}
                style={s.addBizBtn}
                title={`Add business (${businessCount} of ${maxBusinesses})`}
              >
                + Add business
              </button>
            )}
          </>
        )}
      </div>

      <div style={s.navRight}>
        <QuotaPill quota={quota} />
        {scanHistory.length > 0 && (
          <select
            style={{ ...s.navSelect, maxWidth: '200px' }}
            value={activeScanId ?? ''}
            onChange={e => onScanSelect(e.target.value)}
          >
            {scanHistory.map(scan => (
              <option key={scan.id} value={scan.id}>
                {formatScanLabel(scan)}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={onNewScan}
          disabled={quotaExhausted}
          style={{
            ...s.newScanBtn,
            opacity: quotaExhausted ? 0.5 : 1,
            cursor: quotaExhausted ? 'not-allowed' : 'pointer',
          }}
          title={quotaExhausted ? 'Daily scan limit reached' : 'Run a new scan on this set'}
        >
          {quotaExhausted ? 'Quota reached' : '+ Run scan'}
        </button>
        {email && <Link to="/account" style={s.navEmail}>{email}</Link>}
        <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
      </div>
    </nav>
  )
}

// ─── BusinessSetupForm ────────────────────────────────────────────────────────

interface SetupFormProps {
  onSubmit: (name: string, website: string, industry: string, queries: string[]) => void
  onCancel?: () => void
  isSubmitting: boolean
  error: string
  title?: string
}

function BusinessSetupForm({ onSubmit, onCancel, isSubmitting, error, title }: SetupFormProps) {
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [queries, setQueries] = useState([''])
  const [formError, setFormError] = useState('')

  function addQuery() {
    if (queries.length < 10) setQueries(prev => [...prev, ''])
  }
  function removeQuery(i: number) {
    if (queries.length > 1) setQueries(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateQuery(i: number, val: string) {
    setQueries(prev => prev.map((q, idx) => (idx === i ? val : q)))
  }

  function handleSubmit() {
    const trimName = name.trim()
    if (!trimName) { setFormError('Company name is required'); return }
    const validQueries = queries.map(q => q.trim()).filter(q => q.length >= 3)
    if (validQueries.length === 0) { setFormError('Add at least one query (3+ characters)'); return }
    setFormError('')
    onSubmit(trimName, website.trim(), industry.trim(), validQueries)
  }

  return (
    <div style={s.formPage}>
      <div style={s.formCard}>
        <div style={s.formCardHeader}>
          {onCancel && (
            <button onClick={onCancel} style={s.formCancelBtn}>
              ← Back
            </button>
          )}
          <p style={s.eyebrow}>{title ? 'Business profile' : 'Welcome'}</p>
          <h1 style={s.formCardTitle}>{title ?? 'Set up your business'}</h1>
          <p style={s.formCardSubtitle}>
            Tell us about your company so we can track how AI platforms mention you.
          </p>
        </div>

        <div style={s.formBody}>
          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>
              Company name <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Acme Inc."
              value={name}
              onChange={e => setName(e.target.value)}
              style={s.input}
              autoFocus
            />
          </div>

          <div style={s.fieldRow}>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>
                Website <span style={s.fieldOptional}>(optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                style={s.input}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>
                Industry <span style={s.fieldOptional}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SaaS, Local Services"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={s.input}
              />
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>
              Target queries{' '}
              <span style={s.fieldOptional}>— what would customers search to find you?</span>
            </label>
            <div style={s.queryInputList}>
              {queries.map((q, i) => (
                <div key={i} style={s.queryInputRow}>
                  <span style={s.queryRowNum}>{i + 1}</span>
                  <input
                    type="text"
                    placeholder={`e.g. best ${industry || 'software'} for small business`}
                    value={q}
                    onChange={e => updateQuery(i, e.target.value)}
                    style={{ ...s.input, flex: 1, marginBottom: 0 }}
                  />
                  {queries.length > 1 && (
                    <button onClick={() => removeQuery(i)} style={s.removeBtn}>×</button>
                  )}
                </div>
              ))}
            </div>
            {queries.length < 10 && (
              <button onClick={addQuery} style={s.addBtn}>+ Add another query</button>
            )}
          </div>

          {(formError || error) && (
            <p style={s.formError}>{formError || error}</p>
          )}

          <GlowCard customSize radius={8} className="!block !p-0 !shadow-none">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ ...s.primaryBtn, opacity: isSubmitting ? 0.6 : 1 }}
            >
              {isSubmitting ? 'Setting up…' : 'Start monitoring →'}
            </button>
          </GlowCard>
        </div>
      </div>
    </div>
  )
}

// ─── NoScansState ─────────────────────────────────────────────────────────────
// Empty state shown when a tracking set has no scans yet. The CTA fires a
// scan against the set directly — no more intermediate "edit queries" step,
// since edit is gated by the set's lock state and lives in its own modal.

function NoScansState({
  businessName,
  setName,
  queries,
  onNewScan,
  onEdit,
  editDisabled,
  editDisabledReason,
  isRunning,
  showWelcome,
  tier,
}: {
  businessName?: string
  setName: string | null
  queries: TrackingSetQuery[]
  onNewScan: () => void
  onEdit: () => void
  editDisabled: boolean
  editDisabledReason: string | null
  isRunning: boolean
  showWelcome: boolean
  tier: 'free' | 'starter' | 'growth' | 'agency'
}) {
  const hasQueries = queries.length > 0
  const tierLabel = tier === 'free' ? 'Free' : tier[0].toUpperCase() + tier.slice(1)

  return (
    <div style={hasQueries ? s.noScansWide : s.emptyState}>
      {showWelcome && (
        <div style={s.welcomeBanner}>
          <span style={s.welcomeCheck} aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span>
            You're on <strong>{tierLabel}</strong>. Edit any of these queries before your first scan — or run them as-is.
          </span>
        </div>
      )}

      <p style={s.emptyTitle}>
        {setName
          ? `No scans yet for "${setName}"`
          : businessName
          ? `No scans yet for ${businessName}`
          : 'No scans yet'}
      </p>
      <p style={s.emptyText}>
        Run your first scan to see how AI platforms mention your business for
        the queries in this set. The set locks for 30 days after the first scan
        so your trend stays apples-to-apples.
      </p>

      {hasQueries && (
        <div style={s.queriesPreview}>
          <div style={s.queriesPreviewHeader}>
            <span style={s.queriesPreviewLabel}>
              Your queries · {queries.length}
            </span>
            <button
              type="button"
              onClick={onEdit}
              disabled={editDisabled}
              title={editDisabledReason ?? 'Edit these queries'}
              style={{
                ...s.queriesPreviewEdit,
                opacity: editDisabled ? 0.45 : 1,
                cursor: editDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit
            </button>
          </div>
          <ol style={s.queriesPreviewList}>
            {queries.map((q, i) => (
              <li key={q.id} style={s.queriesPreviewItem}>
                <span style={s.queriesPreviewIdx}>{String(i + 1).padStart(2, '0')}</span>
                <span style={s.queriesPreviewText}>{q.query_text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <GlowCard customSize radius={8} className="!block !p-0 !shadow-none">
        <button onClick={onNewScan} disabled={isRunning} style={s.primaryBtn}>
          {isRunning ? 'Starting scan…' : 'Run first scan →'}
        </button>
      </GlowCard>
    </div>
  )
}

// ─── ScanResultsView ──────────────────────────────────────────────────────────

function ScanResultsView({
  scan,
  scanError,
  isRunning,
  pollTimedOut,
  activeScanId,
  activeSet,
  onNewScan,
  onRetry,
  isRetrying,
}: {
  scan: ScanData | null
  scanError: string
  isRunning: boolean
  pollTimedOut: boolean
  activeScanId: string | null
  activeSet: TrackingSet | null
  onNewScan: () => void
  onRetry: () => void
  isRetrying: boolean
}) {
  if (scanError) {
    const lower = scanError.toLowerCase()
    const isSub = lower.includes('subscription')
    const isQuota = lower.includes('daily scan limit') || lower.includes('quota')
    return (
      <div style={s.emptyState}>
        {isSub ? (
          <>
            <p style={s.emptyTitle}>Upgrade to run scans</p>
            <p style={s.emptyText}>
              You've used your free scan. Subscribe to run daily scans across
              ChatGPT, Claude, Gemini, and Perplexity.
            </p>
            <Link
              to="/pricing"
              style={{ ...s.primaryBtn, textDecoration: 'none', display: 'inline-block', textAlign: 'center' as const }}
            >
              View pricing →
            </Link>
          </>
        ) : isQuota ? (
          <>
            <p style={s.emptyTitle}>Daily scan limit reached</p>
            <p style={s.emptyText}>
              You've used today's scans for this plan. Your next slot opens in the
              next 24 hours — see the quota indicator at the top of the page for the
              exact time. Need more? Upgrade for higher daily limits.
            </p>
            <Link
              to="/pricing"
              style={{ ...s.primaryBtn, textDecoration: 'none', display: 'inline-block', textAlign: 'center' as const }}
            >
              See plans →
            </Link>
          </>
        ) : (
          <>
            <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Error loading results</p>
            <p style={s.emptyText}>{scanError}</p>
            <button onClick={onRetry} disabled={isRetrying} style={s.primaryBtn}>
              {isRetrying ? 'Starting…' : 'Try again →'}
            </button>
          </>
        )}
      </div>
    )
  }

  if (pollTimedOut) {
    return (
      <div style={s.emptyState}>
        <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Scan timed out</p>
        <p style={s.emptyText}>
          This scan is taking longer than expected. You can start a new one.
        </p>
        <button onClick={onRetry} disabled={isRetrying} style={s.primaryBtn}>
          {isRetrying ? 'Starting…' : 'Run new scan →'}
        </button>
      </div>
    )
  }

  if (!activeScanId) {
    return (
      <div style={s.emptyState}>
        <p style={s.emptyTitle}>Select a scan</p>
        <p style={s.emptyText}>Choose a scan from the dropdown above, or run a new one.</p>
        <button onClick={onNewScan} style={s.primaryBtn}>New scan →</button>
      </div>
    )
  }

  if (!scan || isRunning) {
    return (
      <div style={s.runningState}>
        <div style={s.pulseRing} />
        <div style={s.pulseRingInner} />
        <div style={s.runningIcon}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <h2 style={s.runningTitle}>Scanning AI platforms…</h2>
        <p style={s.runningText}>
          Querying the available scan platform for{' '}
          <strong style={{ color: 'var(--text)' }}>
            {scan?.business_name ?? 'your business'}
          </strong>
          .<br />
          This usually takes 15–60 seconds.
        </p>
        <div style={s.platformPills}>
          {['Perplexity'].map(p => (
            <span key={p} style={s.platformPillRunning}>
              <span style={s.platformDot} />
              {p}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (scan.status === 'failed') {
    const failedAt = scan.completed_at
      ? new Date(scan.completed_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      : null
    return (
      <div style={s.emptyState}>
        <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Scan failed</p>
        <p style={s.emptyText}>
          This scan didn't complete{failedAt ? ` (${failedAt})` : ''}. This can happen
          if an AI platform is temporarily unavailable.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRetry} disabled={isRetrying} style={s.primaryBtn}>
            {isRetrying ? 'Starting…' : 'Retry scan →'}
          </button>
          <button onClick={onNewScan} style={s.secondaryBtn}>Edit queries</button>
        </div>
      </div>
    )
  }

  const score = scan.visibility_score ?? 0
  const platforms = scan.results.length > 0 ? Object.keys(scan.results[0].platforms) : []
  const isPerplexityOnly = platforms.length === 1 && platforms[0] === 'perplexity'
  // isFreeScan = scan was run on Perplexity only AND the viewer is still on free tier.
  // After upgrading, existing Perplexity-only scans show competitors unblurred.
  const isFreeScan = isPerplexityOnly && (scan.tier ?? 'free') === 'free'
  const allGenerated = scan.results.length > 0 && scan.results.every(r => r.source === 'generated')

  // Resolve which tracking set this scan was actually run against — usually
  // the active set, but may be an older one if the user is viewing a scan
  // from before they switched sets.
  const scanSetSlot = scan.tracking_set_slot ?? activeSet?.slot_number ?? null
  const scanSetName = scan.tracking_set_name ?? activeSet?.name ?? null

  return (
    <div style={s.content}>
      {/* Score header */}
      <TiltCard maxTilt={4} style={{ marginBottom: '2.5rem' }}>
        <GlowCard customSize radius={14} className="!block !p-0">
        <div style={{ ...s.scoreSection, marginBottom: 0 }}>
          <div style={s.scoreLeft}>
            <p style={s.eyebrow}>
              {isPerplexityOnly ? 'Free Perplexity Visibility Report' : 'AI Visibility Report'}
            </p>
            <h1 style={s.businessName}>{scan.business_name}</h1>
            <p style={s.scanMeta}>
              Scanned{' '}
              {new Date(scan.started_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {' · '}
              {scan.results.length} quer{scan.results.length === 1 ? 'y' : 'ies'}
              {' · '}
              {platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')}
            </p>
            {scanSetName && (
              <p style={s.setInline}>
                <span style={s.setInlineSlot}>
                  S{scanSetSlot ?? '?'}
                </span>
                <span style={s.setInlineName}>{scanSetName}</span>
                {activeSet?.is_locked && scanSetSlot === activeSet.slot_number && (
                  <span style={s.setInlineLock}>
                    Locked · {activeSet.days_until_unlock}d
                  </span>
                )}
              </p>
            )}
          </div>

          <div style={s.scoreRight}>
            <div style={s.scoreDial}>
              <ScoreArc score={score} />
              <div style={s.scoreCenter}>
                <span style={{ ...s.scoreNumber, color: scoreColor(score) }}>
                  {Math.round(score)}
                </span>
                <span style={s.scoreLabel}>/ 100</span>
              </div>
            </div>
            <p style={{ ...s.scoreGrade, color: scoreColor(score) }}>
              {score >= 70
                ? 'Strong visibility'
                : score >= 40
                ? 'Moderate visibility'
                : 'Low visibility'}
            </p>
            {scan.score_details && (
              <p style={s.scoreRawMath}>
                {Math.round(scan.score_details.earned_points)} of {scan.score_details.max_points} possible pts
              </p>
            )}
          </div>
        </div>
        </GlowCard>
      </TiltCard>

      {scan.score_details && (() => {
        const bestPos = bestMentionPosition(scan.results)
        const earned = Math.round(scan.score_details.earned_points)
        const max = scan.score_details.max_points
        const resultCount = scan.score_details.result_count
        return (
          <TiltCard maxTilt={3} style={{ marginBottom: '1.5rem' }}>
            <GlowCard customSize radius={10} className="!block !p-0">
              <div style={{ ...s.scoreExplain, marginBottom: 0 }}>
                <div>
                  <p style={s.scoreExplainLabel}>How this score was calculated</p>
                  <p style={s.scoreExplainText}>
                    Each of your {resultCount} {resultCount === 1 ? 'result' : 'results'} can earn up to{' '}
                    <strong style={{ color: 'var(--text)' }}>18 points</strong> — 10 for being mentioned,
                    up to 5 for ranking, and up to 3 for sentiment. You earned{' '}
                    <strong style={{ color: 'var(--text)' }}>{earned} of {max}</strong> possible points,
                    which normalizes to <strong style={{ color: 'var(--text)' }}>{Math.round(score)} / 100</strong>.
                    {isFreeScan ? ' Free scans cover Perplexity only — upgrade to add ChatGPT, Claude, and Gemini.' : ''}
                  </p>
                </div>
                <div style={s.scoreExplainGrid}>
                  <span>{pluralize(scan.score_details.mentioned_results, 'mention')}</span>
                  {bestPos != null && <span>best position #{bestPos}</span>}
                  <span>{pluralize(resultCount, 'data point')}</span>
                </div>
              </div>
            </GlowCard>
          </TiltCard>
        )
      })()}

      {scan.score_details && (
        <TiltCard maxTilt={3} style={{ marginBottom: '1.5rem' }}>
          <GlowCard customSize radius={10} className="!block !p-0">
            <div style={{ ...s.sentimentSummary, marginBottom: 0 }}>
              <div>
                <p style={s.scoreExplainLabel}>Sentiment summary</p>
                <p style={s.scoreExplainText}>{sentimentSummary(scan.score_details.sentiment_counts)}</p>
              </div>
              <div style={s.sentimentCounts}>
                <span style={{ ...s.sentimentPill, borderColor: 'rgba(34,197,94,0.35)', color: 'var(--green)' }}>
                  {scan.score_details.sentiment_counts.positive} positive
                </span>
                <span style={{ ...s.sentimentPill, borderColor: 'rgba(148,163,184,0.3)', color: 'var(--text-muted)' }}>
                  {scan.score_details.sentiment_counts.neutral} neutral
                </span>
                <span style={{ ...s.sentimentPill, borderColor: 'rgba(239,68,68,0.35)', color: 'var(--red)' }}>
                  {scan.score_details.sentiment_counts.negative} negative
                </span>
              </div>
            </div>
          </GlowCard>
        </TiltCard>
      )}

      {/* Platform bar */}
      {platforms.length > 0 && (
        <div style={s.platformGrid}>
          {platforms.map(platform => {
            const mentions = scan.results.filter(r => r.platforms[platform]?.mentioned).length
            const total = scan.results.length
            const pct = total > 0 ? Math.round((mentions / total) * 100) : 0
            return (
              <TiltCard key={platform} maxTilt={6} style={{ flex: '1 1 200px' }}>
                <GlowCard customSize radius={10} className="!block !p-0 h-full">
                  <div style={s.platformBarItem}>
                    <div style={s.platformBarHeader}>
                      <span
                        style={{
                          ...s.platformDotLarge,
                          background: PLATFORM_COLORS[platform] ?? 'var(--text-muted)',
                        }}
                      />
                      <span style={s.platformBarName}>{PLATFORM_LABELS[platform] ?? platform}</span>
                    </div>
                    <div style={s.platformBarTrack}>
                      <div
                        style={{
                          ...s.platformBarFill,
                          width: `${pct}%`,
                          background: PLATFORM_COLORS[platform] ?? 'var(--accent)',
                        }}
                      />
                    </div>
                    <span style={s.platformBarPct}>
                      {mentions}/{total} queries{' '}
                      <span style={{ color: 'var(--text-muted)' }}>mentioned</span>
                    </span>
                  </div>
                </GlowCard>
              </TiltCard>
            )
          })}
          {isFreeScan && (() => {
            const lockedCompetitors = Array.from(new Set(
              scan.results.flatMap(r => r.platforms['perplexity']?.competitors_mentioned ?? [])
            )).slice(0, 2)
            return ['openai', 'anthropic', 'gemini'].map(platform => (
              <TiltCard key={`locked-${platform}`} maxTilt={6} style={{ flex: '1 1 200px', opacity: 0.82 }}>
                <GlowCard customSize radius={10} className="!block !p-0 h-full">
                  <div style={{ ...s.platformBarItem, background: 'linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))' }}>
                    <div style={s.platformBarHeader}>
                      <span
                        style={{
                          ...s.platformDotLarge,
                          background: PLATFORM_COLORS[platform] ?? 'var(--text-muted)',
                        }}
                      />
                      <span style={s.platformBarName}>{PLATFORM_LABELS[platform] ?? platform}</span>
                      <span style={s.lockBadge}>Locked</span>
                    </div>
                    <p style={s.lockedPlatformCopy}>
                      {lockedCompetitors.length > 0
                        ? `Perplexity named ${lockedCompetitors.join(' and ')} in your results — does ${PLATFORM_LABELS[platform] ?? platform} recommend them too?`
                        : `See what ${PLATFORM_LABELS[platform] ?? platform} says about this business and which competitors it names.`
                      }
                    </p>
                    <Link to="/pricing" style={s.unlockLink}>Unlock results</Link>
                  </div>
                </GlowCard>
              </TiltCard>
            ))
          })()}
        </div>
      )}

      {/* Recommendations */}
      {scan.recommendations && scan.recommendations.length > 0 && (
        <RecommendationsPanel
          recommendations={scan.recommendations}
          tier={scan.tier ?? 'free'}
        />
      )}

      {/* Queries — tap to expand each row for full platform-by-platform
          breakdown, score math, and competitors. This replaces the old
          separate "Query Breakdown" section entirely. */}
      <div style={s.queriesSection}>
        <div style={s.queriesHeader}>
          <h2 style={s.sectionTitle}>
            {allGenerated ? 'Generated queries' : 'Queries'}
          </h2>
          <span style={s.queriesCount}>
            {scan.results.length} {scan.results.length === 1 ? 'query' : 'queries'} ·{' '}
            <span style={{ color: 'var(--text-dim)' }}>tap to expand</span>
          </span>
        </div>
        <div style={s.accordionList}>
          {scan.results.map((result, i) => (
            <TiltCard key={result.query_id} maxTilt={3}>
              <GlowCard customSize radius={10} className="!block !p-0">
                <QueryAccordion
                  result={result}
                  index={i}
                  platforms={platforms}
                  glowWrapped
                  isFreeScan={isPerplexityOnly}
                />
              </GlowCard>
            </TiltCard>
          ))}
        </div>
      </div>
    </div>
  )
}

// QueryRow was replaced by QueryAccordion (see components/query-accordion.tsx).

// ─── ScoreArc ─────────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  const color = scoreColor(score)
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dasharray 1s ease, stroke 0.5s ease',
          filter: `drop-shadow(0 0 8px ${color}60)`,
        }}
      />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SELECT_BG = `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 16 16'%3E%3Cpath fill='%238aa4bc' d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`

const s: Record<string, React.CSSProperties> = {
  // Layout
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: "'Outfit', sans-serif",
    color: 'var(--text)',
    paddingTop: '76px',
  },
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2.5rem 2.5rem 4rem',
  },

  // Tracking set tabs strip — sits between nav and content
  setTabsWrap: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem 2rem 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  setActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
    paddingTop: '0.4rem',
  },
  setActionsMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    flex: '1 1 auto',
    minWidth: 0,
  },
  setMetaDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  setActionsBtns: {
    display: 'flex',
    gap: '0.6rem',
  },

  // Inline set tag inside the score header
  setInline: {
    margin: '0.85rem 0 0',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.35rem 0.75rem',
    background: 'rgba(240, 165, 0, 0.06)',
    border: '1px solid rgba(240, 165, 0, 0.22)',
    borderRadius: '99px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
  setInlineSlot: {
    color: 'var(--accent)',
    fontWeight: 700,
    letterSpacing: '0.1em',
  },
  setInlineName: {
    color: 'var(--text)',
    fontWeight: 600,
  },
  setInlineLock: {
    color: 'var(--text-dim)',
    paddingLeft: '0.35rem',
    borderLeft: '1px solid var(--border)',
    marginLeft: '0.1rem',
  },

  // Query accordion list (replaces the old queryList styles)
  accordionList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },

  // Nav — inherits the global transparent/fixed nav style from globals.css.
  // Inline styles here only add the flex layout; background/position/animation
  // come from the `nav` CSS rule so it matches the landing page exactly.
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2.5rem',
    gap: '1rem',
    // position, background, top/left/right, z-index come from globals.css nav {}
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flex: 1,
    minWidth: 0,
    position: 'relative' as const,
    zIndex: 1,
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.4rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#fff',
    textDecoration: 'none',
    flexShrink: 0,
    gap: '0.4rem',
  },
  navDivider: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: '1rem',
    flexShrink: 0,
  },
  navBusinessName: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  navSelect: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.85)',
    padding: '0.35rem 1.8rem 0.35rem 0.75rem',
    fontSize: '0.82rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    appearance: 'none' as any,
    WebkitAppearance: 'none' as any,
    backgroundImage: SELECT_BG,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.5rem center',
    maxWidth: '180px',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 1,
  },
  newScanBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    padding: '0.4rem 1rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '0.01em',
  },
  navEmail: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.45)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  signOutBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.55)',
    padding: '0.35rem 0.85rem',
    fontSize: '0.8rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
  },
  addBizBtn: {
    background: 'transparent',
    border: '1px dashed rgba(240,165,0,0.4)',
    borderRadius: '6px',
    color: 'var(--accent)',
    padding: '0.3rem 0.75rem',
    fontSize: '0.78rem',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.18s, background 0.18s',
    whiteSpace: 'nowrap' as const,
  },
  formCancelBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    padding: '0 0 1rem',
    textAlign: 'left' as const,
    display: 'block',
    transition: 'color 0.18s',
  },

  // Error banner
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    background: 'rgba(239,68,68,0.1)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    padding: '0.75rem 2rem',
    fontSize: '0.85rem',
    color: 'var(--red)',
  },
  errorDismiss: {
    background: 'none',
    border: 'none',
    color: 'var(--red)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },

  // Loading
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '1rem',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },

  // Form pages (setup + new scan)
  formPage: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '4rem 2rem',
    minHeight: 'calc(100vh - 60px)',
  },
  formCard: {
    width: '100%',
    maxWidth: '760px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  formCardHeader: {
    padding: '2.5rem 2.5rem 0',
    borderBottom: '1px solid var(--border-dim)',
    paddingBottom: '2rem',
  },
  formCardTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '0.5rem',
    lineHeight: 1.15,
  },
  formCardSubtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  },
  formBody: {
    padding: '2rem 2.5rem 2.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },

  // Form fields
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  fieldLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '0.02em',
  },
  fieldOptional: {
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  input: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    marginBottom: 0,
    transition: 'border-color 0.15s',
  },

  // Query list in forms
  queryInputList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  queryInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  queryRowNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
    width: '16px',
    flexShrink: 0,
    textAlign: 'right' as const,
  },
  removeBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-dim)',
    width: '28px',
    height: '28px',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
  },
  addBtn: {
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    padding: '0.5rem 1rem',
    fontSize: '0.82rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    marginTop: '0.25rem',
    width: '100%',
    textAlign: 'left' as const,
  },
  formError: {
    color: 'var(--red)',
    fontSize: '0.82rem',
    background: 'rgba(239,68,68,0.07)',
    border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
  },
  primaryBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    padding: '0.8rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    width: '100%',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    padding: '0.8rem 1.5rem',
    fontSize: '0.95rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },

  // Shared empty / running states
  emptyState: {
    maxWidth: '420px',
    margin: '15vh auto 0',
    textAlign: 'center' as const,
    padding: '2rem',
  },
  noScansWide: {
    maxWidth: '640px',
    margin: '6vh auto 0',
    textAlign: 'center' as const,
    padding: '2rem',
  },
  welcomeBanner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.45rem 0.9rem 0.45rem 0.7rem',
    marginBottom: '1.5rem',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
    color: 'var(--text)',
    fontSize: '0.82rem',
    lineHeight: 1.4,
  },
  welcomeCheck: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.2)',
    color: 'var(--green)',
    flexShrink: 0,
  },
  queriesPreview: {
    margin: '0 0 1.75rem',
    padding: '0.85rem 0.95rem 0.6rem',
    background: 'rgba(14,18,24,0.7)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    textAlign: 'left' as const,
  },
  queriesPreviewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.55rem',
    paddingBottom: '0.55rem',
    borderBottom: '1px solid var(--border)',
  },
  queriesPreviewLabel: {
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  queriesPreviewEdit: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.65rem',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    transition: 'border-color 0.2s, color 0.2s',
  },
  queriesPreviewList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.15rem',
  },
  queriesPreviewItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.8rem',
    padding: '0.5rem 0.25rem',
    borderBottom: '1px dashed rgba(255,255,255,0.04)',
  },
  queriesPreviewIdx: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    minWidth: '22px',
  },
  queriesPreviewText: {
    fontSize: '0.92rem',
    color: 'var(--text)',
    lineHeight: 1.45,
  },
  emptyTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.8rem',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '0.6rem',
  },
  emptyText: {
    color: 'var(--text-muted)',
    marginBottom: '1.5rem',
    lineHeight: 1.6,
  },
  runningState: {
    maxWidth: '480px',
    margin: '12vh auto 0',
    textAlign: 'center' as const,
    padding: '2rem',
    position: 'relative' as const,
  },
  pulseRing: {
    position: 'absolute' as const,
    top: '50px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '120px',
    height: '120px',
    border: '1px solid var(--border)',
    borderRadius: '50%',
  },
  pulseRingInner: {
    position: 'absolute' as const,
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80px',
    height: '80px',
    border: '1px solid var(--border-dim)',
    borderRadius: '50%',
  },
  runningIcon: {
    width: '56px',
    height: '56px',
    background: 'var(--accent-dim)',
    border: '1px solid rgba(201,143,10,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.75rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  runningTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '2rem',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '0.75rem',
  },
  runningText: {
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '1.75rem',
  },
  platformPills: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  platformPillRunning: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.8rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  platformDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'pulse-dot 1.4s ease-in-out infinite',
  },

  // Score section
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2.5rem',
    padding: '2rem 2.25rem',
    flexWrap: 'wrap' as const,
  },
  scoreLeft: {
    flex: 1,
    minWidth: '260px',
  },
  eyebrow: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: '0.5rem',
  },
  businessName: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: 700,
    lineHeight: 1.08,
    marginBottom: '0.5rem',
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  scanMeta: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginTop: '0.25rem',
  },
  scoreRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  scoreDial: {
    position: 'relative' as const,
    width: '148px',
    height: '148px',
  },
  scoreCenter: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '2.6rem',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  scoreLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  scoreGrade: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  scoreRawMath: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
    letterSpacing: '0.01em',
  },
  scoreExplain: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1.5rem',
    flexWrap: 'wrap' as const,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.4rem 1.75rem',
    marginBottom: '1.25rem',
  },
  scoreExplainLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: '0.4rem',
  },
  scoreExplainText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.65,
  },
  scoreExplainGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    color: 'var(--text)',
    fontWeight: 600,
  },
  sentimentSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap' as const,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.4rem 1.75rem',
    marginBottom: '1.25rem',
  },
  sentimentCounts: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap' as const,
  },
  sentimentPill: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.3rem 0.8rem',
    fontSize: '0.8rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
    letterSpacing: '0.02em',
  },

  // Platform grid — each card is individually wrapped in TiltCard + GlowCard
  platformGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '1rem',
    marginBottom: '2.5rem',
  },
  // Platform bar (kept for legacy reference)
  platformBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1px',
    background: 'var(--border)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    marginBottom: '2.5rem',
  },
  platformBarItem: {
    background: 'var(--surface)',
    padding: '1.5rem 1.75rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  platformBarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  platformDotLarge: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  platformBarName: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.01em',
  },
  platformBarTrack: {
    height: '4px',
    background: 'var(--surface-2)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  platformBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.8s ease',
  },
  platformBarPct: {
    fontSize: '0.82rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text)',
    fontWeight: 600,
  },
  lockedPlatformItem: {
    opacity: 0.82,
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
    position: 'relative' as const,
  },
  lockBadge: {
    marginLeft: 'auto',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    padding: '0.12rem 0.45rem',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  lockedPlatformCopy: {
    fontSize: '0.78rem',
    lineHeight: 1.5,
    color: 'var(--text-muted)',
    margin: 0,
  },
  unlockLink: {
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 'auto',
  },

  // Query section
  queriesSection: {
    marginTop: '1rem',
  },
  queriesHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  queriesCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  sectionTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 0,
    letterSpacing: '-0.01em',
  },
  queryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  queryRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
    padding: '0.85rem 1.1rem',
    borderBottom: '1px solid var(--border-dim)',
  },
  queryRowTop: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
  },
  queryRowIndex: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
    flexShrink: 0,
    minWidth: '20px',
  },
  queryRowText: {
    flex: 1,
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text)',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    minWidth: 0,
  },
  queryRowScore: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.95rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  queryRowScoreUnit: {
    fontSize: '0.7rem',
    fontWeight: 400,
    color: 'var(--text-muted)',
    marginLeft: '2px',
  },
  queryRowPlatforms: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.4rem',
    paddingLeft: '32px',
  },
  queryRowBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.25rem 0.55rem',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '0.78rem',
    transition: 'opacity 0.15s, border-color 0.15s',
  },
  queryRowPos: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    padding: '0 4px',
    borderRadius: '3px',
  },
  queryRowBreakdown: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    paddingLeft: '32px',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
    flexWrap: 'wrap' as const,
  },
  queryRowBreakdownItem: {
    whiteSpace: 'nowrap' as const,
  },
  queryRowBreakdownNum: {
    color: 'var(--text)',
    fontWeight: 700,
  },
  queryRowBreakdownPlus: {
    color: 'var(--text-dim)',
    opacity: 0.6,
  },
  queryRowCompetitors: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.55rem',
    paddingLeft: '32px',
    flexWrap: 'wrap' as const,
  },
  queryRowCompLabel: {
    fontSize: '0.68rem',
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  queryRowCompChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.3rem',
  },
  // Legacy query-card styles below — preserved temporarily for any external
  // references; the active layout is the queryList above.
  queryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '1rem',
  },
  queryCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  queryCardHeader: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  queryIndex: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
    paddingTop: '2px',
    flexShrink: 0,
  },
  queryText: {
    fontSize: '0.9rem',
    color: 'var(--text)',
    lineHeight: 1.45,
    fontStyle: 'italic',
  },
  queryReason: {
    marginTop: '0.45rem',
    fontSize: '0.74rem',
    lineHeight: 1.45,
    color: 'var(--text-muted)',
  },
  queryPlatforms: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  rawResponses: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  rawResponseDetails: {
    border: '1px solid var(--border-dim)',
    borderRadius: '6px',
    background: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  rawResponseSummary: {
    cursor: 'pointer',
    padding: '0.6rem 0.75rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  rawResponseText: {
    margin: 0,
    padding: '0 0.75rem 0.75rem',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
  },
  platformChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.7rem',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.82rem',
  },
  platformChipMentioned: { background: 'rgba(255,255,255,0.03)' },
  platformChipMissed: { background: 'transparent', opacity: 0.6 },
  chipDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  chipName: { fontWeight: 500, flex: 1 },
  chipPos: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  chipSentiment: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.9rem',
    fontWeight: 700,
  },
  chipMissed: { fontSize: '0.72rem', color: 'var(--text-dim)' },
  competitors: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.35rem',
    alignItems: 'center',
  },
  competitorsLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    flexShrink: 0,
  },
  competitorChip: {
    fontSize: '0.72rem',
    background: 'rgba(239,68,68,0.07)',
    border: '1px solid rgba(239,68,68,0.15)',
    color: 'var(--red)',
    borderRadius: '4px',
    padding: '1px 6px',
  },
  scoreStrip: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-dim)',
    paddingTop: '0.75rem',
    marginTop: 'auto',
  },
  scoreStripLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  scoreStripValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.85rem',
    fontWeight: 600,
  },
}
