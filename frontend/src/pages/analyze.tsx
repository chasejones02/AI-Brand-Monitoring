/**
 * AnalyzePage - Generate scan flow.
 * Steps -> Form.
 * Reached via "Check Your Visibility" CTAs and "Generate scan" nav link.
 *
 * Logged-in users who already have a business are normally redirected to
 * /dashboard — returning users should manage existing businesses there rather
 * than accidentally spin up another. The exception is the explicit "Add
 * business" flow (`?add=1`): a paid user under their tier's business limit can
 * create an additional profile here, and the existing HeroForm -> /preview ->
 * scan chain runs exactly like the original onboarding. A user already at
 * their limit sees a "maxed out" message instead of the form.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { getBusinesses } from '../lib/api'
import { Nav } from '../components/nav'
import { HeroForm } from '../components/hero-form'
import { Footer } from '../components/footer'
import { CrystalCursor } from '../components/crystal-cursor'
import { GlowCard } from '../components/ui/spotlight-card'
import { TiltCard } from '../components/ui/tilt-card'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export default function AnalyzePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const wantsAdd = searchParams.get('add') === '1'
  const { session, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [maxedOut, setMaxedOut] = useState<{ max: number } | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useScrollReveal()

  useEffect(() => {
    if (authLoading) return
    if (!session) {
      setChecking(false)
      return
    }
    let cancelled = false
    getBusinesses()
      .then(res => {
        if (cancelled) return
        const count = res?.businesses?.length ?? 0
        // No business yet → this is first-business onboarding; show the form.
        if (count === 0) {
          setChecking(false)
          return
        }
        // Has a business but didn't explicitly ask to add one → send them to
        // the dashboard to manage what they already have.
        if (!wantsAdd) {
          navigate('/dashboard', { replace: true })
          return
        }
        // Explicit "Add business" intent: allow another profile only if the
        // tier's limit hasn't been reached.
        if (count >= (res?.max_businesses ?? 1)) {
          setMaxedOut({ max: res?.max_businesses ?? 1 })
        }
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [authLoading, session, navigate, wantsAdd])

  if (authLoading || checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          border: '2px solid #1e2b3a',
          borderTopColor: '#c98f0a',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (maxedOut) {
    return (
      <>
        <div className="landing-clean-bg" aria-hidden />
        <CrystalCursor active />
        <Nav />
        <main>
          <section className="analyze-hero">
            <div className="container analyze-hero-inner" style={{ textAlign: 'center', maxWidth: 620 }}>
              <span className="analyze-kicker anim-1">Add business</span>
              <h1 className="analyze-title anim-2">
                You've reached your plan's <em>business limit</em>.
              </h1>
              <p className="analyze-sub anim-3">
                Your plan includes up to {maxedOut.max} business {maxedOut.max === 1 ? 'profile' : 'profiles'}, and
                they're all in use. To track a different business, remove one from the dashboard first.
              </p>
              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/dashboard" className="btn-primary">Back to dashboard</Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      {/* Grid + crystal cursor background (matches landing page bottom) */}
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />

      <Nav />

      <main>
        {/* Hero */}
        <section className="analyze-hero">
          <div className="container analyze-hero-inner">
            <span className="analyze-kicker anim-1">Generate scan</span>
            <h1 className="analyze-title anim-2">
              Three minutes from <em>blank slate</em> to <em>AI visibility report</em>.
            </h1>
            <p className="analyze-sub anim-3">
              Enter your business name, location, and short description. For the free scan, Visaion generates
              the prompts for you so you can get a fast first read on your AI visibility.
            </p>
          </div>
        </section>

        {/* Steps Row */}
        <section className="analyze-steps reveal">
          <div className="container analyze-steps-inner">
            <div className="analyze-step">
              <span className="analyze-step-num">1</span>
              <span className="analyze-step-label">Enter your business</span>
            </div>
            <svg className="analyze-step-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
            <div className="analyze-step">
              <span className="analyze-step-num">2</span>
              <span className="analyze-step-label">We generate prompts</span>
            </div>
            <svg className="analyze-step-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
            <div className="analyze-step">
              <span className="analyze-step-num">3</span>
              <span className="analyze-step-label">Get your score</span>
            </div>
          </div>
        </section>

        {/* Centered Form */}
        <section className="analyze-form-section" id="start" ref={formRef}>
          <div className="container analyze-form-center">
            <p className="analyze-prompt-note reveal">
              Free scans use generated prompts based on your business, location, and category.
              Paid plans unlock custom prompt tracking for the exact searches you care about.
            </p>
            <TiltCard className="analyze-form-tilt reveal">
              <GlowCard customSize radius={18} className="analyze-form-glow !block !p-0 !gap-0">
                <HeroForm />
              </GlowCard>
            </TiltCard>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
