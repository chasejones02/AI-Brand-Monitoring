/**
 * Nav — Fixed top navigation.
 * Logo + Pricing + How it works + Sign in. CTA routes to /analyze.
 */

import { Link, useNavigate } from 'react-router-dom'

export function Nav({ authPage = false }: { authPage?: boolean }) {
  const navigate = useNavigate()

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
              <li><Link to="/analyze">Generate scan</Link></li>
              <li><Link to="/auth">Sign in</Link></li>
            </ul>

            <button className="btn-nav" onClick={() => navigate('/analyze')}>
              Check Your Visibility
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
