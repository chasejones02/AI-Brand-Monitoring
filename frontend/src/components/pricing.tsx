/**
 * Pricing — 3-column pricing cards (Starter, Growth, Agency).
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createCheckoutSession } from '../lib/api'
import { useAuth } from '../contexts/auth-context'

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function Pricing() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCheckout(tier: 'starter' | 'growth' | 'agency') {
    if (!session) {
      // Scroll to signup form if not logged in
      document.getElementById('get-report')?.scrollIntoView({ behavior: 'smooth' })
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
    <section className="pricing-section" id="pricing">
      <div className="container">
        <div className="section-label">Pricing</div>
        <h2>Start free.<br />Scale when you're ready.</h2>
        <p className="section-sub">Start with a free report. Upgrade for recurring scans, trend tracking, and multi-brand coverage.</p>

        {canceled && (
          <div className="pricing-canceled-banner">
            <span>No worries — your checkout was canceled. You can upgrade anytime.</span>
            <button onClick={dismissCanceled} className="pricing-canceled-dismiss" aria-label="Dismiss">✕</button>
          </div>
        )}

        {error && (
          <div className="pricing-error-banner">{error}</div>
        )}

        <div className="pricing-grid">
          {/* Starter */}
          <div className="pricing-card">
            <div className="pricing-tier">Starter</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">29</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For solo businesses ready to own their AI presence.</p>
            <ul className="pricing-features">
              <li>{check} 5 queries tracked</li>
              <li>{check} Weekly scans</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Competitor radar</li>
              <li>{check} 1 business profile</li>
            </ul>
            <button
              className="btn-pricing"
              onClick={() => handleCheckout('starter')}
              disabled={loading !== null}
            >
              {loading === 'starter' ? 'Redirecting…' : 'Start 7-day free trial'}
            </button>
          </div>

          {/* Growth */}
          <div className="pricing-card featured">
            <div className="pricing-tag">Most popular</div>
            <div className="pricing-tier">Growth</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">49</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For growing businesses that need daily visibility and deeper insight.</p>
            <ul className="pricing-features">
              <li>{check} 15 queries tracked</li>
              <li>{check} Daily scans</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Competitor radar</li>
              <li>{check} Historical trend graphs</li>
              <li>{check} Email digest reports</li>
            </ul>
            <button
              className="btn-pricing featured-btn"
              onClick={() => handleCheckout('growth')}
              disabled={loading !== null}
            >
              {loading === 'growth' ? 'Redirecting…' : 'Start 7-day free trial'}
            </button>
          </div>

          {/* Agency */}
          <div className="pricing-card">
            <div className="pricing-tier">Agency</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">149</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For marketing agencies managing multiple brands and clients.</p>
            <ul className="pricing-features">
              <li>{check} 30 queries tracked</li>
              <li>{check} Multi-brand (up to 20 profiles)</li>
              <li>{check} Actionable recommendations engine</li>
              <li>{check} White-label PDF reports</li>
              <li>{check} API access</li>
              <li>{check} Priority support</li>
            </ul>
            <button
              className="btn-pricing"
              onClick={() => handleCheckout('agency')}
              disabled={loading !== null}
            >
              {loading === 'agency' ? 'Redirecting…' : 'Contact sales'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
