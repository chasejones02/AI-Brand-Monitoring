/**
 * PricingPage — Premium pricing with golden-bordered cards
 * and animated shader background.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { createCheckoutSession } from '../lib/api'
import { Nav } from '../components/nav'
import { CrystalCursor } from '../components/crystal-cursor'
import { TiltCard } from '../components/ui/tilt-card'

const check = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function PricingPage() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCheckout(tier: 'starter' | 'growth' | 'agency') {
    if (!session) {
      window.location.href = '/auth'
      return
    }
    setLoading(tier)
    setError('')
    try {
      const { url } = await createCheckoutSession(tier)
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
    <div className="pp-page">
      {/* Grid + crystal cursor background (matches landing page bottom) */}
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />

      <Nav />

      {/* Header */}
      <header className="pp-header">
        <h1 className="pp-title">Premium Pricing Plans</h1>
        <p className="pp-subtitle">Choose the plan that elevates your brand visibility.</p>
      </header>

      {canceled && (
        <div className="pp-banner">
          <span>No worries — your checkout was canceled. You can upgrade anytime.</span>
          <button onClick={dismissCanceled} aria-label="Dismiss">✕</button>
        </div>
      )}
      {error && <div className="pp-banner pp-banner-error">{error}</div>}

      {/* Cards */}
      <div className="pp-grid">
        {/* Starter */}
        <TiltCard className="pp-card">
          <div className="pp-tier">Starter</div>
          <div className="pp-price">
            <span className="pp-dollar">$</span>
            <span className="pp-amount">29</span>
            <span className="pp-period">/mo</span>
          </div>
          <p className="pp-desc">For solo businesses.</p>
          <ul className="pp-features">
            <li>{check} 5 queries tracked</li>
            <li>{check} Weekly scans</li>
            <li>{check} All 4 AI platforms</li>
          </ul>
          <button
            className="pp-btn"
            onClick={() => handleCheckout('starter')}
            disabled={loading !== null}
          >
            {loading === 'starter' ? 'Redirecting…' : 'Start 7-day free trial'}
          </button>
        </TiltCard>

        {/* Growth */}
        <TiltCard className="pp-card pp-card-featured">
          <div className="pp-badge">MOST POPULAR</div>
          <div className="pp-tier">Growth</div>
          <div className="pp-price">
            <span className="pp-dollar">$</span>
            <span className="pp-amount">49</span>
            <span className="pp-period">/mo</span>
          </div>
          <p className="pp-desc">For growing businesses.</p>
          <ul className="pp-features">
            <li>{check} 15 queries tracked</li>
            <li>{check} Daily scans</li>
            <li>{check} All 4 AI platforms</li>
            <li>{check} Competitor radar</li>
            <li>{check} Historical trend graphs</li>
            <li>{check} Email digest reports</li>
          </ul>
          <button
            className="pp-btn pp-btn-featured"
            onClick={() => handleCheckout('growth')}
            disabled={loading !== null}
          >
            {loading === 'growth' ? 'Redirecting…' : 'Start 7-day free trial'}
          </button>
        </TiltCard>

        {/* Agency */}
        <TiltCard className="pp-card">
          <div className="pp-tier">Agency</div>
          <div className="pp-price">
            <span className="pp-dollar">$</span>
            <span className="pp-amount">149</span>
            <span className="pp-period">/mo</span>
          </div>
          <p className="pp-desc">For marketing agencies.</p>
          <ul className="pp-features">
            <li>{check} 30 queries tracked</li>
            <li>{check} Multi-brand (20 profiles)</li>
            <li>{check} Actionable recommendations</li>
            <li>{check} White-label reports</li>
            <li>{check} API access</li>
            <li>{check} Priority support</li>
          </ul>
          <button
            className="pp-btn"
            onClick={() => handleCheckout('agency')}
            disabled={loading !== null}
          >
            {loading === 'agency' ? 'Redirecting…' : 'Contact sales'}
          </button>
        </TiltCard>
      </div>

      {/* Footer link */}
      <div className="pp-footer">
        <a href="mailto:hello@visaion.com" className="pp-contact">Contact sales</a>
      </div>
    </div>
  )
}
