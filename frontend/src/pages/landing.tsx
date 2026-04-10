/**
 * LandingPage — Composes all landing page sections in order.
 *
 * Hero: left = headline/chips/CTA, right = auto-playing DemoPlayer.
 * Signup section sits below the ticker with the full HeroForm.
 */

import { useRef, useEffect, useState } from 'react'
import { Nav } from '../components/nav'
import { Hero } from '../components/hero'
import { DemoPlayer } from '../components/demo-player'
import { HeroForm } from '../components/hero-form'
import { Ticker } from '../components/ticker'
import { HowItWorks } from '../components/how-it-works'
import { ReportPreview } from '../components/report-preview'
import { Pricing } from '../components/pricing'
import { CtaSection } from '../components/cta-section'
import { Footer } from '../components/footer'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export function LandingPage() {
  const signupSectionRef = useRef<HTMLElement>(null)
  const [loaderHidden, setLoaderHidden] = useState(false)

  useScrollReveal()

  useEffect(() => {
    const timer = setTimeout(() => setLoaderHidden(true), 900)
    return () => clearTimeout(timer)
  }, [])

  function scrollToForm() {
    signupSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleCtaSubmit(email: string) {
    scrollToForm()
    setTimeout(() => {
      const emailInput = document.getElementById('email') as HTMLInputElement | null
      if (emailInput) {
        emailInput.value = email
        emailInput.focus()
      }
    }, 600)
  }

  return (
    <>
      {/* Page loader */}
      <div className={`page-loader${loaderHidden ? ' hidden' : ''}`}>
        <div className="loader-ring-wrap">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle className="loader-ring-track" cx="48" cy="48" r="42" />
            <circle className="loader-ring-fill" cx="48" cy="48" r="42" />
          </svg>
          <div className="loader-pct">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="8" width="3" height="7" fill="rgba(201,143,10,0.9)" rx="1" />
              <rect x="6" y="5" width="3" height="10" fill="rgba(201,143,10,0.9)" rx="1" />
              <rect x="11" y="2" width="3" height="13" fill="rgba(201,143,10,0.9)" rx="1" />
            </svg>
          </div>
        </div>
      </div>

      <Nav onCtaClick={scrollToForm} />

      <section className="hero">
        <div className="container" style={{ display: 'contents' }}>
          <Hero onCtaClick={scrollToForm} />
          <DemoPlayer onCtaClick={scrollToForm} />
        </div>
      </section>

      <Ticker />

      {/* Signup section */}
      <section className="signup-section" id="get-report" ref={signupSectionRef}>
        <div className="signup-inner">
          <div className="signup-pitch reveal">
            <p className="section-label">Free Report</p>
            <h2>
              Find out if AI chatbots<br />
              <em>mention your business</em>
            </h2>
            <p>
              Enter your email and a few search phrases your customers actually use.
              We'll scan ChatGPT and Claude and return a full visibility report — no credit card needed.
            </p>
            <ul className="signup-benefits">
              <li>AI Visibility Score from 0–100</li>
              <li>Query-by-query breakdown per platform</li>
              <li>Sentiment analysis on every mention</li>
              <li>Results in under 60 seconds</li>
            </ul>
          </div>
          <div className="reveal">
            <HeroForm />
          </div>
        </div>
      </section>

      <HowItWorks />
      <ReportPreview onScrollToForm={scrollToForm} />
      <Pricing />
      <CtaSection onSubmit={handleCtaSubmit} />
      <Footer />
    </>
  )
}
