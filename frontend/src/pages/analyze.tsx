/**
 * AnalyzePage — "How it works" narrative flow.
 * Steps → Form → Demo preview → Closing CTA.
 * Reached via "Check Your Visibility" CTAs and "How it works" nav link.
 */

import { useRef } from 'react'
import { Nav } from '../components/nav'
import { DemoPlayer } from '../components/demo-player'
import { HeroForm } from '../components/hero-form'
import { Footer } from '../components/footer'
import { CrystalCursor } from '../components/crystal-cursor'
import { TiltCard } from '../components/ui/tilt-card'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export default function AnalyzePage() {
  const formRef = useRef<HTMLDivElement>(null)

  useScrollReveal()

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => {
      document.getElementById('biz-name')?.focus()
    }, 650)
  }

  return (
    <>
      {/* Grid + crystal cursor background (matches landing page bottom) */}
      <div className="landing-clean-bg" aria-hidden />
      <CrystalCursor active />

      <Nav />

      <main>
        {/* ── Hero ── */}
        <section className="analyze-hero">
          <div className="container analyze-hero-inner">
            <span className="analyze-kicker anim-1">How it works</span>
            <h1 className="analyze-title anim-2">
              Three minutes from <em>blank slate</em> to <em>AI visibility report</em>.
            </h1>
            <p className="analyze-sub anim-3">
              Enter your business, pick a handful of queries your customers actually type,
              and watch the top AI platforms respond in real time.
            </p>
          </div>
        </section>

        {/* ── Preview Section ── */}
        <section className="analyze-preview-section anim-4">
          <div className="container analyze-preview-inner">
            <h2 className="analyze-preview-heading">Here's what you'll get</h2>
            <p className="analyze-preview-sub">
              A real AI visibility report — scores, platform breakdown, and actionable recommendations.
            </p>
            <TiltCard className="analyze-preview-card">
              <div className="analysis-demo-label">
                <span className="analysis-demo-dot" />
                Live Demo
              </div>
              <DemoPlayer />
            </TiltCard>
          </div>
        </section>

        {/* ── Steps Row ── */}
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
              <span className="analyze-step-label">We query AI platforms</span>
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

        {/* ── Centered Form ── */}
        <section className="analyze-form-section" id="start" ref={formRef}>
          <div className="container analyze-form-center">
            <TiltCard>
              <HeroForm />
            </TiltCard>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
