/**
 * Pricing — 3-column pricing cards (Starter, Growth, Agency).
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createCheckoutSession } from '../lib/api'
import { useAuth } from '../contexts/auth-context'
import { GlowCard } from './ui/spotlight-card'

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function Pricing() {
  const { session } = useAuth()
  const navigate = useNavigate()
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
        <h2>Know what AI says about you — starting at $29/mo</h2>
        <p className="section-sub">Solo owner? Start with Starter. Managing clients? Jump to Agency.</p>

        {canceled && (
          <div className="pricing-canceled-banner">
            <span>No worries — your checkout was canceled. You can upgrade anytime.</span>
            <button onClick={dismissCanceled} className="pricing-canceled-dismiss" aria-label="Dismiss">✕</button>
          </div>
        )}

        {error && (
          <div className="pricing-error-banner">{error}</div>
        )}

        <div className="pricing-free-strip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Your first scan is free — no credit card, no commitment.</span>
          <button className="pricing-free-strip-btn" onClick={() => navigate('/analyze')}>
            Get your free scan
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="pricing-grid">
          {/* Starter */}
          <GlowCard customSize radius={20} className="pricing-card !block">
            <div className="pricing-tier">Starter</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">29</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For solo businesses ready to own their AI presence.</p>
            <ul className="pricing-features">
              <li>{check} 5 queries tracked</li>
              <li>{check} 1 on-demand scan per day</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Track 3 competitors</li>
              <li>{check} 1 business profile</li>
            </ul>
            <button
              className="btn-pricing"
              onClick={() => handleCheckout('starter')}
              disabled={loading !== null}
            >
              {loading === 'starter' ? 'Redirecting…' : 'Start 7-day free trial'}
            </button>
          </GlowCard>

          {/* Growth */}
          <GlowCard customSize radius={20} className="pricing-card featured !block">
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
              <li>{check} 5 on-demand scans per day</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Track 5 competitors</li>
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
          </GlowCard>

          {/* Agency */}
          <GlowCard customSize radius={20} className="pricing-card !block">
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
          </GlowCard>
        </div>

        <div className="pricing-bottom-nudge">
          <span className="pricing-bottom-text">Not ready to commit?</span>
          <button className="pricing-bottom-btn" onClick={() => navigate('/analyze')}>
            Get a free AI visibility scan first — see your score before you pay.
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
