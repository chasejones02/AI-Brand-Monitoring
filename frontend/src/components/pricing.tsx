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

export function Pricing() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [billing, setBilling] = useState<BillingPeriod>('annual')

  const prices = { starter: billing === 'annual' ? 24 : 29, growth: billing === 'annual' ? 41 : 49 }

  async function handleCheckout(tier: 'starter' | 'growth') {
    if (!session) {
      document.getElementById('get-report')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const checkoutTier = billing === 'annual' ? (`${tier}_annual` as const) : tier
    setLoading(tier)
    setError('')
    try {
      const { url } = await createCheckoutSession(checkoutTier)
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
        <h2>Every day you're invisible to AI, a competitor closes the deal.</h2>
        <p className="section-sub">Your competitors are already being recommended by ChatGPT, Claude, Gemini, and Perplexity. The question is by how much.</p>

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

        {/* Billing toggle */}
        <div className="pricing-billing-wrap">
          <div className="pricing-billing-toggle">
            <button
              className={`pricing-billing-btn${billing === 'monthly' ? ' active' : ''}`}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              className={`pricing-billing-btn${billing === 'annual' ? ' active' : ''}`}
              onClick={() => setBilling('annual')}
            >
              Annual
            </button>
          </div>
          {billing === 'annual' && (
            <span className="pricing-savings-badge">Save up to 17%</span>
          )}
        </div>

        <div className="pricing-grid">
          {/* Starter */}
          <GlowCard customSize radius={20} className="pricing-card !block">
            <div className="pricing-tier">Starter</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">{prices.starter}</span>
              <span className="pricing-period">/mo</span>
            </div>
            {billing === 'annual' && (
              <p className="pricing-annual-note">Billed annually — ${prices.starter * 12}/yr</p>
            )}
            <p className="pricing-desc">For solo businesses that can't afford to keep guessing what AI tells buyers.</p>
            <ul className="pricing-features">
              <li>{check} Stop flying blind on all 4 platforms: ChatGPT, Claude, Gemini & Perplexity</li>
              <li>{check} Catch a ranking drop the same day — not after a quarter of lost leads</li>
              <li>{check} 2 query sets — auto-generated + 1 you control</li>
              <li>{check} See exactly which 3 competitors are stealing your AI placements</li>
              <li>{check} Plain-English visibility score — no point totals to decode</li>
              <li>{check} 3 prioritized fixes per scan so you're not guessing what to change</li>
              <li>{check} 1 business profile</li>
            </ul>
            <button
              className="btn-pricing"
              onClick={() => handleCheckout('starter')}
              disabled={loading !== null}
            >
              {loading === 'starter' ? 'Redirecting…' : 'Stop losing AI-driven deals'}
            </button>
          </GlowCard>

          {/* Growth */}
          <GlowCard customSize radius={20} className="pricing-card featured !block">
            <div className="pricing-tag">Most popular</div>
            <div className="pricing-tier">Growth</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">{prices.growth}</span>
              <span className="pricing-period">/mo</span>
            </div>
            {billing === 'annual' && (
              <p className="pricing-annual-note">Billed annually — ${prices.growth * 12}/yr</p>
            )}
            <p className="pricing-desc">For businesses that refuse to lose deals they never knew were on the table.</p>
            <ul className="pricing-features">
              <li>{check} Everything in Starter</li>
              <li>{check} 5 scans per day — spot drops before they cost you a month of revenue</li>
              <li>{check} 3 business profiles — every brand you own, none left exposed</li>
              <li>{check} 3 query sets per business (auto + 2 custom)</li>
              <li>{check} Full trend history — prove what's working before competitors copy it</li>
              <li>{check} 7 recommendations ranked by impact — fix the costliest gap first</li>
            </ul>
            <button
              className="btn-pricing featured-btn"
              onClick={() => handleCheckout('growth')}
              disabled={loading !== null}
            >
              {loading === 'growth' ? 'Redirecting…' : 'Stop losing AI-driven deals'}
            </button>
          </GlowCard>
        </div>

        {/* Testimonials */}
        <div className="pricing-testimonials">
          {testimonials.map((t) => (
            <div key={t.author} className="pricing-testimonial">
              <p className="pricing-testimonial-quote">"{t.quote}"</p>
              <p className="pricing-testimonial-author">{t.author}</p>
              <p className="pricing-testimonial-role">{t.role}</p>
            </div>
          ))}
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
