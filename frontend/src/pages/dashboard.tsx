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
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { getScanResults } from '../lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  const scanId = searchParams.get('scanId')

  const [scan, setScan] = useState<ScanData | null>(null)
  const [error, setError] = useState('')
  const [pollCount, setPollCount] = useState(0)

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

  // ── No scanId ─────────────────────────────────────────────────────────────
  if (!scanId) {
    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.emptyState}>
          <p style={s.emptyTitle}>No scan selected</p>
          <p style={s.emptyText}>Go back to the homepage to run your first scan.</p>
          <Link to="/" style={s.backLink}>← Back to homepage</Link>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={s.page}>
        <DashboardNav email={user?.email} onSignOut={signOut} />
        <div style={s.emptyState}>
          <p style={{ ...s.emptyTitle, color: 'var(--red)' }}>Error loading results</p>
          <p style={s.emptyText}>{error}</p>
        </div>
      </div>
    )
  }

  // ── Loading / running ─────────────────────────────────────────────────────
  if (!scan || isRunning) {
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
            Querying ChatGPT and Claude for <strong style={{ color: 'var(--text)' }}>{scan?.business_name ?? 'your business'}</strong>.
            <br />This usually takes 15–60 seconds.
          </p>
          <div style={s.platformPills}>
            {['ChatGPT', 'Claude'].map(p => (
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
          <p style={s.emptyText}>Something went wrong running the scan. Please try again from the homepage.</p>
          <Link to="/" style={s.backLink}>← Run a new scan</Link>
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const score = scan.visibility_score ?? 0
  const platforms = scan.results.length > 0
    ? Object.keys(scan.results[0].platforms)
    : []

  return (
    <div style={s.page}>
      <DashboardNav email={user?.email} onSignOut={signOut} />

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

function QueryCard({ result, index, platforms }: { result: QueryResult; index: number; platforms: string[] }) {
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
              <span style={{ ...s.chipDot, background: pr?.mentioned ? color : 'var(--text-dim)' }} />
              <span style={{ ...s.chipName, color: pr?.mentioned ? 'var(--text)' : 'var(--text-muted)' }}>
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
              {!pr?.mentioned && (
                <span style={s.chipMissed}>not mentioned</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Competitors */}
      {platforms.some(p => (result.platforms[p]?.competitors_mentioned ?? []).length > 0) && (
        <div style={s.competitors}>
          <span style={s.competitorsLabel}>Also mentioned: </span>
          {Array.from(new Set(
            platforms.flatMap(p => result.platforms[p]?.competitors_mentioned ?? [])
          )).map(c => (
            <span key={c} style={s.competitorChip}>{c}</span>
          ))}
        </div>
      )}

      {/* Score strip */}
      <div style={s.scoreStrip}>
        <span style={s.scoreStripLabel}>Query score</span>
        <span style={{
          ...s.scoreStripValue,
          color: anyMentioned ? 'var(--green)' : 'var(--text-muted)',
        }}>
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
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
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
  content: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '3rem 2rem',
  },
  // Score section
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
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
  platformChipMentioned: {
    background: 'rgba(255,255,255,0.03)',
  },
  platformChipMissed: {
    background: 'transparent',
    opacity: 0.6,
  },
  chipDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  chipName: {
    fontWeight: 500,
    flex: 1,
  },
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
  chipMissed: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
  },
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
}
