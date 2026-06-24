/**
 * UpgradeClaimModal — collects an email + password from an anonymous
 * (free-scan) user so the in-place account conversion (supabase.auth.updateUser)
 * gives them a real, recoverable login. Their business + free scan carry over
 * (same user_id). Used in two places:
 *   - at upgrade, right before Stripe checkout
 *   - on the dashboard, as a "save your results" prompt (no checkout)
 *
 * Presentational only: the parent's onConfirm performs the conversion (and, for
 * the upgrade path, the checkout). Matches the glassmorphism language of
 * components/ui/login-form.tsx.
 */

import { useState, type ReactNode } from 'react'
import { Mail, Lock, ArrowRight, X, Check } from 'lucide-react'

interface UpgradeClaimModalProps {
  onClose: () => void
  onConfirm: (email: string, password: string) => void
  error?: string
  loading?: boolean
  /** Optional copy overrides. Defaults target the upgrade-to-checkout flow. */
  title?: string
  subtitle?: ReactNode
  submitLabel?: string
  loadingLabel?: string
}

const fieldWrap: React.CSSProperties = { position: 'relative', marginBottom: '1.4rem' }

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${focused ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
    color: 'var(--text)',
    fontSize: '0.95rem',
    fontFamily: "'Outfit', sans-serif",
    padding: '12px 0 8px 22px',
    outline: 'none',
    transition: 'border-color 0.25s',
  }
}

export function UpgradeClaimModal({
  onClose,
  onConfirm,
  error,
  loading,
  title = 'Save your account',
  subtitle,
  submitLabel = 'Continue to checkout',
  loadingLabel = 'Redirecting…',
}: UpgradeClaimModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailFocus, setEmailFocus] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [localError, setLocalError] = useState('')

  const shownError = localError || error

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }
    onConfirm(email.trim(), password)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(7,9,13,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem 2.25rem',
          background:
            'linear-gradient(155deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 45%, rgba(13,17,23,0.65) 100%)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          borderRadius: '22px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow:
            '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.18) inset',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h2
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: "'Outfit', sans-serif",
              marginBottom: '0.35rem',
            }}
          >
            {title}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {subtitle ?? 'Create a login so your business and free scan are saved to your account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={fieldWrap}>
            <Mail
              size={15}
              style={{ position: 'absolute', left: 0, top: '14px', color: emailFocus ? 'var(--accent)' : 'var(--text-muted)' }}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              autoFocus
              onChange={e => { setEmail(e.target.value); setLocalError('') }}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              style={inputStyle(emailFocus)}
            />
          </div>

          <div style={fieldWrap}>
            <Lock
              size={15}
              style={{ position: 'absolute', left: 0, top: '14px', color: pwFocus ? 'var(--accent)' : 'var(--text-muted)' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setLocalError('') }}
              onFocus={() => setPwFocus(true)}
              onBlur={() => setPwFocus(false)}
              minLength={8}
              style={inputStyle(pwFocus)}
            />
          </div>

          <div style={{ marginTop: '-0.6rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} style={{ color: password.length >= 8 ? 'var(--green)' : 'var(--text-dim)', transition: 'color 0.2s' }} />
            <span style={{ fontSize: '0.75rem', color: password.length >= 8 ? 'var(--green)' : 'var(--text-dim)', transition: 'color 0.2s' }}>
              At least 8 characters
            </span>
          </div>

          {shownError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '0.6rem 0.9rem',
                color: 'var(--red)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              {shownError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0.85rem 1.5rem',
              background: 'var(--accent)',
              color: '#07090d',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.95rem',
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.25s',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(7,9,13,0.3)',
                    borderTopColor: '#07090d',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
                {loadingLabel}
              </>
            ) : (
              <>
                {submitLabel}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
