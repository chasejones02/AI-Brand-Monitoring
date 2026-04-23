import { useCallback, useRef, useState } from 'react'

export function Differentiator() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const rotateY = ((e.clientX - cx) / (rect.width / 2)) * 6
    const rotateX = ((cy - e.clientY) / (rect.height / 2)) * 6
    setTilt({ x: rotateX, y: rotateY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  return (
    <section className="diff-section">
      <div className="container">
        <div className="diff-header reveal">
          <span className="diff-eyebrow">Why Visaion</span>
          <h2 className="diff-title">AI monitoring shouldn't require a marketing department.</h2>
          <p className="diff-subtitle">
            Most AI visibility tools are built for enterprise teams with enterprise budgets.
            We built something different.
          </p>
        </div>

        <div
          className="diff-card reveal"
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          <div className="diff-col diff-col-them">
            <div className="diff-col-label">Traditional tools</div>
            <ul className="diff-list">
              <li className="diff-item diff-item-them">
                <span className="diff-icon-x" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </span>
                $500 – $2,000+ per month
              </li>
              <li className="diff-item diff-item-them">
                <span className="diff-icon-x" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </span>
                Designed for large marketing teams
              </li>
              <li className="diff-item diff-item-them">
                <span className="diff-icon-x" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </span>
                Complex dashboards with a learning curve
              </li>
              <li className="diff-item diff-item-them">
                <span className="diff-icon-x" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </span>
                Days or weeks to get started
              </li>
            </ul>
          </div>

          <div className="diff-divider" aria-hidden />

          <div className="diff-col diff-col-us">
            <div className="diff-col-label diff-col-label-us">Visaion</div>
            <ul className="diff-list">
              <li className="diff-item diff-item-us">
                <span className="diff-icon-check" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                Starts at $29/month
              </li>
              <li className="diff-item diff-item-us">
                <span className="diff-icon-check" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                Built for one-person businesses
              </li>
              <li className="diff-item diff-item-us">
                <span className="diff-icon-check" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                Reports anyone can understand
              </li>
              <li className="diff-item diff-item-us">
                <span className="diff-icon-check" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                First scan in 60 seconds
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
