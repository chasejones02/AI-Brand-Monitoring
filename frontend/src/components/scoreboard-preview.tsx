import { useCallback, useEffect, useRef, useState } from 'react'

type Platform = {
  name: string
  label: string
  pct: number
  found: boolean
}

type Business = {
  name: string
  score: number
  tier: string
  tierColor: string
  platforms: Platform[]
}

const BUSINESSES: Business[] = [
  {
    name: 'Coastal Coffee Co.',
    score: 74,
    tier: 'Visible',
    tierColor: 'var(--accent)',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · #1', pct: 88, found: true  },
      { name: 'Claude',     label: 'mentioned · top 3', pct: 71, found: true  },
      { name: 'Perplexity', label: 'mentioned · #2', pct: 79, found: true  },
      { name: 'Gemini',     label: 'not found',      pct: 0,  found: false },
    ],
  },
  {
    name: 'Apex Roofing Solutions',
    score: 29,
    tier: 'Rarely Visible',
    tierColor: '#f97316',
    platforms: [
      { name: 'ChatGPT',    label: 'not found',         pct: 0,  found: false },
      { name: 'Claude',     label: 'mentioned · top 5', pct: 38, found: true  },
      { name: 'Perplexity', label: 'not found',         pct: 0,  found: false },
      { name: 'Gemini',     label: 'not found',         pct: 0,  found: false },
    ],
  },
  {
    name: 'Luma Skin Studio',
    score: 91,
    tier: 'Highly Visible',
    tierColor: 'var(--green)',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · #1', pct: 96, found: true },
      { name: 'Claude',     label: 'mentioned · #1', pct: 93, found: true },
      { name: 'Perplexity', label: 'mentioned · #2', pct: 88, found: true },
      { name: 'Gemini',     label: 'mentioned · top 3', pct: 81, found: true },
    ],
  },
  {
    name: 'Greenfield Tax Advisors',
    score: 11,
    tier: 'Not Visible',
    tierColor: 'var(--red)',
    platforms: [
      { name: 'ChatGPT',    label: 'not found', pct: 0, found: false },
      { name: 'Claude',     label: 'not found', pct: 0, found: false },
      { name: 'Perplexity', label: 'not found', pct: 0, found: false },
      { name: 'Gemini',     label: 'not found', pct: 0, found: false },
    ],
  },
  {
    name: 'Blue Ridge Adventure Co.',
    score: 57,
    tier: 'Partially Visible',
    tierColor: '#eab308',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · #2', pct: 73, found: true  },
      { name: 'Claude',     label: 'not found',      pct: 0,  found: false },
      { name: 'Perplexity', label: 'mentioned · #1', pct: 87, found: true  },
      { name: 'Gemini',     label: 'mentioned · top 5', pct: 49, found: true },
    ],
  },
]

const R = 52
const CIRC = 2 * Math.PI * R
const SCORE_STEPS = 40

export function ScoreboardPreview({ onCtaClick }: { onCtaClick: () => void }) {
  const [bizIdx, setBizIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [platformsIn, setPlatformsIn] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const biz = BUSINESSES[bizIdx]
  const dash = (score / 100) * CIRC

  useEffect(() => {
    let dead = false
    const ids: ReturnType<typeof setTimeout>[] = []
    function q(fn: () => void, ms: number) {
      ids.push(setTimeout(() => { if (!dead) fn() }, ms))
    }

    setScore(0)
    setPlatformsIn(false)

    const stepSize = Math.max(1, Math.round(biz.score / SCORE_STEPS))
    for (let i = 1; i <= SCORE_STEPS; i++) {
      q(() => setScore((s) => Math.min(s + stepSize, biz.score)), 200 + i * 30)
    }
    q(() => setPlatformsIn(true), 200 + SCORE_STEPS * 30 + 200)

    const nextAt = 200 + SCORE_STEPS * 30 + 200 + 4500
    q(() => setBizIdx((prev) => (prev + 1) % BUSINESSES.length), nextAt)

    return () => { dead = true; ids.forEach(clearTimeout) }
  }, [bizIdx])

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
    <section className="sb-section">
      <div className="container">
        <div className="sb-header reveal">
          <span className="sb-eyebrow">See it in action</span>
          <h2 className="sb-title">Your AI Visibility Report</h2>
          <p className="sb-subtitle">
            Here's what a real scan looks like. Yours is 60 seconds away.
          </p>
        </div>

        <div
          className="sb-card reveal"
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          <div className="sb-dots">
            {BUSINESSES.map((_, i) => (
              <span key={i} className={`sb-dot${i === bizIdx ? ' sb-dot-active' : ''}`} />
            ))}
          </div>

          <div className="sb-card-inner">
            <div className="sb-score-col">
              <div className="sb-ring-wrap">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle
                    cx="60" cy="60" r={R}
                    fill="none"
                    stroke={biz.tierColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${CIRC}`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 0.15s ease' }}
                  />
                </svg>
                <span className="sb-ring-num" style={{ color: biz.tierColor }}>{score}</span>
              </div>
              <div key={bizIdx} className="sb-biz-info">
                <span className="sb-biz-name">{biz.name}</span>
                <span className="sb-biz-tier" style={{ color: biz.tierColor, borderColor: biz.tierColor }}>
                  {biz.tier}
                </span>
              </div>
            </div>

            <div className="sb-plat-col">
              <div className="sb-plat-label">Platform Breakdown</div>
              <div className={`sb-plat-list${platformsIn ? ' sb-plat-in' : ''}`}>
                {biz.platforms.map((p, i) => (
                  <div key={`${bizIdx}-${p.name}`} className="sb-plat-row" style={{ animationDelay: `${i * 0.1}s` }}>
                    <span className="sb-plat-name">{p.name}</span>
                    <span className={`sb-plat-status${p.found ? ' sb-found' : ' sb-missing'}`}>
                      {p.label}
                    </span>
                    <div className="sb-bar-track">
                      <div
                        className="sb-bar-fill"
                        style={{
                          '--w': `${p.pct}%`,
                          background: p.found ? biz.tierColor : 'rgba(255,255,255,0.06)',
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="sb-cta reveal">
          <button className="btn-primary" onClick={onCtaClick}>
            Try it with your business
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
          <p className="sb-cta-sub">Free scan · Takes 60 seconds</p>
        </div>
      </div>
    </section>
  )
}
