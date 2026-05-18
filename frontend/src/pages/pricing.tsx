import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { createCheckoutSession } from '../lib/api'
import { Nav } from '../components/nav'
import { CrystalCursor } from '../components/crystal-cursor'
import { TiltCard } from '../components/ui/tilt-card'

interface PricingReturnState {
  returnTo?: string
  returnLabel?: string
  returnSetId?: string
}

const check = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const testimonials = [
  {
    quote: "I didn't realize AI was recommending my competitor to everyone searching for HVAC in my city. Within a week I knew exactly what was happening and where I stood.",
    author: 'Marcus T.',
    role: 'HVAC contractor, Dallas TX',
  },
  {
    quote: "We were paying for SEO but completely blind to AI. This showed us we had a 12% visibility score on ChatGPT. That number alone justified the subscription.",
    author: 'Priya K.',
    role: 'Marketing consultant',
  },
  {
    quote: "The trend graph showed our score jumped after we updated our About page copy. We finally have proof that content changes are actually working.",
    author: 'Jamie L.',
    role: 'E-commerce founder',
  },
]

type BillingPeriod = 'monthly' | 'annual'

export default function PricingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [billing, setBilling] = useState<BillingPeriod>('annual')

  const returnState = (location.state ?? null) as PricingReturnState | null
  const returnTo = returnState?.returnTo
  const returnLabel = returnState?.returnLabel ?? 'where you were'
  const returnSetId = returnState?.returnSetId

  const prices = { starter: billing === 'annual' ? 24 : 29, growth: billing === 'annual' ? 41 : 49 }

  async function handleCheckout(tier: 'starter' | 'growth') {
    if (!session) {
      window.location.href = '/auth'
      return
    }
    const checkoutTier = billing === 'annual' ? (`${tier}_annual` as const) : tier
    setLoading(tier)
    setError('')
    try {
      const { url } = await createCheckoutSession(checkoutTier, { returnSetId })
      window.location.href = url
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  function dismissCanceled() {
    searchParams.delete('canceled')
    setSearchParams(searchParams, { replace: true })
  }

  return (
    <div className={`pp-page${returnTo ? ' pp-page-with-return' : ''}`}>
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />

      <Nav />

      {returnTo && (
        <div className="pp-return-strip" role="region" aria-label="Return navigation">
          <Link to={returnTo} className="pp-return-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to {returnLabel}
          </Link>
          <span className="pp-return-hint">No commitment — keep browsing if you'd rather upgrade.</span>
        </div>
      )}

      <header className="pp-header">
        <h1 className="pp-title">Know what AI says about you.</h1>
        <p className="pp-title-sub">Starting at ${prices.starter}/mo</p>
        <p className="pp-subtitle">Your competitors are already checking. Pick the plan that fits.</p>
      </header>

      {canceled && (
        <div className="pp-banner">
          <span>No worries — your checkout was canceled. You can upgrade anytime.</span>
          <button onClick={dismissCanceled} aria-label="Dismiss">✕</button>
        </div>
      )}
      {error && <div className="pp-banner pp-banner-error">{error}</div>}

      {/* Free scan strip */}
      <div className="pp-free-strip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>Your first scan is free — no credit card, no commitment.</span>
        <button className="pp-free-strip-btn" onClick={() => navigate('/analyze')}>
          Get your free scan
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Billing toggle */}
      <div className="pp-billing-wrap">
        <div className="pp-billing-toggle">
          <button
            className={`pp-billing-btn${billing === 'monthly' ? ' active' : ''}`}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            className={`pp-billing-btn${billing === 'annual' ? ' active' : ''}`}
            onClick={() => setBilling('annual')}
          >
            Annual
          </button>
        </div>
        {billing === 'annual' && (
          <span className="pp-savings-badge">Save up to 17%</span>
        )}
      </div>

      {/* Cards */}
      <div className="pp-grid">
        {/* Starter */}
        <TiltCard className="pp-card">
          <div className="pp-tier">Starter</div>
          <div className="pp-price">
            <span className="pp-dollar">$</span>
            <span className="pp-amount">{prices.starter}</span>
            <span className="pp-period">/mo</span>
          </div>
          {billing === 'annual' && (
            <p className="pp-annual-note">Billed annually — ${prices.starter * 12}/yr</p>
          )}
          <p className="pp-desc">For solo businesses that can't afford to be invisible to AI.</p>
          <ul className="pp-features">
            <li>{check} All 4 platforms: ChatGPT, Claude, Gemini & Perplexity</li>
            <li>{check} 1 scan per day — catch ranking shifts same day</li>
            <li>{check} 2 query sets — auto-generated + 1 you control</li>
            <li>{check} 3 competitors tracked per scan</li>
            <li>{check} Plain-English visibility score breakdown</li>
            <li>{check} 3 prioritized recommendations per scan</li>
            <li>{check} 1 business profile</li>
          </ul>
          <button
            className="pp-btn"
            onClick={() => handleCheckout('starter')}
            disabled={loading !== null}
          >
            {loading === 'starter' ? 'Redirecting…' : 'Get started today'}
          </button>
        </TiltCard>

        {/* Growth */}
        <TiltCard className="pp-card pp-card-featured">
          <div className="pp-badge">MOST POPULAR</div>
          <div className="pp-tier">Growth</div>
          <div className="pp-price">
            <span className="pp-dollar">$</span>
            <span className="pp-amount">{prices.growth}</span>
            <span className="pp-period">/mo</span>
          </div>
          {billing === 'annual' && (
            <p className="pp-annual-note">Billed annually — ${prices.growth * 12}/yr</p>
          )}
          <p className="pp-desc">For growing businesses serious about owning their AI presence.</p>
          <ul className="pp-features">
            <li>{check} Everything in Starter</li>
            <li>{check} 5 scans per day — spot drops before they cost you</li>
            <li>{check} 3 business profiles — track each one independently</li>
            <li>{check} 3 query sets per business (auto + 2 custom)</li>
            <li>{check} Full trend history with per-platform & per-query charts</li>
            <li>{check} 7 recommendations ranked by impact per scan</li>
          </ul>
          <button
            className="pp-btn pp-btn-featured"
            onClick={() => handleCheckout('growth')}
            disabled={loading !== null}
          >
            {loading === 'growth' ? 'Redirecting…' : 'Get started today'}
          </button>
        </TiltCard>
      </div>

      {/* Testimonials */}
      <div className="pp-testimonials">
        {testimonials.map((t) => (
          <div key={t.author} className="pp-testimonial">
            <p className="pp-testimonial-quote">"{t.quote}"</p>
            <p className="pp-testimonial-author">{t.author}</p>
            <p className="pp-testimonial-role">{t.role}</p>
          </div>
        ))}
      </div>

      {/* Bottom nudge */}
      <div className="pp-bottom-nudge">
        <span className="pp-bottom-text">Not ready to commit?</span>
        <button className="pp-bottom-btn" onClick={() => navigate('/analyze')}>
          Get a free AI visibility scan first — see your score before you pay.
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
