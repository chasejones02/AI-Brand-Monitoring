/**
 * LandingPage — Full-bleed golden eye background with hero overlay.
 * The eye fades out via GSAP ScrollTrigger as the user scrolls past
 * the stakes section, revealing a clean grid background underneath.
 * A canvas-based crystal cursor effect activates once the eye is gone.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Nav } from '../components/nav'
import { Hero } from '../components/hero'
import { StakesSection } from '../components/stakes-section'
import { FeaturesStrip } from '../components/features-strip'
import { ScoreboardPreview } from '../components/scoreboard-preview'
import { AudienceStrip } from '../components/audience-strip'
import { Differentiator } from '../components/differentiator'
import { TrustStrip } from '../components/trust-strip'
import { FaqSection } from '../components/faq-section'
import { CtaSection } from '../components/cta-section'
import { Footer } from '../components/footer'
import { CrystalCursor } from '../components/crystal-cursor'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export function LandingPage() {
  const navigate = useNavigate()
  const eyeBgRef = useRef<HTMLDivElement>(null)
  const stakesRef = useRef<HTMLDivElement>(null)
  const [crystalActive, setCrystalActive] = useState(false)

  useScrollReveal()

  useEffect(() => {
    if (!eyeBgRef.current || !stakesRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(eyeBgRef.current, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: stakesRef.current,
          start: 'top 60%',
          end: 'bottom 20%',
          scrub: 1,
        },
      })

      ScrollTrigger.create({
        trigger: stakesRef.current,
        start: 'top 60%',
        end: 'bottom 20%',
        onUpdate: (self) => {
          setCrystalActive(self.progress > 0.85)
        },
      })
    })

    return () => ctx.revert()
  }, [])

  return (
    <>
      <Nav />

      {/* Canvas crystal cursor — activates after eye background fades */}
      <CrystalCursor active={crystalActive} />

      {/* Clean grid background — visible after eye fades */}
      <div className="landing-clean-bg" aria-hidden />

      {/* Full-bleed eye background — fades out on scroll */}
      <div className="landing-eye-bg" ref={eyeBgRef} aria-hidden>
        <img
          src="/ai_brand_monitor_landing_page (2).png"
          alt=""
          className="landing-eye-bg-img"
        />
        <div className="landing-eye-bg-overlay" />
      </div>

      <main>
        <section className="landing-hero-section">
          <div className="container">
            <Hero onCtaClick={() => navigate('/analyze')} />
          </div>
        </section>

        <div ref={stakesRef}>
          <StakesSection onCtaClick={() => navigate('/analyze')} />
        </div>

        <FeaturesStrip />

        <ScoreboardPreview onCtaClick={() => navigate('/analyze')} />

        <AudienceStrip />

        <Differentiator />

        <TrustStrip />

        <FaqSection />

        <CtaSection onCtaClick={() => navigate('/analyze')} />
      </main>

      <Footer />
    </>
  )
}
