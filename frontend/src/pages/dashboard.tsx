/**
 * Dashboard — full product dashboard.
 *
 * States:
 *   loading  → fetching businesses on mount
 *   setup    → no business found, show setup form
 *   main     → has businesses; sub-modes: results | new-scan | no-scans
 */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import {
  getBusinesses,
  getBusinessHistory,
  getScanResults,
  createBusiness,
  triggerScan,
  updateBusinessQueries,
} from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
  scores: { mention: number; position: number; sentiment: number; total: number }
}

interface QueryResult {
  query_id: string
  query_text: string
  platforms: Record<string, PlatformResult>
}

interface ScanData {
  scan_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  business_name: string
  started_at: string
  completed_at: string | null
  results: QueryResult[]
}

interface BusinessQuery {
  id: string
  query_text: string
  is_active: boolean
}

interface BusinessWithQueries {
  id: string
  name: string
  website: string | null
  industry: string | null
  created_at: string
  queries: BusinessQuery[]
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
type MainMode = 'results' | 'new-scan' | 'no-scans'

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

function sentimentIcon(sentiment: string | null) {
  if (sentiment === 'positive') return { symbol: '↑', color: 'var(--green)' }
  if (sentiment === 'negative') return { symbol: '↓', color: 'var(--red)' }
  return { symbol: '→', color: 'var(--text-muted)' }
}

function formatScanLabel(scan: ScanSummary): string {
  const date = new Date(scan.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (scan.status === 'running' || scan.status === 'pending') return `${date} · Running…`
  if (scan.status === 'failed') return `${date} · Failed`
  const score = scan.visibility_score != null ? `Score ${Math.round(scan.visibility_score)}` : 'No score'
  return `${date} · ${score}`
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()

  const [appState, setAppState] = useState<AppState>('loading')
  const [businesses, setBusinesses] = useState<BusinessWithQueries[]>([])
  const [activeBusiness, setActiveBusiness] = useState<BusinessWithQueries | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanSummary[]>([])
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  const [mode, setMode] = useState<MainMode>('no-scans')

  const [scan, setScan] = useState<ScanData | null>(null)
  const [scanError, setScanError] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const [globalError, setGlobalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRunning = !!(activeScanId && (!scan || scan.status === 'pending' || scan.status === 'running'))

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const urlScanId = searchParams.get('scanId')
    async function init() {
      try {
        const raw = await getBusinesses()
        const bizList: BusinessWithQueries[] = Array.isArray(raw) ? raw : []
        if (bizList.length === 0) {
          setAppState('setup')
          return
        }
        setBusinesses(bizList)
        const biz = bizList[0]
        setActiveBusiness(biz)

        const histData = await getBusinessHistory(biz.id)
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
  const fetchScan = useCallback(async (scanId: string) => {
    try {
      const data = await getScanResults(scanId)
      setScan(data)
      if (data.status === 'completed' || data.status === 'failed') {
        setScanHistory(prev =>
          prev.map(s =>
            s.id === scanId
              ? { ...s, status: data.status, visibility_score: data.visibility_score, completed_at: data.completed_at }
              : s
          )
        )
      }
    } catch (err: any) {
      setScanError(err.message ?? 'Failed to load results')
    }
  }, [])

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
    try {
      const histData = await getBusinessHistory(biz.id)
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

  // ── Scan select ────────────────────────────────────────────────────────────
  function handleScanSelect(scanId: string) {
    setActiveScanId(scanId)
    setMode('results')
  }

  // ── New scan submit ────────────────────────────────────────────────────────
  async function handleNewScanSubmit(queries: string[]) {
    if (!activeBusiness || isSubmitting) return
    setIsSubmitting(true)
    try {
      const existingActive = activeBusiness.queries
        .filter(q => q.is_active)
        .map(q => q.query_text)
      const changed =
        queries.length !== existingActive.length ||
        queries.some(q => !existingActive.includes(q))

      if (changed) {
        await updateBusinessQueries(activeBusiness.id, queries)
        setActiveBusiness(prev =>
          prev
            ? { ...prev, queries: queries.map((qt, i) => ({ id: `q${i}`, query_text: qt, is_active: true })) }
            : null
        )
      }

      const { scan_id } = await triggerScan(activeBusiness.id)
      const newEntry: ScanSummary = {
        id: scan_id,
        status: 'running',
        visibility_score: null,
        triggered_by: 'manual',
        started_at: new Date().toISOString(),
        completed_at: null,
      }
      setScanHistory(prev => [newEntry, ...prev])
      setActiveScanId(scan_id)
      setScan(null)
      setScanError('')
      setPollCount(0)
      setMode('results')
    } catch (err: any) {
      setScanError(err.message ?? 'Failed to start scan')
    } finally {
      setIsSubmitting(false)
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
      const { business_id } = await createBusiness({
        name,
        website: website || undefined,
        industry: industry || undefined,
        queries,
      })
      const { scan_id } = await triggerScan(business_id)
      const raw = await getBusinesses()
      const bizList: BusinessWithQueries[] = Array.isArray(raw) ? raw : []
      setBusinesses(bizList)
      const newBiz = bizList.find(b => b.id === business_id) ?? bizList[0]
      setActiveBusiness(newBiz)
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

  if (appState === 'setup') {
    return (
      <div style={s.page}>
        <nav style={s.nav}>
          <span style={s.navLogo}>
            <span style={{ color: 'var(--accent)' }}>AI</span> Brand Monitor
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

  return (
    <div style={s.page}>
      <DashboardNav
        email={user?.email}
        onSignOut={signOut}
        businesses={businesses}
        activeBusiness={activeBusiness}
        onBusinessChange={handleBusinessChange}
        scanHistory={scanHistory}
        activeScanId={activeScanId}
        onScanSelect={handleScanSelect}
        onNewScan={() => setMode('new-scan')}
        mode={mode}
      />

      {globalError && (
        <div style={s.errorBanner}>
          <span>{globalError}</span>
          <button onClick={() => setGlobalError('')} style={s.errorDismiss}>×</button>
        </div>
      )}

      {mode === 'new-scan' && activeBusiness && (
        <NewScanForm
          business={activeBusiness}
          onSubmit={handleNewScanSubmit}
          onCancel={() => setMode(scanHistory.length > 0 ? 'results' : 'no-scans')}
          isSubmitting={isSubmitting}
        />
      )}

      {mode === 'no-scans' && (
        <NoScansState
          businessName={activeBusiness?.name}
          onNewScan={() => setMode('new-scan')}
        />
      )}

      {mode === 'results' && (
        <ScanResultsView
          scan={scan}
          scanError={scanError}
          isRunning={isRunning}
          activeScanId={activeScanId}
          onNewScan={() => setMode('new-scan')}
        />
      )}
    </div>
  )
}

// ─── DashboardNav ─────────────────────────────────────────────────────────────

interface DashboardNavProps {
  email?: string
  onSignOut: () => void
  businesses: BusinessWithQueries[]
  activeBusiness: BusinessWithQueries | null
  onBusinessChange: (id: string) => void
  scanHistory: ScanSummary[]
  activeScanId: string | null
  onScanSelect: (id: string) => void
  onNewScan: () => void
  mode: MainMode
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
  mode,
}: DashboardNavProps) {
  return (
    <nav style={s.nav}>
      <div style={s.navLeft}>
        <Link to="/" style={s.navLogo}>
          <span style={{ color: 'var(--accent)' }}>AI</span> Brand Monitor
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
          </>
        )}
      </div>

      <div style={s.navRight}>
        {scanHistory.length > 0 && mode !== 'new-scan' && (
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
        <button onClick={onNewScan} style={s.newScanBtn}>+ New Scan</button>
        {email && <span style={s.navEmail}>{email}</span>}
        <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
      </div>
    </nav>
  )
}

// ─── BusinessSetupForm ────────────────────────────────────────────────────────

interface SetupFormProps {
  onSubmit: (name: string, website: string, industry: string, queries: string[]) => void
  isSubmitting: boolean
  error: string
}

function BusinessSetupForm({ onSubmit, isSubmitting, error }: SetupFormProps) {
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
          <p style={s.eyebrow}>Welcome</p>
          <h1 style={s.formCardTitle}>Set up your business</h1>
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

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ ...s.primaryBtn, opacity: isSubmitting ? 0.6 : 1 }}
          >
            {isSubmitting ? 'Setting up…' : 'Start monitoring →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NewScanForm ──────────────────────────────────────────────────────────────

interface NewScanFormProps {
  business: BusinessWithQueries
  onSubmit: (queries: string[]) => void
  onCancel: () => void
  isSubmitting: boolean
}

function NewScanForm({ business, onSubmit, onCancel, isSubmitting }: NewScanFormProps) {
  const defaultQueries = business.queries.filter(q => q.is_active).map(q => q.query_text)
  const [queries, setQueries] = useState(defaultQueries.length > 0 ? defaultQueries : [''])
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
    const validQueries = queries.map(q => q.trim()).filter(q => q.length >= 3)
    if (validQueries.length === 0) { setFormError('Add at least one query (3+ characters)'); return }
    setFormError('')
    onSubmit(validQueries)
  }

  return (
    <div style={s.formPage}>
      <div style={{ ...s.formCard, maxWidth: '640px' }}>
        <div style={s.formCardHeader}>
          <p style={s.eyebrow}>New scan</p>
          <h1 style={s.formCardTitle}>{business.name}</h1>
          <p style={s.formCardSubtitle}>
            Confirm or update the queries to run across AI platforms.
          </p>
        </div>

        <div style={s.formBody}>
          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>
              Target queries <span style={s.fieldOptional}>— edit before running</span>
            </label>
            <div style={s.queryInputList}>
              {queries.map((q, i) => (
                <div key={i} style={s.queryInputRow}>
                  <span style={s.queryRowNum}>{i + 1}</span>
                  <input
                    type="text"
                    placeholder="Enter a search query"
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

          {formError && <p style={s.formError}>{formError}</p>}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onCancel} style={s.secondaryBtn}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ ...s.primaryBtn, flex: 1, opacity: isSubmitting ? 0.6 : 1 }}
            >
              {isSubmitting ? 'Starting scan…' : 'Run scan →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── NoScansState ─────────────────────────────────────────────────────────────

function NoScansState({
  businessName,
  onNewScan,
}: {
  businessName?: string
  onNewScan: () => void
}) {
  return (
    <div style={s.emptyState}>
      <p style={s.emptyTitle}>
        {businessName ? `No scans yet for ${businessName}` : 'No scans yet'}
      </p>
      <p style={s.emptyText}>
        Run your first scan to see how AI platforms mention your business.
      </p>
      <button onClick={onNewScan} style={s.primaryBtn}>
        Run first scan →
      </button>
    </div>
  )
}

// ─── ScanResultsView ──────────────────────────────────────────────────────────

function ScanResultsView({
  scan,
  scanError,
  isRunning,
  activeScanId,
  onNewScan,
}: {
  scan: ScanData | null
  scanError: string
  isRunning: boolean
  activeScanId: string | null
  onNewScan: () => void
}) {
  if (scanError) {
    const isSub = scanError.toLowerCase().includes('subscription')
    return (
      <div style={s.emptyState}>
        {isSub ? (
          <>
            <p style={s.emptyTitle}>Upgrade to run scans</p>
            <p style={s.emptyText}>
              An active subscription is required to scan AI platforms for your business.
            </p>
            <a
              href="/#pricing"
              style={{ ...s.primaryBtn, textDecoration: 'none', display: 'inline-block', textAlign: 'center' as const }}
            >
              View pricing →
            </a>
          </>
        ) : (
          <>
            <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Error loading results</p>
            <p style={s.emptyText}>{scanError}</p>
          </>
        )}
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
          Querying ChatGPT and Perplexity for{' '}
          <strong style={{ color: 'var(--text)' }}>
            {scan?.business_name ?? 'your business'}
          </strong>
          .<br />
          This usually takes 15–60 seconds.
        </p>
        <div style={s.platformPills}>
          {['ChatGPT', 'Perplexity'].map(p => (
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
    return (
      <div style={s.emptyState}>
        <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Scan failed</p>
        <p style={s.emptyText}>Something went wrong. Please try running a new scan.</p>
        <button onClick={onNewScan} style={s.primaryBtn}>Try again →</button>
      </div>
    )
  }

  const score = scan.visibility_score ?? 0
  const platforms = scan.results.length > 0 ? Object.keys(scan.results[0].platforms) : []

  return (
    <div style={s.content}>
      {/* Score header */}
      <div style={s.scoreSection}>
        <div style={s.scoreLeft}>
          <p style={s.eyebrow}>AI Visibility Report</p>
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
        </div>
      </div>

      {/* Platform bar */}
      {platforms.length > 0 && (
        <div style={s.platformBar}>
          {platforms.map(platform => {
            const mentions = scan.results.filter(r => r.platforms[platform]?.mentioned).length
            const total = scan.results.length
            const pct = total > 0 ? Math.round((mentions / total) * 100) : 0
            return (
              <div key={platform} style={s.platformBarItem}>
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
            )
          })}
        </div>
      )}

      {/* Query cards */}
      <div style={s.queriesSection}>
        <h2 style={s.sectionTitle}>Query Breakdown</h2>
        <div style={s.queryGrid}>
          {scan.results.map((result, i) => (
            <QueryCard key={result.query_id} result={result} index={i} platforms={platforms} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── QueryCard ────────────────────────────────────────────────────────────────

function QueryCard({
  result,
  index,
  platforms,
}: {
  result: QueryResult
  index: number
  platforms: string[]
}) {
  const anyMentioned = platforms.some(p => result.platforms[p]?.mentioned)

  return (
    <div
      style={{
        ...s.queryCard,
        animation: `fadeUp 0.4s cubic-bezier(.22,1,.36,1) ${index * 0.06}s both`,
      }}
    >
      <div style={s.queryCardHeader}>
        <span style={s.queryIndex}>{String(index + 1).padStart(2, '0')}</span>
        <p style={s.queryText}>"{result.query_text}"</p>
      </div>

      <div style={s.queryPlatforms}>
        {platforms.map(platform => {
          const pr = result.platforms[platform]
          const label = PLATFORM_LABELS[platform] ?? platform
          const color = PLATFORM_COLORS[platform] ?? 'var(--text-muted)'
          const { symbol, color: sentColor } = sentimentIcon(pr?.sentiment ?? null)
          return (
            <div
              key={platform}
              style={{
                ...s.platformChip,
                ...(pr?.mentioned ? s.platformChipMentioned : s.platformChipMissed),
                borderColor: pr?.mentioned ? color + '40' : 'var(--border)',
              }}
            >
              <span
                style={{ ...s.chipDot, background: pr?.mentioned ? color : 'var(--text-dim)' }}
              />
              <span
                style={{
                  ...s.chipName,
                  color: pr?.mentioned ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {label}
              </span>
              {pr?.mentioned && (
                <>
                  {pr.mention_position && (
                    <span style={s.chipPos}>#{pr.mention_position}</span>
                  )}
                  <span style={{ ...s.chipSentiment, color: sentColor }}>{symbol}</span>
                </>
              )}
              {!pr?.mentioned && <span style={s.chipMissed}>not mentioned</span>}
            </div>
          )
        })}
      </div>

      {platforms.some(p => (result.platforms[p]?.competitors_mentioned ?? []).length > 0) && (
        <div style={s.competitors}>
          <span style={s.competitorsLabel}>Also mentioned: </span>
          {Array.from(
            new Set(platforms.flatMap(p => result.platforms[p]?.competitors_mentioned ?? []))
          ).map(c => (
            <span key={c} style={s.competitorChip}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div style={s.scoreStrip}>
        <span style={s.scoreStripLabel}>Query score</span>
        <span
          style={{
            ...s.scoreStripValue,
            color: anyMentioned ? 'var(--green)' : 'var(--text-muted)',
          }}
        >
          {platforms.reduce((sum, p) => sum + (result.platforms[p]?.scores.total ?? 0), 0)} pts
        </span>
      </div>
    </div>
  )
}

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
  },
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '3rem 2rem',
  },

  // Nav
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 2rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
  },
  navLogo: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.2rem',
    color: 'var(--text)',
    textDecoration: 'none',
    flexShrink: 0,
  },
  navDivider: {
    color: 'var(--border)',
    fontSize: '1rem',
    flexShrink: 0,
  },
  navBusinessName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  navSelect: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '0.35rem 1.8rem 0.35rem 0.7rem',
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
  },
  newScanBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    padding: '0.4rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  navEmail: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-muted)',
    padding: '0.35rem 0.8rem',
    fontSize: '0.8rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
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
    fontFamily: "'Instrument Serif', serif",
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
  emptyTitle: {
    fontFamily: "'Instrument Serif', serif",
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
    border: '1px solid rgba(240,165,0,0.2)',
    borderRadius: '50%',
    animation: 'glow-pulse 2s ease-in-out infinite',
  },
  pulseRingInner: {
    position: 'absolute' as const,
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80px',
    height: '80px',
    border: '1px solid rgba(240,165,0,0.1)',
    borderRadius: '50%',
    animation: 'glow-pulse 2s ease-in-out infinite 0.5s',
  },
  runningIcon: {
    width: '56px',
    height: '56px',
    background: 'var(--accent-dim)',
    border: '1px solid rgba(240,165,0,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.75rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  runningTitle: {
    fontFamily: "'Instrument Serif', serif",
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
    gap: '2rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap' as const,
  },
  scoreLeft: {
    flex: 1,
    minWidth: '260px',
  },
  eyebrow: {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: '0.6rem',
  },
  businessName: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 'clamp(2rem, 5vw, 3.2rem)',
    fontWeight: 400,
    lineHeight: 1.1,
    marginBottom: '0.6rem',
    color: 'var(--text)',
  },
  scanMeta: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  scoreRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
  },
  scoreDial: {
    position: 'relative' as const,
    width: '140px',
    height: '140px',
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
    fontSize: '2.4rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  scoreGrade: {
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },

  // Platform bar
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
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
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
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text)',
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
    fontSize: '0.78rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text)',
  },

  // Query section
  queriesSection: {
    marginTop: '0.5rem',
  },
  sectionTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.4rem',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '1.25rem',
  },
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
  queryPlatforms: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
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
