import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { GlowCard } from '../components/ui/spotlight-card'
import { TiltCard } from '../components/ui/tilt-card'
import { getSubscription, createPortalSession, getQuota, type QuotaStatus } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'free' | 'starter' | 'growth'
type Status = 'free' | 'active' | 'canceled' | 'past_due'

interface SubscriptionData {
  status: Status
  tier: Tier
  has_customer: boolean
}

// ─── Plan metadata ────────────────────────────────────────────────────────────

const PLAN_META: Record<Tier, {
  label: string
  price: string
  period: string
  color: string
  features: string[]
}> = {
  free: {
    label: 'Free Snapshot',
    price: '$0',
    period: 'one-time',
    color: 'var(--text-muted)',
    features: [
      'Perplexity scan only',
      '5 auto-generated queries',
      'Full raw AI responses',
      'Plain-English score breakdown',
      '1 lifetime scan',
    ],
  },
  starter: {
    label: 'Starter',
    price: '$29',
    period: 'per month',
    color: 'var(--accent)',
    features: [
      'All platforms — ChatGPT, Claude, Gemini, Perplexity',
      '25 on-demand scans per month',
      '10 queries per scan',
      'Competitor extraction',
      'Scan history & trend graph',
      '1 business profile',
    ],
  },
  growth: {
    label: 'Growth',
    price: '$49',
    period: 'per month',
    color: 'var(--green)',
    features: [
      'All platforms — ChatGPT, Claude, Gemini, Perplexity',
      '40 on-demand scans per month',
      '20 custom queries',
      'Up to 5 tracked competitors',
      'Full historical trend graphs',
      'Sentiment trend over time',
      'Confidence indicator per score',
    ],
  },
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  free:      { label: 'Free plan',       color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' },
  active:    { label: 'Active',          color: 'var(--green)',       bg: 'rgba(34,197,94,0.08)' },
  canceled:  { label: 'Canceled',        color: 'var(--red)',         bg: 'rgba(239,68,68,0.08)' },
  past_due:  { label: 'Payment issue',   color: 'var(--accent)',      bg: 'rgba(201,143,10,0.08)' },
}

// ─── AccountPage ──────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, signOut } = useAuth()

  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Fetch independently — a quota failure must NOT hide the plan. Using
    // Promise.all here previously meant any quota error rejected the whole
    // load, leaving `sub` null and rendering an active subscriber as "Free".
    Promise.allSettled([getSubscription(), getQuota()])
      .then(([subRes, quotaRes]) => {
        if (cancelled) return
        if (subRes.status === 'fulfilled') {
          setSub(subRes.value)
        } else {
          // Only the subscription is essential to this page — surface its error.
          setError(subRes.reason?.message ?? 'Failed to load subscription')
        }
        if (quotaRes.status === 'fulfilled') {
          setQuota(quotaRes.value)
        }
        // Quota failures are non-fatal: the usage card simply hides.
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function handleManage() {
    setPortalLoading(true)
    setError('')
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (err: any) {
      setError(err.message ?? 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  const plan = PLAN_META[sub?.tier ?? 'free']
  const statusMeta = STATUS_META[sub?.status ?? 'free']
  const isPaid = sub?.status === 'active' || sub?.status === 'past_due'
  const canManage = isPaid && sub?.has_customer

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Nav — inherits transparent/fixed style from globals.css */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <Link to="/" style={s.navLogo}>
            <img src="/logo-eye.png" alt="Visaion" style={{ height: '40px', width: 'auto', display: 'block' }} />
            <span>Vis<span style={{ color: 'var(--accent)' }}>ai</span>on</span>
          </Link>
        </div>
        <div className="acct-nav-right" style={s.navRight}>
          {user?.email && <span style={s.navEmail}>{user.email}</span>}
          <Link to="/dashboard" style={s.navLink}>Dashboard</Link>
          <button onClick={signOut} style={s.signOutBtn}>Sign out</button>
        </div>

        {/* Hamburger — hidden on desktop, shown ≤900px (see globals.css) */}
        <button
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className={`nav-burger-icon${menuOpen ? ' open' : ''}`}>
            <span></span><span></span><span></span>
          </span>
        </button>

        <div className={`nav-mobile-menu${menuOpen ? ' open' : ''}`}>
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          <button className="nav-mobile-action" onClick={() => { setMenuOpen(false); signOut() }}>Sign out</button>
        </div>
      </nav>

      <div className="acct-content" style={s.content}>
        {/* Back */}
        <Link to="/dashboard" style={s.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to dashboard
        </Link>

        {/* Header */}
        <div style={s.header}>
          <p style={s.eyebrow}>Account</p>
          <h1 style={s.title}>Subscription & Billing</h1>
          <p style={s.subtitle}>Manage your plan, usage, and payment details.</p>
        </div>

        {error && (
          <div style={s.errorBanner}>
            {error}
            <button onClick={() => setError('')} style={s.errorDismiss}>×</button>
          </div>
        )}

        {loading ? (
          <div style={s.loadingState}>
            <div style={s.spinner} />
            <p style={s.loadingText}>Loading your account…</p>
          </div>
        ) : (
          <div className="acct-grid" style={s.grid}>

            {/* ── Plan card ── */}
            <TiltCard maxTilt={4} style={{ gridColumn: '1 / -1', animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) 0.05s both' }}>
              <GlowCard customSize radius={14} className="!block !p-0">
                <div className="acct-plan-card" style={s.planCard}>
                  <div style={s.planCardLeft}>
                    <div style={s.planCardTop}>
                      <span style={{ ...s.statusBadge, color: statusMeta.color, background: statusMeta.bg }}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div style={{ ...s.planAccent, background: plan.color }} />
                    <p style={s.planTierLabel}>Current plan</p>
                    <h2 style={{ ...s.planName, color: plan.color }}>{plan.label}</h2>
                    <div style={s.planPricing}>
                      <span style={s.planPrice}>{plan.price}</span>
                      <span style={s.planPeriod}>{plan.period}</span>
                    </div>

                    {sub?.status === 'past_due' && (
                      <p style={s.pastDueNote}>
                        ⚠ Your last payment failed. Update your payment method to avoid losing access.
                      </p>
                    )}
                    {sub?.status === 'canceled' && (
                      <p style={s.canceledNote}>
                        Your subscription is canceled. You may still have access until the end of your billing period.
                      </p>
                    )}
                  </div>

                  <div style={s.planCardRight}>
                    <ul style={s.featureList}>
                      {plan.features.map(f => (
                        <li key={f} style={s.featureItem}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={plan.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <div style={s.planActions}>
                      {canManage ? (
                        <button
                          onClick={handleManage}
                          disabled={portalLoading}
                          style={{ ...s.primaryBtn, opacity: portalLoading ? 0.6 : 1 }}
                        >
                          {portalLoading ? 'Opening portal…' : 'Manage subscription →'}
                        </button>
                      ) : sub?.status === 'canceled' && sub?.has_customer ? (
                        <button onClick={handleManage} disabled={portalLoading} style={s.primaryBtn}>
                          {portalLoading ? 'Opening portal…' : 'Resubscribe →'}
                        </button>
                      ) : (
                        <Link to="/pricing" style={s.upgradeBtnLink}>
                          Upgrade plan →
                        </Link>
                      )}
                      {canManage && (
                        <p style={s.portalNote}>
                          Upgrade, downgrade, cancel, or update your payment method via Stripe's secure portal.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </GlowCard>
            </TiltCard>

            {/* ── Usage card ── */}
            {quota && (
              <TiltCard maxTilt={5} style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) 0.12s both' }}>
                <GlowCard customSize radius={12} className="!block !p-0">
                  <div style={s.usageCard}>
                    <p style={s.cardEyebrow}>Monthly usage</p>
                    <div style={s.usageRow}>
                      <span style={s.usageNum}>{quota.used_in_window}</span>
                      <span style={s.usageDivider}>/</span>
                      <span style={s.usageTotal}>
                        {quota.daily_limit === 0 ? '∞' : quota.daily_limit}
                      </span>
                      <span style={s.usageUnit}>scans this month</span>
                    </div>
                    <div style={s.usageTrack}>
                      <div style={{
                        ...s.usageFill,
                        width: quota.daily_limit > 0
                          ? `${Math.min(100, (quota.used_in_window / quota.daily_limit) * 100)}%`
                          : '0%',
                        background: quota.remaining <= 0 ? 'var(--red)' : 'var(--accent)',
                      }} />
                    </div>
                    {quota.remaining <= 0 && quota.next_reset_at && (
                      <p style={s.usageReset}>
                        Next scan frees up {new Date(quota.next_reset_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </p>
                    )}
                    {quota.remaining > 0 && (
                      <p style={s.usageRemaining}>
                        {quota.remaining} scan{quota.remaining !== 1 ? 's' : ''} remaining this month
                      </p>
                    )}
                  </div>
                </GlowCard>
              </TiltCard>
            )}

            {/* ── Billing portal card (paid only) ── */}
            {canManage && (
              <TiltCard maxTilt={5} style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) 0.18s both' }}>
                <GlowCard customSize radius={12} className="!block !p-0">
                  <div style={s.portalCard}>
                    <p style={s.cardEyebrow}>Billing</p>
                    <p style={s.portalCardTitle}>Stripe portal</p>
                    <p style={s.portalCardDesc}>
                      View invoices, update your payment method, or change your plan — all via Stripe's secure portal.
                    </p>
                    <button
                      onClick={handleManage}
                      disabled={portalLoading}
                      style={{ ...s.secondaryBtn, marginTop: 'auto', opacity: portalLoading ? 0.6 : 1 }}
                    >
                      {portalLoading ? 'Opening…' : 'Open billing portal →'}
                    </button>
                  </div>
                </GlowCard>
              </TiltCard>
            )}

            {/* ── Upgrade prompt (free only) ── */}
            {!isPaid && (
              <TiltCard maxTilt={5} style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) 0.18s both' }}>
                <GlowCard customSize radius={12} className="!block !p-0">
                  <div style={s.upgradeCard}>
                    <p style={s.cardEyebrow}>Unlock more</p>
                    <p style={s.upgradeCardTitle}>Ready to go deeper?</p>
                    <ul style={{ ...s.featureList, marginBottom: '1.5rem' }}>
                      {[
                        'ChatGPT, Claude & Gemini results',
                        'On-demand rescans to track changes',
                        'Competitor analysis',
                        'Historical trend graphs',
                      ].map(f => (
                        <li key={f} style={s.featureItem}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/pricing" style={s.upgradeBtnLink}>See plans →</Link>
                  </div>
                </GlowCard>
              </TiltCard>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: "'Outfit', sans-serif",
    color: 'var(--text)',
    paddingTop: '76px',
  },

  // Nav — inherits transparent/fixed from globals.css nav {}
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2.5rem',
    gap: '1rem',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
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
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    position: 'relative' as const,
    zIndex: 1,
  },
  navEmail: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.45)',
  },
  navLink: {
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontWeight: 500,
    padding: '0.35rem 0.75rem',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.05)',
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

  // Page layout
  content: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2.5rem 2.5rem 5rem',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    marginBottom: '2.5rem',
    transition: 'color 0.15s',
  },
  header: {
    marginBottom: '2.5rem',
  },
  eyebrow: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: '0.5rem',
  },
  title: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem',
  },

  // Plan card (spans full width)
  planCard: {
    display: 'flex',
    gap: '3rem',
    padding: '2rem 2.25rem',
    flexWrap: 'wrap' as const,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  planCardLeft: {
    flex: '0 0 220px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.35rem',
    position: 'relative' as const,
  },
  planCardTop: {
    marginBottom: '0.75rem',
  },
  planAccent: {
    position: 'absolute' as const,
    top: '-2rem',
    left: '-2.25rem',
    width: '3px',
    height: 'calc(100% + 4rem)',
    borderRadius: '0 2px 2px 0',
    opacity: 0.7,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    border: '1px solid currentColor',
    opacity: 0.85,
  },
  planTierLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    marginBottom: '0.25rem',
  },
  planName: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '2rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    marginBottom: '0.5rem',
  },
  planPricing: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    marginTop: '0.25rem',
  },
  planPrice: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  planPeriod: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  pastDueNote: {
    marginTop: '1rem',
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: 'var(--accent)',
    background: 'rgba(201,143,10,0.07)',
    border: '1px solid rgba(201,143,10,0.2)',
    borderRadius: '6px',
    padding: '0.6rem 0.85rem',
  },
  canceledNote: {
    marginTop: '1rem',
    fontSize: '0.82rem',
    lineHeight: 1.5,
    color: 'var(--text-muted)',
    background: 'rgba(239,68,68,0.05)',
    border: '1px solid rgba(239,68,68,0.12)',
    borderRadius: '6px',
    padding: '0.6rem 0.85rem',
  },
  planCardRight: {
    flex: 1,
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  featureList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
    margin: 0,
    padding: 0,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.55rem',
    fontSize: '0.88rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  planActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.65rem',
    marginTop: 'auto',
  },
  primaryBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    padding: '0.75rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    width: '100%',
    letterSpacing: '0.01em',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    padding: '0.7rem 1.5rem',
    fontSize: '0.88rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, color 0.15s',
  },
  upgradeBtnLink: {
    display: 'block',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    padding: '0.75rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center' as const,
    letterSpacing: '0.01em',
  },
  portalNote: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
  },

  // Usage card
  usageCard: {
    padding: '1.75rem 2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    height: '100%',
    boxSizing: 'border-box' as const,
  },
  cardEyebrow: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: '0.25rem',
  },
  usageRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
  },
  usageNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '2.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1,
  },
  usageDivider: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1.2rem',
    color: 'var(--text-dim)',
  },
  usageTotal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  usageUnit: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    marginLeft: '0.25rem',
  },
  usageTrack: {
    height: '4px',
    background: 'var(--surface-2)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '0.5rem',
  },
  usageFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.8s ease',
  },
  usageReset: {
    fontSize: '0.78rem',
    color: 'var(--red)',
    marginTop: '0.25rem',
  },
  usageRemaining: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem',
  },

  // Portal / upgrade cards
  portalCard: {
    padding: '1.75rem 2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
    height: '100%',
    boxSizing: 'border-box' as const,
  },
  portalCardTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  portalCardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    flex: 1,
  },
  upgradeCard: {
    padding: '1.75rem 2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
    height: '100%',
    boxSizing: 'border-box' as const,
  },
  upgradeCardTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '0.5rem',
  },

  // Error / loading
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.18)',
    borderRadius: '8px',
    padding: '0.85rem 1.25rem',
    fontSize: '0.85rem',
    color: 'var(--red)',
    marginBottom: '1.5rem',
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
  loadingState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    paddingTop: '6rem',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
}
