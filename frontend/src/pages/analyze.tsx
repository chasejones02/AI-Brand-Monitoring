/**
 * AnalyzePage - Generate scan flow.
 * Steps -> Form.
 * Reached via "Check Your Visibility" CTAs and "Generate scan" nav link.
 *
 * Logged-in users who already have a business are redirected to /dashboard.
 * The form here is the new-user entry point; returning users should manage
 * their existing business from the dashboard rather than spin up another.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { session, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
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
        if ((res?.businesses?.length ?? 0) > 0) {
          navigate('/dashboard', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [authLoading, session, navigate])

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
