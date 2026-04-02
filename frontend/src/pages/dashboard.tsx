/**
 * Dashboard — shows scan results for a business.
 *
 * URL: /dashboard?scanId=<uuid>
 *
 * Polls the scan results endpoint every 3 seconds while status is
 * 'pending' or 'running', then settles once 'completed' or 'failed'.
 *
 * Design: dark editorial, data-forward. Large visibility score
 * anchors the top; query breakdown cards fill the body.
 */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { getScanResults, getBusinesses, getBusinessScans, createBusiness, triggerScan } from '../lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Business {
  id: string
  name: string
  queries: Array<{ id: string; query_text: string; is_active: boolean }>
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const scanId = searchParams.get('scanId')

  const [scan, setScan] = useState<ScanData | null>(null)
  const [error, setError] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const [resolveState, setResolveState] = useState<'loading' | 'empty' | 'done'>(scanId ? 'done' : 'loading')

  // Businesses + scan form state
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showScanForm, setShowScanForm] = useState(false)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [formBizName, setFormBizName] = useState('')
  const [formQueries, setFormQueries] = useState(['', ''])
  const [isScanning, setIsScanning] = useState(false)
  const [scanFormError, setScanFormError] = useState('')
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const isRunning = !scan || scan.status === 'pending' || scan.status === 'running'

  const fetchScan = useCallback(async () => {
    if (!scanId) return
    try {
      const data = await getScanResults(scanId)
      setScan(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load results')
    }
  }, [scanId])

  // Initial fetch + polling while running
  useEffect(() => {
    fetchScan()
  }, [fetchScan])

  useEffect(() => {
    if (!isRunning) return
    const timer = setTimeout(() => {
      fetchScan()
      setPollCount(c => c + 1)
    }, 3000)
    return () => clearTimeout(timer)
  }, [isRunning, pollCount, fetchScan])

  // On mount: load businesses; if no scanId, navigate to most recent scan
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const bizList = await getBusinesses()
        if (cancelled) return
        if (bizList?.length) setBusinesses(bizList)
        if (scanId) return
        if (!bizList?.length) { setResolveState('empty'); return }
        const { scans } = await getBusinessScans(bizList[0].id)
        if (cancelled) return
        if (!scans?.length) { setResolveState('empty'); return }
        navigate(`/dashboard?scanId=${scans[0].id}`, { replace: true })
      } catch {
        if (!scanId) setResolveState('empty')
      }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSwitchBusiness(biz: Business) {
    setSwitchingTo(biz.id)
    try {
      const { scans } = await getBusinessScans(biz.id)
      if (scans?.length) {
        setScan(null)
        setError('')
        navigate(`/dashboard?scanId=${scans[0].id}`, { replace: true })
      }
    } catch {
      // silently fail — stay on current scan
    } finally {
      setSwitchingTo(null)
    }
  }

  function handleOpenScanForm() {
    const activeBiz = businesses.find(b => b.name === scan?.business_name) ?? businesses[0]
    if (activeBiz) {
      setFormBizName(activeBiz.name)
      const activeQueries = activeBiz.queries.filter(q => q.is_active).map(q => q.query_text)
      setFormQueries(activeQueries.length ? [...activeQueries, ''] : ['', ''])
    } else {
      setFormBizName('')
      setFormQueries(['', ''])
    }
    setScanFormError('')
    setShowScanForm(true)
  }

  async function handleRunScan() {
    if (!formBizName.trim()) { setScanFormError('Enter a business name.'); return }
    const filled = formQueries.filter(q => q.trim().length >= 3)
    if (!filled.length) { setScanFormError('Add at least one query (3+ characters).'); return }

    setIsScanning(true)
    setScanFormError('')

    try {
      const existing = businesses.find(b => b.name.toLowerCase() === formBizName.trim().toLowerCase())
      let bizId: string

      if (existing) {
        bizId = existing.id
      } else {
        const created = await createBusiness({ name: formBizName.trim(), queries: filled })
        bizId = created.business_id
      }

      const { scan_id } = await triggerScan(bizId)
      setShowScanForm(false)
      setScan(null)
      setError('')
      navigate(`/dashboard?scanId=${scan_id}`, { replace: true })
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('subscription')) {
        setShowScanForm(false)
        setUpgradeRequired(true)
      } else {
        setScanFormError(err.message ?? 'Failed to start scan.')
      }
    } finally {
      setIsScanning(false)
    }
  }

  // ── No scanId — resolving most recent scan ────────────────────────────────
  if (!scanId) {
    if (resolveState === 'loading') {
      return (
        <div style={s.page}>
          <DashboardNav email={user?.email} onSignOut={signOut} />
          <div style={s.runningState}>
            <div style={s.pulseRing} />
            <div style={s.pulseRingInner} />
            <div style={s.runningIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <h2 style={s.runningTitle}>Loading your report…</h2>
          </div>
        </div>
      )
    }
    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.emptyState}>
          <p style={s.emptyTitle}>No scans yet</p>
          <p style={s.emptyText}>Run your first scan to see how AI platforms are talking about your business.</p>
          <Link to="/#hero-form" style={{ ...s.backLink, display: 'inline-block', background: 'var(--accent)', color: '#000', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
            Run your first scan →
          </Link>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    const isSubscriptionError = error.toLowerCase().includes('subscription')
    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.emptyState}>
          {isSubscriptionError ? (
            <>
              <p style={s.emptyTitle}>Upgrade to run scans</p>
              <p style={s.emptyText}>An active subscription is required to scan AI platforms for your business.</p>
              <a href="/#pricing" style={{ ...s.backLink, display: 'inline-block', background: 'var(--accent)', color: '#000', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
                View pricing →
              </a>
            </>
          ) : (
            <>
              <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Error loading results</p>
              <p style={s.emptyText}>{error}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Loading / running ─────────────────────────────────────────────────────
  if (!scan || isRunning) {
    const activePlatforms = Object.keys(scan?.results?.[0]?.platforms ?? {})
    const displayPlatforms = activePlatforms.length
      ? activePlatforms.map(p => PLATFORM_LABELS[p] ?? p)
      : ['Perplexity']

    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.runningState}>
          <div style={s.pulseRing} />
          <div style={s.pulseRingInner} />
          <div style={s.runningIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <h2 style={s.runningTitle}>Scanning AI platforms…</h2>
          <p style={s.runningText}>
            Querying {displayPlatforms.join(' & ')} for{' '}
            <strong style={{ color: 'var(--text)' }}>{scan?.business_name ?? 'your business'}</strong>.
            <br />This usually takes 15–60 seconds.
          </p>
          <div style={s.platformPills}>
            {displayPlatforms.map(p => (
              <span key={p} style={s.platformPillRunning}>
                <span style={s.platformDot} />
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (scan.status === 'failed') {
    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.emptyState}>
          <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Scan failed</p>
          <p style={s.emptyText}>Something went wrong running the scan. Please try again.</p>
          <button
            onClick={handleOpenScanForm}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem', fontWeight: 600, fontFamily: "'Outfit',sans-serif", fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Try again →
          </button>
        </div>
        {showScanForm && (
          <ScanFormPanel
            bizName={formBizName} queries={formQueries} isScanning={isScanning} error={scanFormError}
            onBizNameChange={setFormBizName} onQueriesChange={setFormQueries}
            onSubmit={handleRunScan} onClose={() => setShowScanForm(false)}
          />
        )}
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const score = scan.visibility_score ?? 0
  const platforms = scan.results.length > 0 ? Object.keys(scan.results[0].platforms) : []

  return (
    <div style={s.page}>
      <DashboardNav email={user?.email} onSignOut={signOut} />

      {/* ── Business switcher (shown when user has multiple businesses) ── */}
      {businesses.length > 1 && (
        <div style={s.bizSwitcher}>
          <div style={s.bizSwitcherInner}>
            {businesses.map(biz => {
              const isActive = biz.name === scan.business_name
              const isLoading = switchingTo === biz.id
              return (
                <button
                  key={biz.id}
                  onClick={() => !isActive && handleSwitchBusiness(biz)}
                  disabled={isActive || isLoading}
                  style={{ ...s.bizTab, ...(isActive ? s.bizTabActive : {}), opacity: isLoading ? 0.5 : 1 }}
                >
                  {isLoading ? '…' : biz.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={s.content}>
        {/* ── Hero score section ── */}
        <div style={s.scoreSection}>
          <div style={s.scoreLeft}>
            <p style={s.eyebrow}>AI Visibility Report</p>
            <h1 style={s.businessName}>{scan.business_name}</h1>
            <p style={s.scanMeta}>
              Scanned {new Date(scan.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}{scan.results.length} quer{scan.results.length === 1 ? 'y' : 'ies'}
              {' · '}{platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')}
            </p>
            <button onClick={handleOpenScanForm} style={s.newScanBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
              New Scan
            </button>
          </div>

          <div style={s.scoreRight}>
            <div style={s.scoreDial}>
              <ScoreArc score={score} />
              <div style={s.scoreCenter}>
                <span style={{ ...s.scoreNumber, color: scoreColor(score) }}>{Math.round(score)}</span>
                <span style={s.scoreLabel}>/ 100</span>
              </div>
            </div>
            <p style={{ ...s.scoreGrade, color: scoreColor(score) }}>
              {score >= 70 ? 'Strong visibility' : score >= 40 ? 'Moderate visibility' : 'Low visibility'}
            </p>
          </div>
        </div>

        {/* ── Platform summary bar ── */}
        {platforms.length > 0 && (
          <div style={s.platformBar}>
            {platforms.map(platform => {
              const mentions = scan.results.filter(r => r.platforms[platform]?.mentioned).length
              const total = scan.results.length
              const pct = total > 0 ? Math.round((mentions / total) * 100) : 0
              return (
                <div key={platform} style={s.platformBarItem}>
                  <div style={s.platformBarHeader}>
                    <span style={{ ...s.platformDotLarge, background: PLATFORM_COLORS[platform] ?? 'var(--text-muted)' }} />
                    <span style={s.platformBarName}>{PLATFORM_LABELS[platform] ?? platform}</span>
                  </div>
                  <div style={s.platformBarTrack}>
                    <div style={{ ...s.platformBarFill, width: `${pct}%`, background: PLATFORM_COLORS[platform] ?? 'var(--accent)' }} />
                  </div>
                  <span style={s.platformBarPct}>
                    {mentions}/{total} queries <span style={{ color: 'var(--text-muted)' }}>mentioned</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Query results ── */}
        <div style={s.queriesSection}>
          <h2 style={s.sectionTitle}>Query Breakdown</h2>
          <div style={s.queryGrid}>
            {scan.results.map((result, i) => (
              <QueryCard key={result.query_id} result={result} index={i} platforms={platforms} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Scan form drawer ── */}
      {showScanForm && (
        <ScanFormPanel
          bizName={formBizName} queries={formQueries} isScanning={isScanning} error={scanFormError}
          onBizNameChange={setFormBizName} onQueriesChange={setFormQueries}
          onSubmit={handleRunScan} onClose={() => setShowScanForm(false)}
        />
      )}

      {/* ── Upgrade modal ── */}
      {upgradeRequired && <UpgradeModal onClose={() => setUpgradeRequired(false)} />}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DashboardNav({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <nav style={s.nav}>
      <Link to="/" style={s.navLogo}>
        <span style={{ color: 'var(--accent)' }}>AI</span> Brand Monitor
      </Link>
      <div style={s.navRight}>
        {email && <span style={s.navEmail}>{email}</span>}
        <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
      </div>
    </nav>
  )
}

interface ScanFormPanelProps {
  bizName: string
  queries: string[]
  isScanning: boolean
  error: string
  onBizNameChange: (v: string) => void
  onQueriesChange: (qs: string[]) => void
  onSubmit: () => void
  onClose: () => void
}

function ScanFormPanel({ bizName, queries, isScanning, error, onBizNameChange, onQueriesChange, onSubmit, onClose }: ScanFormPanelProps) {
  function updateQuery(i: number, val: string) {
    const next = [...queries]
    next[i] = val
    onQueriesChange(next)
  }
  function addQuery() {
    if (queries.length >= 10) return
    onQueriesChange([...queries, ''])
  }
  function removeQuery(i: number) {
    if (queries.length <= 1) return
    onQueriesChange(queries.filter((_, idx) => idx !== i))
  }

  return (
    <>
      <div style={s.formOverlay} onClick={onClose} />
      <div style={s.formPanel}>
        <div style={s.formPanelHeader}>
          <h3 style={s.formPanelTitle}>New Scan</h3>
          <button onClick={onClose} style={s.formCloseBtn} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p style={s.formPanelSub}>Update your business and queries, then run a fresh scan.</p>

        <div style={s.formGroup}>
          <label style={s.formLabel}>Business Name</label>
          <input
            style={s.formInput}
            type="text"
            value={bizName}
            onChange={e => onBizNameChange(e.target.value)}
            placeholder="e.g. Riverside Dental Studio"
            autoFocus
          />
        </div>

        <div style={s.formGroup}>
          <label style={s.formLabel}>
            <span>Queries</span>
            <span style={s.formLabelCount}>{queries.length} / 10</span>
          </label>
          <p style={s.formQueryHint}>What would a customer type into ChatGPT to find a business like yours?</p>
          <div style={s.formQueryList}>
            {queries.map((q, i) => (
              <div key={i} style={s.formQueryRow}>
                <input
                  style={s.formInput}
                  type="text"
                  value={q}
                  onChange={e => updateQuery(i, e.target.value)}
                  placeholder={i === 0 ? 'e.g. best plumber in Austin' : 'Another query…'}
                />
                {queries.length > 1 && (
                  <button onClick={() => removeQuery(i)} style={s.formQueryRemove} type="button">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addQuery} style={s.formAddQuery} type="button" disabled={queries.length >= 10}>
            + Add query
          </button>
        </div>

        {error && <p style={s.formError}>{error}</p>}

        <button onClick={onSubmit} style={{ ...s.formSubmitBtn, opacity: isScanning ? 0.7 : 1 }} disabled={isScanning}>
          {isScanning ? 'Starting scan…' : 'Run Scan →'}
        </button>
      </div>
    </>
  )
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h3 style={s.modalTitle}>Free scan already used</h3>
        <p style={s.modalBody}>
          Your free scan has been used. Upgrade to run unlimited scans across ChatGPT, Claude, and Perplexity — plus weekly monitoring and trend tracking.
        </p>
        <div style={s.modalActions}>
          <a href="/#pricing" style={s.modalPrimaryBtn}>View plans →</a>
          <button onClick={onClose} style={s.modalSecondaryBtn}>Not now</button>
        </div>
      </div>
    </div>
  )
}

function QueryCard({ result, index, platforms }: { result: QueryResult; index: number; platforms: string[] }) {
  const anyMentioned = platforms.some(p => result.platforms[p]?.mentioned)

  return (
    <div style={{ ...s.queryCard, animation: `fadeUp 0.4s cubic-bezier(.22,1,.36,1) ${index * 0.06}s both` }}>
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
              <span style={{ ...s.chipDot, background: pr?.mentioned ? color : 'var(--text-dim)' }} />
              <span style={{ ...s.chipName, color: pr?.mentioned ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
              {pr?.mentioned && (
                <>
                  {pr.mention_position && <span style={s.chipPos}>#{pr.mention_position}</span>}
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
          {Array.from(new Set(platforms.flatMap(p => result.platforms[p]?.competitors_mentioned ?? []))).map(c => (
            <span key={c} style={s.competitorChip}>{c}</span>
          ))}
        </div>
      )}

      <div style={s.scoreStrip}>
        <span style={s.scoreStripLabel}>Query score</span>
        <span style={{ ...s.scoreStripValue, color: anyMentioned ? 'var(--green)' : 'var(--text-muted)' }}>
          {platforms.reduce((sum, p) => sum + (result.platforms[p]?.scores.total ?? 0), 0)} pts
        </span>
      </div>
    </div>
  )
}

function ScoreArc({ score }: { score: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  const color = scoreColor(score)

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${color}60)` }}
      />
    </svg>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: "'Outfit', sans-serif",
    color: 'var(--text)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.1rem 2rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navLogo: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.25rem',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navEmail: {
    fontSize: '0.8rem',
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
  // Business switcher
  bizSwitcher: {
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    padding: '0 2rem',
  },
  bizSwitcherInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'flex',
    overflowX: 'auto' as const,
  },
  bizTab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '0.7rem 1.2rem',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.15s, border-color 0.15s',
  },
  bizTabActive: {
    color: 'var(--text)',
    borderBottomColor: 'var(--accent)',
  },
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '3rem 2rem',
  },
  // Score section
  scoreSection: {
    display: 'flex',
    alignItems: 'flex-start',
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
    marginBottom: '1.25rem',
  },
  newScanBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'var(--accent)',
    color: '#000',
    border: 'none',
    borderRadius: '7px',
    padding: '0.55rem 1.1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
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
  // Queries
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
  chipDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
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
  competitorsLabel: { fontSize: '0.72rem', color: 'var(--text-dim)', flexShrink: 0 },
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
  // Running / empty states
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
  backLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: '0.9rem',
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
  // Scan form drawer
  formOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
  },
  formPanel: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: '420px',
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    zIndex: 201,
    overflowY: 'auto' as const,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
    animation: 'slideInRight 0.25s cubic-bezier(.22,1,.36,1)',
  },
  formPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formPanelTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.4rem',
    fontWeight: 400,
    color: 'var(--text)',
  },
  formCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  formPanelSub: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    marginTop: '-0.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  formLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formLabelCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    fontWeight: 400,
    textTransform: 'none' as const,
    letterSpacing: 0,
  },
  formQueryHint: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
    marginTop: '-0.25rem',
  },
  formInput: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    color: 'var(--text)',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.9rem',
    padding: '0.6rem 0.9rem',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  formQueryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  formQueryRow: {
    display: 'flex',
    gap: '0.4rem',
    alignItems: 'center',
  },
  formQueryRemove: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-dim)',
    width: '32px',
    height: '36px',
    flexShrink: 0,
    cursor: 'pointer',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formAddQuery: {
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: '7px',
    color: 'var(--text-muted)',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.82rem',
    padding: '0.5rem',
    cursor: 'pointer',
    width: '100%',
  },
  formError: {
    fontSize: '0.8rem',
    color: 'var(--red)',
    margin: 0,
  },
  formSubmitBtn: {
    background: 'var(--accent)',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '0.85rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    marginTop: 'auto',
  },
  // Upgrade modal
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center' as const,
    animation: 'fadeUp 0.3s cubic-bezier(.22,1,.36,1)',
  },
  modalIcon: {
    width: '56px',
    height: '56px',
    background: 'rgba(240,165,0,0.08)',
    border: '1px solid rgba(240,165,0,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  },
  modalTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.6rem',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '0.75rem',
  },
  modalBody: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '2rem',
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
  },
  modalPrimaryBtn: {
    display: 'block',
    background: 'var(--accent)',
    color: '#000',
    textDecoration: 'none',
    padding: '0.85rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  modalSecondaryBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    padding: '0.75rem',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
}
