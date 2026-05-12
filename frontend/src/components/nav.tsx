/**
 * Nav — Fixed top navigation.
 * Auth-aware: signed-in users see Dashboard + Account instead of Sign in.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'

export function Nav({ authPage = false }: { authPage?: boolean }) {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
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
                <>
                  <li><Link to="/dashboard">Dashboard</Link></li>
                  <li><Link to="/account">Account</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/analyze">Generate scan</Link></li>
                  <li><Link to="/auth">Sign in</Link></li>
                </>
              )}
            </ul>

            <button
              className="btn-nav"
              onClick={() => navigate(isSignedIn ? '/dashboard' : '/analyze')}
            >
              {isSignedIn ? 'Go to Dashboard' : 'Check Your Visibility'}
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
