/**
 * Auth page — Login / Signup / Password Reset
 *
 * Design: split-panel, editorial dark. Left panel is brand/copy,
 * right panel is the form. Collapses to single column on mobile.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'

type Mode = 'login' | 'signup' | 'reset' | 'new-password'

export default function AuthPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const isRecovery = useRef(false)
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Redirect if already logged in — but not during password recovery
  useEffect(() => {
    if (session && !isRecovery.current) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  // Handle Supabase password recovery redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery.current = true
        setMode('new-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        })
        if (resetError) throw resetError
        setResetSent(true)
        return
      }

      if (mode === 'new-password') {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
        if (updateError) throw updateError
        navigate('/dashboard', { replace: true })
        return
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (signUpError) throw signUpError
        // If email confirmation required, show check-email state
        if (!data.session) {
          setCheckEmail(true)
          return
        }
        // Session available immediately (email confirmation disabled)
        navigate('/dashboard')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Check-email screen after signup (email confirmation enabled)
  if (checkEmail) {
    return (
      <div style={styles.page}>
        <div style={styles.checkEmailBox}>
          <div style={styles.checkIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 style={styles.checkTitle}>Check your inbox</h2>
          <p style={styles.checkText}>
            We sent a confirmation link to <strong style={{ color: 'var(--accent)' }}>{email}</strong>.<br />
            Click it to activate your account, then come back to log in.
          </p>
          <button
            onClick={() => { setCheckEmail(false); setMode('login') }}
            style={styles.switchBtn}
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // Reset-sent screen after requesting a password reset
  if (resetSent) {
    return (
      <div style={styles.page}>
        <div style={styles.checkEmailBox}>
          <div style={styles.checkIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 style={styles.checkTitle}>Check your inbox</h2>
          <p style={styles.checkText}>
            We sent a password reset link to <strong style={{ color: 'var(--accent)' }}>{email}</strong>.<br />
            Click it to set a new password.
          </p>
          <button
            onClick={() => { setResetSent(false); setMode('login') }}
            style={styles.switchBtn}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Left panel — editorial */}
      <div style={styles.leftPanel}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoAccent}>AI</span> Brand Monitor
        </Link>

        <div style={styles.leftContent}>
          <p style={styles.eyebrow}>AI Visibility Intelligence</p>
          <h1 style={styles.leftHeadline}>
            Know exactly how AI<br />
            <em>sees</em> your business.
          </h1>
          <p style={styles.leftSub}>
            Track your presence across ChatGPT, Claude, Perplexity,
            and Gemini — and get actionable data to improve it.
          </p>

          <div style={styles.statRow}>
            {[
              { value: '4', label: 'AI Platforms' },
              { value: '100', label: 'Max Score' },
              { value: '24h', label: 'Scan Frequency' },
            ].map(s => (
              <div key={s.label} style={styles.stat}>
                <span style={styles.statValue}>{s.value}</span>
                <span style={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative grid lines */}
        <div style={styles.gridLines} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...styles.gridLine, top: `${i * 18}%` }} />
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          {/* Mode toggle — hidden for reset/new-password flows */}
          {(mode === 'login' || mode === 'signup') && (
            <div style={styles.modeToggle}>
              {(['signup', 'login'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError('') }}
                  style={{
                    ...styles.modeBtn,
                    ...(mode === m ? styles.modeBtnActive : {}),
                  }}
                >
                  {m === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              ))}
            </div>
          )}

          {/* Reset mode heading */}
          {mode === 'reset' && (
            <div style={styles.resetHeader}>
              <h2 style={styles.resetTitle}>Reset your password</h2>
              <p style={styles.resetSub}>Enter your email and we'll send you a reset link.</p>
            </div>
          )}

          {/* New-password mode heading */}
          {mode === 'new-password' && (
            <div style={styles.resetHeader}>
              <h2 style={styles.resetTitle}>Set a new password</h2>
              <p style={styles.resetSub}>Choose a strong password for your account.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'signup' && (
              <div style={styles.field}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={styles.input}
                  autoComplete="name"
                />
              </div>
            )}

            {mode !== 'new-password' && (
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={styles.input}
                  autoComplete="email"
                />
              </div>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 8 : 1}
                  style={styles.input}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError('') }}
                    style={styles.forgotLink}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {mode === 'new-password' && (
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  style={styles.input}
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div style={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.submitBtn, ...(loading ? styles.submitBtnDisabled : {}) }}
            >
              {loading ? (
                <span style={styles.loadingRow}>
                  <span style={styles.spinner} />
                  {mode === 'signup' ? 'Creating account...' : mode === 'reset' ? 'Sending link...' : mode === 'new-password' ? 'Saving...' : 'Signing in...'}
                </span>
              ) : (
                mode === 'signup' ? 'Create account & continue'
                : mode === 'reset' ? 'Send reset link'
                : mode === 'new-password' ? 'Set new password'
                : 'Sign in to dashboard'
              )}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                style={styles.backLink}
              >
                ← Back to sign in
              </button>
            )}
          </form>

          {(mode === 'login' || mode === 'signup') && (
            <p style={styles.termsText}>
              By creating an account you agree to our{' '}
              <a href="#" style={styles.termsLink}>Terms</a> and{' '}
              <a href="#" style={styles.termsLink}>Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: 'var(--bg)',
    fontFamily: "'Outfit', sans-serif",
  },
  leftPanel: {
    flex: '1 1 55%',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '3rem',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  logo: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.4rem',
    color: 'var(--text)',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 'auto',
  },
  logoAccent: {
    color: 'var(--accent)',
  },
  leftContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingBottom: '4rem',
    position: 'relative',
    zIndex: 1,
  },
  eyebrow: {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginBottom: '1.25rem',
  },
  leftHeadline: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
    lineHeight: 1.1,
    color: 'var(--text)',
    marginBottom: '1.25rem',
    fontWeight: 400,
  },
  leftSub: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    maxWidth: '400px',
    marginBottom: '3rem',
  },
  statRow: {
    display: 'flex',
    gap: '2.5rem',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  statValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  gridLines: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '1px',
    background: 'var(--border-dim)',
    opacity: 0.6,
  },
  rightPanel: {
    flex: '1 1 45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
  },
  formCard: {
    width: '100%',
    maxWidth: '400px',
  },
  modeToggle: {
    display: 'flex',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '3px',
    marginBottom: '2rem',
  },
  modeBtn: {
    flex: 1,
    padding: '0.55rem 1rem',
    border: 'none',
    borderRadius: '7px',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modeBtnActive: {
    background: 'var(--surface-2)',
    color: 'var(--text)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  resetHeader: {
    marginBottom: '2rem',
  },
  resetTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.75rem',
    fontWeight: 400,
    color: 'var(--text)',
    marginBottom: '0.4rem',
  },
  resetSub: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.7rem 1rem',
    color: 'var(--text)',
    fontSize: '0.95rem',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  forgotLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    padding: '0',
    textAlign: 'right',
    alignSelf: 'flex-end',
    transition: 'color 0.2s',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    padding: '0',
    textAlign: 'center',
    transition: 'color 0.2s',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius)',
    padding: '0.6rem 0.9rem',
    color: 'var(--red)',
    fontSize: '0.85rem',
  },
  submitBtn: {
    background: 'var(--accent)',
    color: '#07090d',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '0.8rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'opacity 0.2s',
    letterSpacing: '0.02em',
  },
  submitBtnDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(7,9,13,0.3)',
    borderTopColor: '#07090d',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  termsText: {
    marginTop: '1.25rem',
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  termsLink: {
    color: 'var(--text-muted)',
    textDecoration: 'underline',
  },
  // Check email / reset-sent state
  checkEmailBox: {
    maxWidth: '420px',
    margin: '15vh auto 0',
    textAlign: 'center',
    padding: '2rem',
  },
  checkIcon: {
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
  checkTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '2rem',
    color: 'var(--text)',
    marginBottom: '0.75rem',
    fontWeight: 400,
  },
  checkText: {
    color: 'var(--text-muted)',
    lineHeight: 1.7,
    marginBottom: '2rem',
  },
  switchBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    padding: '0.6rem 1.25rem',
    fontSize: '0.875rem',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
  },
}
