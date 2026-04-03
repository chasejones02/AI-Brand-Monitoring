import { Link } from 'react-router-dom'
import { Pricing } from '../components/pricing'
import { useAuth } from '../contexts/auth-context'

export default function PricingPage() {
  const { session } = useAuth()

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <Link to="/" style={s.navLogo}>
          <span style={{ color: 'var(--accent)' }}>AI</span> Brand Monitor
        </Link>
        <Link to={session ? '/dashboard' : '/'} style={s.backLink}>
          {session ? '← Back to dashboard' : '← Back'}
        </Link>
      </nav>

      <Pricing />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: "'Outfit', sans-serif",
    color: 'var(--text)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.1rem 2rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  navLogo: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.25rem',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  backLink: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
  },
}
