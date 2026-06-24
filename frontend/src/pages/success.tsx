/**
 * Success — shown after a successful Stripe checkout.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { verifyCheckoutSession } from '../lib/api'

export default function SuccessPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [visible, setVisible] = useState(false)

  // When the user came here via "upgrade from preview", Stripe's success_url
  // includes the tracking-set ID. We forward them straight to the dashboard
  // focused on that set so they don't lose their place.
  const returnSetId = searchParams.get('setId')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Webhook-independent activation: ask the backend to verify the Stripe
  // session and flip the profile. Safe to call even if the webhook already
  // fired — the update is idempotent. When verification succeeds AND we have
  // a setId carried through from the preview flow, redirect to the dashboard
  // so the user lands on their queries instead of staying on this card.
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return
    verifyCheckoutSession(sessionId)
      .then(result => {
        if (result?.activated && returnSetId) {
          navigate(`/dashboard?setId=${returnSetId}&welcome=1`, { replace: true })
        }
      })
      .catch(err => {
        console.warn('Stripe session verification failed:', err)
      })
  }, [searchParams, navigate, returnSetId])

  return (
    <div style={s.page}>

      <div style={{ ...s.card, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>

        {/* Logo */}
        <Link to="/" style={s.logo}>
          <img src="/logo-eye.png" alt="Visaion" style={{ height: '36px', width: 'auto', marginRight: '8px', verticalAlign: 'middle' }} />
          Vis<span style={{ color: 'var(--accent)' }}>ai</span>on
        </Link>

        {/* Check icon */}
        <div style={s.iconWrap}>
          <div style={s.iconRing} />
          <div style={s.iconInner}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <p style={s.eyebrow}>Payment confirmed</p>
        <h1 style={s.heading}>You're all set.</h1>
        <p style={s.body}>
          Your subscription is now active.{user?.email ? ` We'll send updates to ${user.email}.` : ''}
          {' '}Run your first scan to see how AI platforms are talking about your business.
        </p>

        <div style={s.actions}>
          <Link to="/dashboard" style={s.primaryBtn}>
            Go to dashboard →
          </Link>
          <Link to="/analyze" style={s.secondaryBtn}>
            Run a scan
          </Link>
        </div>

        <div style={s.divider} />

        <p style={s.footer}>
          Questions? Reply to your confirmation email or{' '}
          <a href="mailto:support@visaionbrand.com" style={s.footerLink}>contact support</a>.
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    fontFamily: "'Outfit', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    position: 'relative',
    maxWidth: '480px',
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '3rem 2.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0',
  },
  logo: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.1rem',
    color: 'var(--text)',
    textDecoration: 'none',
    marginBottom: '2.5rem',
    opacity: 0.7,
  },
  iconWrap: {
    position: 'relative',
    width: '72px',
    height: '72px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.75rem',
  },
  iconRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid rgba(34,197,94,0.2)',
  },
  iconInner: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--green)',
    marginBottom: '0.5rem',
  },
  heading: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '2.4rem',
    fontWeight: 400,
    color: 'var(--text)',
    lineHeight: 1.1,
    marginBottom: '1rem',
  },
  body: {
    fontSize: '0.92rem',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '2rem',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
    width: '100%',
    marginBottom: '2rem',
  },
  primaryBtn: {
    display: 'block',
    background: 'var(--accent)',
    color: '#000',
    textDecoration: 'none',
    padding: '0.85rem 1.5rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.95rem',
    transition: 'opacity 0.2s',
  },
  secondaryBtn: {
    display: 'block',
    background: 'transparent',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '0.9rem',
    transition: 'border-color 0.2s, color 0.2s',
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'var(--border)',
    marginBottom: '1.25rem',
  },
  footer: {
    fontSize: '0.78rem',
    color: 'var(--text-dim)',
  },
  footerLink: {
    color: 'var(--text-muted)',
  },
}
