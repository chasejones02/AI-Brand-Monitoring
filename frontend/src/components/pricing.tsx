import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createCheckoutSession, createPortalSession, getSubscription } from '../lib/api'
import { useAuth } from '../contexts/auth-context'
import { supabase } from '../lib/supabase'
import { GlowCard } from './ui/spotlight-card'
import { UpgradeClaimModal } from './upgrade-claim'

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

type BillingPeriod = 'monthly' | 'annual'
type PaidTier = 'starter' | 'growth'

// Used to decide whether a switch is an upgrade or a downgrade.
const TIER_RANK: Record<'free' | PaidTier, number> = { free: 0, starter: 1, growth: 2 }

export function Pricing() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canceled = searchParams.get('canceled') === 'true'
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [billing, setBilling] = useState<BillingPeriod>('annual')
  // Anonymous users must attach an email + password before paying.
  const [claimTier, setClaimTier] = useState<'starter' | 'growth' | null>(null)
  const [claimError, setClaimError] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  // Current subscription, so we can flag the active plan and route plan changes
  // through the billing portal instead of opening a duplicate subscription.
  const [sub, setSub] = useState<{ status: string; tier: 'free' | PaidTier } | null>(null)

  useEffect(() => {
    // Anonymous and logged-out visitors have no subscription to reconcile.
    if (!session || session.user?.is_anonymous) return
    let cancelled = false
    getSubscription()
      .then(s => { if (!cancelled) setSub(s) })
      // Non-fatal: if this fails we just fall back to the default buy buttons.
      .catch(() => {})
    return () => { cancelled = true }
  }, [session])

  const prices = { starter: billing === 'annual' ? 24 : 29, growth: billing === 'annual' ? 41 : 49 }

  async function runCheckout(tier: 'starter' | 'growth') {
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

  function handleCheckout(tier: 'starter' | 'growth') {
    if (!session) {
      document.getElementById('get-report')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    // Anonymous (free-scan) users have a session but no login — collect an
    // email/password and convert the account in place before Stripe.
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

  // A live (active or past-due) subscription. Such a user must never be sent
  // back through Checkout — that opens a second parallel subscription and
  // double-bills them. Plan changes go through the Stripe billing portal, which
  // swaps the plan in place with proration.
  const liveSub =
    sub && (sub.status === 'active' || sub.status === 'past_due')
      ? (sub as { status: string; tier: PaidTier })
      : null

  async function openPortal(tier: PaidTier) {
    setLoading(tier)
    setError('')
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (err: any) {
      setError(err.message ?? 'Could not open the billing portal. Please try again.')
      setLoading(null)
    }
  }

  // Renders the CTA for a plan card: "current plan" (disabled) for the active
  // tier, an upgrade/downgrade button (→ portal) for subscribers on the other
  // tier, or the normal checkout button for everyone else.
  function planButton(tier: PaidTier, className: string) {
    if (liveSub && liveSub.tier === tier) {
      return (
        <button className={`${className} btn-pricing-current`} disabled aria-disabled="true">
          {check} Your current plan
        </button>
      )
    }
    if (liveSub) {
      const isUpgrade = TIER_RANK[tier] > TIER_RANK[liveSub.tier]
      const tierLabel = tier === 'growth' ? 'Growth' : 'Starter'
      return (
        <button className={className} onClick={() => openPortal(tier)} disabled={loading !== null}>
          {loading === tier ? 'Opening…' : `${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${tierLabel}`}
        </button>
      )
    }
    return (
      <button className={className} onClick={() => handleCheckout(tier)} disabled={loading !== null}>
        {loading === tier ? 'Redirecting…' : 'Stop losing AI-driven deals'}
      </button>
    )
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
            {planButton('starter', 'btn-pricing')}
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
              <li>{check} 40 scans a month — spot drops before they cost you a month of revenue</li>
              <li>{check} 3 business profiles — every brand you own, none left exposed</li>
              <li>{check} 3 query sets per business (auto + 2 custom)</li>
              <li>{check} Full trend history — prove what's working before competitors copy it</li>
              <li>{check} 7 recommendations ranked by impact — fix the costliest gap first</li>
            </ul>
            {planButton('growth', 'btn-pricing featured-btn')}
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

      {claimTier && (
        <UpgradeClaimModal
          subtitle={<>Create a login to upgrade to <strong style={{ color: 'var(--text)' }}>{claimTier === 'growth' ? 'Growth' : 'Starter'}</strong>. Your business and free scan stay exactly where they are.</>}
          onClose={() => { if (!claimLoading) setClaimTier(null) }}
          onConfirm={handleClaimConfirm}
          error={claimError}
          loading={claimLoading}
        />
      )}
    </section>
  )
}
