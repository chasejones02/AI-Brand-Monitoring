/**
 * Nav — Fixed top navigation.
 * Auth-aware: signed-in users see Dashboard in nav links and a name pill
 * (linking to /account) next to the "Go to Dashboard" button.
 */

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
          </>
        )}
      </div>
    </nav>
  )
}
