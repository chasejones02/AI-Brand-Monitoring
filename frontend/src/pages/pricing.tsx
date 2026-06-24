import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { supabase } from '../lib/supabase'
import { createCheckoutSession } from '../lib/api'
import { Nav } from '../components/nav'
import { CrystalCursor } from '../components/crystal-cursor'
import { TiltCard } from '../components/ui/tilt-card'
import { UpgradeClaimModal } from '../components/upgrade-claim'

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
  // Anonymous users must attach an email + password before paying. claimTier
  // holds the tier they picked while the conversion modal is open.
  const [claimTier, setClaimTier] = useState<'starter' | 'growth' | null>(null)
  const [claimError, setClaimError] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)

  const returnState = (location.state ?? null) as PricingReturnState | null
  const returnTo = returnState?.returnTo
  const returnLabel = returnState?.returnLabel ?? 'where you were'
  const returnSetId = returnState?.returnSetId

  const prices = { starter: billing === 'annual' ? 24 : 29, growth: billing === 'annual' ? 41 : 49 }

  async function runCheckout(tier: 'starter' | 'growth') {
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

  function handleCheckout(tier: 'starter' | 'growth') {
    if (!session) {
      window.location.href = '/auth'
      return
    }
    // Anonymous (free-scan) users have a session but no email/password — collect
    // them and convert the account in place before sending them to Stripe.
    if (session.user?.is_anonymous) {
      setClaimError('')
      setClaimTier(tier)
      return
    }
    runCheckout(tier)
  }

  async function handleClaimConfirm(email: string, password: string) {
    const tier = claimTier
    if (!tier) return
    setClaimLoading(true)
    setClaimError('')
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ email, password })
      if (updateErr) throw updateErr
      setClaimTier(null)
      setClaimLoading(false)
      await runCheckout(tier)
    } catch (err: any) {
      setClaimError(err.message ?? 'Could not save your account. Please try again.')
      setClaimLoading(false)
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
        <h1 className="pp-title">Every day you're invisible to AI, a competitor closes the deal.</h1>
        <p className="pp-title-sub">Starting at ${prices.starter}/mo</p>
        <p className="pp-subtitle">Your competitors are already being recommended by ChatGPT, Claude, Gemini, and Perplexity. The question is by how much.</p>
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
          <p className="pp-desc">For solo businesses that can't afford to keep guessing what AI tells buyers.</p>
          <ul className="pp-features">
            <li>{check} Stop flying blind on all 4 platforms: ChatGPT, Claude, Gemini & Perplexity</li>
            <li>{check} Catch a ranking drop the same day — not after a quarter of lost leads</li>
            <li>{check} 2 query sets — auto-generated + 1 you control</li>
            <li>{check} See exactly which 3 competitors are stealing your AI placements</li>
            <li>{check} Plain-English visibility score — no point totals to decode</li>
            <li>{check} 3 prioritized fixes per scan so you're not guessing what to change</li>
            <li>{check} 1 business profile</li>
          </ul>
          <button
            className="pp-btn"
            onClick={() => handleCheckout('starter')}
            disabled={loading !== null}
          >
            {loading === 'starter' ? 'Redirecting…' : 'Stop losing AI-driven deals'}
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
          <p className="pp-desc">For businesses that refuse to lose deals they never knew were on the table.</p>
          <ul className="pp-features">
            <li>{check} Everything in Starter</li>
            <li>{check} 40 scans a month — spot drops before they cost you a month of revenue</li>
            <li>{check} 3 business profiles — every brand you own, none left exposed</li>
            <li>{check} 3 query sets per business (auto + 2 custom)</li>
            <li>{check} Full trend history — prove what's working before competitors copy it</li>
            <li>{check} 7 recommendations ranked by impact — fix the costliest gap first</li>
          </ul>
          <button
            className="pp-btn pp-btn-featured"
            onClick={() => handleCheckout('growth')}
            disabled={loading !== null}
          >
            {loading === 'growth' ? 'Redirecting…' : 'Stop losing AI-driven deals'}
          </button>
        </TiltCard>
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

      {claimTier && (
        <UpgradeClaimModal
          subtitle={<>Create a login to upgrade to <strong style={{ color: 'var(--text)' }}>{claimTier === 'growth' ? 'Growth' : 'Starter'}</strong>. Your business and free scan stay exactly where they are.</>}
          onClose={() => { if (!claimLoading) setClaimTier(null) }}
          onConfirm={handleClaimConfirm}
          error={claimError}
          loading={claimLoading}
        />
      )}
    </div>
  )
}
