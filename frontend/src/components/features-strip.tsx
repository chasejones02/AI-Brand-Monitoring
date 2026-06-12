/**
 * FeaturesStrip — Compact 3-card row under the hero.
 */

import { useCallback, useRef, useState } from 'react'

const FEATURES = [
  {
    title: 'Visibility Tracking',
    body: 'Re-scan whenever you need and watch how AI answers change over time — stay ahead of shifts before they cost you customers.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 3 5-7" />
      </svg>
    ),
  },
  {
    title: 'Platform Breakdown',
    body: 'See exactly how ChatGPT, Claude, Perplexity, and Gemini each talk about your brand — platform by platform, query by query.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6 3" />
      </svg>
    ),
  },
  {
    title: 'Custom Reports',
    body: "Your boss asks \"are we showing up in ChatGPT?\" Hand them a clean report instead of a blank stare. Shareable, client-ready, no setup.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
]

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const maxTilt = 8
    const rotateY = ((e.clientX - cx) / (rect.width / 2)) * maxTilt
    const rotateX = ((cy - e.clientY) / (rect.height / 2)) * maxTilt
    setTilt({ x: rotateX, y: rotateY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  return (
    <article
      ref={ref}
      className="feature-card reveal"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      }}
    >
      {children}
    </article>
  )
}

export function FeaturesStrip() {
  return (
    <section className="features-strip">
      <div className="container features-inner">
        {FEATURES.map((f) => (
          <TiltCard key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </TiltCard>
        ))}
      </div>
    </section>
  )
}
