/**
 * LandingPage — Minimal editorial layout.
 * Fixed, viewport-centered eye stays put while the hero copy, quotes,
 * and feature cards scroll up and overlay it.
 *
 * 1. Nav  2. Fixed centered eye
 * 3. Full-viewport spacer (eye alone above the fold)
 * 4. Hero text + CTA + quote strip (scrolls over eye)
 * 5. Feature strip  6. Footer
 */

import { useNavigate } from 'react-router-dom'
import { Nav } from '../components/nav'
import { Hero } from '../components/hero'
import { FeaturesStrip } from '../components/features-strip'
import { Footer } from '../components/footer'
import { useScrollReveal } from '../hooks/use-scroll-reveal'

export function LandingPage() {
  const navigate = useNavigate()

  useScrollReveal()

  return (
    <>
      <Nav />

      <div className="hero-eye-fixed" aria-hidden>
        <img src="/eye.png" alt="" className="hero-eye-img anim-1" />
      </div>

      <main>
        <section className="hero-section">
          <div className="hero-eye-spacer" aria-hidden />
          <div className="container">
            <Hero onCtaClick={() => navigate('/analyze')} />
          </div>
        </section>

        <FeaturesStrip />
      </main>

      <Footer />
    </>
  )
}
