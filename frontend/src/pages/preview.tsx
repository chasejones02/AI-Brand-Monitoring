/**
 * PreviewPage — Review generated queries before consuming a free scan.
 * Free users see read-only cards. Locked CTAs hint at paid editing.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { Nav } from '../components/nav'
import { CrystalCursor } from '../components/crystal-cursor'
import { TiltCard } from '../components/ui/tilt-card'
import { GlowCard } from '../components/ui/spotlight-card'
import {
  triggerScan,
  getBusinessTrackingSets,
  ApiError,
  type PreviewQuery,
  type TrackingSetQuery,
} from '../lib/api'

type Tier = 'free' | 'starter' | 'growth' | 'agency'

interface PreviewState {
  queries: PreviewQuery[]
  tier: Tier
  defaultSetId: string
}

const INTENT_LABELS: Record<string, string> = {
  category: 'Category',
  local_comparison: 'Comparison',
  problem: 'Problem',
  recommendation: 'Recommendation',
  attribute: 'Attribute',
}

function intentLabel(intent: string | null): string {
  if (!intent) return 'Query'
  return INTENT_LABELS[intent] ?? intent
}

export default function PreviewPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const initialState = (location.state ?? null) as PreviewState | null

  const [queries, setQueries] = useState<PreviewQuery[]>(initialState?.queries ?? [])
  const [tier, setTier] = useState<Tier>(initialState?.tier ?? 'free')
  const [defaultSetId, setDefaultSetId] = useState<string>(initialState?.defaultSetId ?? '')
  const [loading, setLoading] = useState(!initialState)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialState || !businessId) return
    let cancelled = false
    setLoading(true)
    getBusinessTrackingSets(businessId)
      .then(res => {
        if (cancelled) return
        const defaultSet = res.sets[0]
        if (!defaultSet) {
          setError('Could not find your queries. Try starting over.')
          return
        }
        setTier(res.tier)
        setDefaultSetId(defaultSet.id)
        setQueries(
          defaultSet.queries.map((q: TrackingSetQuery) => ({
            id: q.id,
            query_text: q.query_text,
            source: q.source ?? 'generated',
            intent: q.intent ?? null,
            generation_reason: q.generation_reason ?? null,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your queries. Try starting over.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [businessId, initialState])

  async function handleRunScan() {
    if (!businessId || running) return
    setRunning(true)
    setError('')
    try {
      const { scan_id } = await triggerScan(businessId, defaultSetId || undefined)
      navigate(`/dashboard?scanId=${scan_id}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'subscription_required') {
        gotoPricing()
        return
      }
      const msg = err instanceof Error ? err.message : 'Could not start your scan.'
      setError(msg)
      setRunning(false)
    }
  }

  function gotoPricing() {
    if (!businessId) {
      navigate('/pricing')
      return
    }
    navigate('/pricing', {
      state: {
        returnTo: `/preview/${businessId}`,
        returnLabel: 'your query preview',
        // After Stripe completes, /success uses this to drop the user straight
        // onto the dashboard focused on the set they were previewing.
        returnSetId: defaultSetId || undefined,
      },
    })
  }

  const isFree = tier === 'free' || tier === 'agency'
  const queryCount = queries.length

  return (
    <div className="qpv-root">
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />
      <Nav />

      <main className="qpv-main">
        <div className="container qpv-container">
          <header className="qpv-header">
            <div className="qpv-header-left">
              <span className="qpv-kicker anim-1">Step 2 of 3 — Review</span>
              <h1 className="qpv-title anim-2">
                These are the <em>questions</em> we'll ask the AI.
              </h1>
              <p className="qpv-sub anim-3">
                Each prompt is sent verbatim to the AI platforms — exactly the way a stranger
                might type it. None of them include your business name, so what comes back is
                a true read on whether the AI surfaces you on its own.
              </p>
            </div>
            <aside className="qpv-meta anim-4" aria-label="Scan summary">
              <div className="qpv-meta-row">
                <span className="qpv-meta-label">Queries</span>
                <span className="qpv-meta-value mono">{String(queryCount).padStart(2, '0')}</span>
              </div>
              <div className="qpv-meta-row">
                <span className="qpv-meta-label">Platform</span>
                <span className="qpv-meta-value">{isFree ? 'Perplexity' : 'All 4'}</span>
              </div>
              <div className="qpv-meta-row">
                <span className="qpv-meta-label">Est. time</span>
                <span className="qpv-meta-value mono">~90s</span>
              </div>
            </aside>
          </header>

          {loading ? (
            <div className="qpv-loading">
              <div className="spinner" />
              <p>Generating your prompts…</p>
            </div>
          ) : error && !queryCount ? (
            <div className="qpv-error-box">
              <p>{error}</p>
              <Link to="/analyze" className="qpv-link">Start over →</Link>
            </div>
          ) : (
            <>
              <ol className="qpv-list">
                {queries.map((q, idx) => (
                  <li
                    key={q.id}
                    className="qpv-card-wrap"
                    style={{ animationDelay: `${0.35 + idx * 0.08}s` }}
                  >
                    <TiltCard className="qpv-tilt" maxTilt={3}>
                      <GlowCard customSize radius={14} className="qpv-glow !block !p-0 !gap-0">
                        <div className="qpv-card">
                          <div className="qpv-card-numeral mono">{String(idx + 1).padStart(2, '0')}</div>
                          <div className="qpv-card-body">
                            <p className="qpv-card-query">{q.query_text}</p>
                            <div className="qpv-card-meta">
                              <span className="qpv-chip">{intentLabel(q.intent)}</span>
                              {q.generation_reason && (
                                <span className="qpv-card-reason">{q.generation_reason}</span>
                              )}
                            </div>
                          </div>
                          {isFree && (
                            <button
                              type="button"
                              className="qpv-card-edit"
                              title="Editing prompts is a paid feature"
                              onClick={gotoPricing}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Edit
                            </button>
                          )}
                        </div>
                      </GlowCard>
                    </TiltCard>
                  </li>
                ))}

                {isFree && (
                  <li
                    className="qpv-card-wrap"
                    style={{ animationDelay: `${0.35 + queryCount * 0.08}s` }}
                  >
                    <TiltCard className="qpv-tilt" maxTilt={3}>
                      <GlowCard customSize radius={14} className="qpv-glow !block !p-0 !gap-0">
                        <div className="qpv-locked">
                          <div className="qpv-locked-icon" aria-hidden>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </div>
                          <div className="qpv-locked-body">
                            <p className="qpv-locked-title">Track the exact searches you care about.</p>
                            <p className="qpv-locked-sub">
                              Starter and Growth unlock custom prompts — write your own or edit any of the five above.
                            </p>
                          </div>
                          <button type="button" className="qpv-locked-cta" onClick={gotoPricing}>
                            Unlock →
                          </button>
                        </div>
                      </GlowCard>
                    </TiltCard>
                  </li>
                )}
              </ol>

              {error && <p className="qpv-error-inline">{error}</p>}
            </>
          )}
        </div>

        <div className="qpv-actionbar" role="region" aria-label="Scan controls">
          <div className="container qpv-actionbar-inner">
            <Link to="/analyze" className="qpv-cancel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Start over
            </Link>
            <div className="qpv-actionbar-right">
              {isFree && (
                <span className="qpv-actionbar-note">
                  Running this scan uses your <strong>free lifetime scan</strong>.
                </span>
              )}
              <button
                type="button"
                className="btn-primary qpv-run-btn"
                disabled={running || loading || !queryCount}
                onClick={handleRunScan}
              >
                {running ? (
                  <>
                    <div className="spinner" />
                    Starting…
                  </>
                ) : (
                  <>
                    Run my scan
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m13 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
