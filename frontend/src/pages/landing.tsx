/**
 * LandingPage — Composes all landing page sections in order.
 *
 * Owns the hero form ref for scroll-to-form from nav/CTA.
 * Initializes scroll-reveal animations on mount.
 */

import { useRef } from 'react'
import { Nav } from '../components/nav'
import { Hero } from '../components/hero'
import { HeroForm } from '../components/hero-form'
import { Ticker } from '../components/ticker'
import { HowItWorks } from '../components/how-it-works'
import { ReportPreview } from '../components/report-preview'
import { Pricing } from '../components/pricing'
import { CtaSection } from '../components/cta-section'
import { Footer } from '../components/footer'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export function LandingPage() {
  const heroFormRef = useRef<HTMLDivElement>(null)

  useScrollReveal()

  function scrollToForm() {
    heroFormRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleCtaSubmit(email: string) {
    // Pre-fill the email field and scroll to form
    const emailInput = document.getElementById('email') as HTMLInputElement | null
    if (emailInput) emailInput.value = email
    scrollToForm()
    setTimeout(() => {
      const bizInput = document.getElementById('biz-name') as HTMLInputElement | null
      bizInput?.focus()
    }, 600)
  }

  return (
    <>
      <Nav onCtaClick={scrollToForm} />

      <section className="hero">
        <div className="hero-glow"></div>
        <div className="container" style={{ display: 'contents' }}>
          <Hero />
          <HeroForm ref={heroFormRef} />
        </div>
      </section>

      <Ticker />
      <HowItWorks />
      <ReportPreview onScrollToForm={scrollToForm} />
      <Pricing />
      <CtaSection onSubmit={handleCtaSubmit} />
      <Footer />
    </>
  )
}
