/**
 * Nav — Fixed top navigation.
 * Auth-aware: signed-in users see Dashboard in nav links and a name pill
 * (linking to /account) next to the "Go to Dashboard" button.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'

// Prefer the name the user typed at signup; fall back to OAuth-provided name;
// finally fall back to the local-part of their email. Never blank.
function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, any> | null } | null): string {
  if (!user) return 'Account'
  const meta = user.user_metadata ?? {}
  const fromMeta = (typeof meta.full_name === 'string' && meta.full_name.trim())
    || (typeof meta.name === 'string' && meta.name.trim())
  if (fromMeta) return fromMeta
  const email = user.email ?? ''
  const local = email.split('@')[0]
  return local || 'Account'
}

export function Nav({ authPage = false }: { authPage?: boolean }) {
  const navigate = useNavigate()
  const { session, user, loading } = useAuth()
  const isSignedIn = !loading && !!session
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav>
      <div className="container nav-inner">
        <Link to="/" className="logo">
          <img src="/logo-eye.png" alt="Visaion" className="logo-mark-img" />
          <span className="logo-text">
            Vis<span className="logo-ai">ai</span>on
          </span>
        </Link>

        {authPage ? (
          <Link
            to="/"
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              fontFamily: "'Outfit', sans-serif",
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            &#8592; Back to home
          </Link>
        ) : (
          <>
            <ul className="nav-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              {isSignedIn ? (
                <li><Link to="/dashboard">Visibility Dashboard</Link></li>
              ) : (
                <>
                  <li><Link to="/analyze">Generate scan</Link></li>
                  <li><Link to="/auth">Sign in</Link></li>
                </>
              )}
            </ul>

            {isSignedIn ? (
              <button
                className="btn-nav"
                onClick={() => navigate('/account')}
                aria-label="Account"
              >
                {getDisplayName(user)}
              </button>
            ) : (
              <button
                className="btn-nav"
                onClick={() => navigate('/analyze')}
              >
                Check Your Visibility
              </button>
            )}

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
          </>
        )}
      </div>

      {/* Mobile dropdown menu — hidden on desktop, shown ≤900px (see globals.css) */}
      {!authPage && (
        <div className={`nav-mobile-menu${menuOpen ? ' open' : ''}`}>
          <Link to="/" onClick={closeMenu}>Home</Link>
          <Link to="/pricing" onClick={closeMenu}>Pricing</Link>
          {isSignedIn ? (
            <>
              <Link to="/dashboard" onClick={closeMenu}>Visibility Dashboard</Link>
              <Link to="/account" onClick={closeMenu}>Account</Link>
            </>
          ) : (
            <Link to="/analyze" onClick={closeMenu}>Generate scan</Link>
          )}
          <button
            className="nav-mobile-cta"
            onClick={() => { closeMenu(); navigate(isSignedIn ? '/dashboard' : '/analyze') }}
          >
            {isSignedIn ? 'Go to Dashboard' : 'Check Your Visibility'}
          </button>
          {!isSignedIn && (
            <Link to="/auth" className="nav-mobile-signin" onClick={closeMenu}>Sign in</Link>
          )}
        </div>
      )}
    </nav>
  )
}
