/**
 * AnalyzePage — "How it works" demo + "Start your analysis" form.
 * Reached via the "Check Your Visibility" CTAs and the "How it works"
 * nav link on the landing page.
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

        <section className="analysis-section" id="start">
          <div className="container analysis-inner">
            <TiltCard className="analysis-demo reveal">
              <div className="analysis-demo-label">
                <span className="analysis-demo-dot" />
                See how it works
              </div>
              <DemoPlayer onCtaClick={scrollToForm} />
            </TiltCard>

            <div className="analysis-form-wrap reveal" ref={formRef}>
              <TiltCard>
                <HeroForm />
              </TiltCard>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
