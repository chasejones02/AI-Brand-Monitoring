/**
 * LandingPage — Full-bleed golden eye background with hero overlay.
 * The eye image covers the viewport as a background.
 * Hero text, CTA, quote strip, feature cards, and footer layer on top.
 */

import { useNavigate } from 'react-router-dom'
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
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export function LandingPage() {
  const navigate = useNavigate()

  useScrollReveal()

  return (
    <>
      <Nav />

      {/* Full-bleed eye background */}
      <div className="landing-eye-bg" aria-hidden>
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

        <StakesSection onCtaClick={() => navigate('/analyze')} />

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
