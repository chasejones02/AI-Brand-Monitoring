/**
 * Success — shown after a successful Stripe checkout.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'

export default function SuccessPage() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Staggered reveal
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={s.page}>
      {/* Radial glow */}
      <div style={s.glow} />

      <div style={{ ...s.card, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>

        {/* Logo */}
        <Link to="/" style={s.logo}>
          <span style={{ color: 'var(--accent)' }}>AI</span> Brand Monitor
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
          <Link to="/#get-report" style={s.secondaryBtn}>
            Run a scan
          </Link>
        </div>

        <div style={s.divider} />

        <p style={s.footer}>
          Questions? Reply to your confirmation email or{' '}
          <a href="mailto:support@aibrandmonitor.com" style={s.footerLink}>contact support</a>.
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
  glow: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '600px',
    height: '400px',
    background: 'radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    maxWidth: '480px',
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '3rem 2.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0',
  },
  logo: {
    fontFamily: "'Instrument Serif', serif",
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
    animation: 'glow-pulse 2.5s ease-in-out infinite',
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
    fontFamily: "'Instrument Serif', serif",
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
