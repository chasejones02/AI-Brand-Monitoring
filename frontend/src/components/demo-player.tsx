/**
 * DemoPlayer — Auto-playing animated walkthrough of the app.
 * Cycles through 5 businesses with different AI scores.
 * Each cycle: typing → generate → results (4 platforms + recommendations).
 */

import { useState, useEffect, useRef } from 'react'

type DemoPlatform = {
  name: string
  label: string
  pct: number
  found: boolean
}

type DemoRec = {
  text: string
  priority: boolean
}

type DemoBusiness = {
  name: string
  query: string
  score: number
  tier: string
  tierColor: string
  platforms: DemoPlatform[]
  recs: DemoRec[]
}

const BUSINESSES: DemoBusiness[] = [
  {
    name: 'Coastal Coffee Co.',
    query: 'best coffee shop in San Diego',
    score: 74,
    tier: 'Visible',
    tierColor: 'var(--accent)',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · rank #1', pct: 88, found: true  },
      { name: 'Claude',     label: 'mentioned · top 3',   pct: 71, found: true  },
      { name: 'Perplexity', label: 'mentioned · rank #2', pct: 79, found: true  },
      { name: 'Gemini',     label: 'not found',           pct: 0,  found: false },
    ],
    recs: [
      { text: 'Add your menu to Google Business Profile to improve Gemini visibility', priority: true  },
      { text: 'Request mentions from San Diego food blogs — AI models cite them heavily', priority: false },
    ],
  },
  {
    name: 'Apex Roofing Solutions',
    query: 'roofing contractor Phoenix AZ',
    score: 29,
    tier: 'Rarely Visible',
    tierColor: '#f97316',
    platforms: [
      { name: 'ChatGPT',    label: 'not found',         pct: 0,  found: false },
      { name: 'Claude',     label: 'mentioned · top 5', pct: 38, found: true  },
      { name: 'Perplexity', label: 'not found',         pct: 0,  found: false },
      { name: 'Gemini',     label: 'not found',         pct: 0,  found: false },
    ],
    recs: [
      { text: 'Fully complete your Google Business Profile — it is your #1 lever', priority: true  },
      { text: 'Get listed on HomeAdvisor and Angi — AI recommendations pull from these', priority: true  },
    ],
  },
  {
    name: 'Luma Skin Studio',
    query: 'top facial treatment studio Austin',
    score: 91,
    tier: 'Highly Visible',
    tierColor: 'var(--green)',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · rank #1', pct: 96, found: true },
      { name: 'Claude',     label: 'mentioned · rank #1', pct: 93, found: true },
      { name: 'Perplexity', label: 'mentioned · rank #2', pct: 88, found: true },
      { name: 'Gemini',     label: 'mentioned · top 3',   pct: 81, found: true },
    ],
    recs: [
      { text: 'Expand to 3 more target queries to capture broader search intent', priority: false },
      { text: 'Add FAQ schema to your website to protect your top ranking long-term', priority: false },
    ],
  },
  {
    name: 'Greenfield Tax Advisors',
    query: 'small business accountant Denver',
    score: 11,
    tier: 'Not Visible',
    tierColor: 'var(--red)',
    platforms: [
      { name: 'ChatGPT',    label: 'not found', pct: 0, found: false },
      { name: 'Claude',     label: 'not found', pct: 0, found: false },
      { name: 'Perplexity', label: 'not found', pct: 0, found: false },
      { name: 'Gemini',     label: 'not found', pct: 0, found: false },
    ],
    recs: [
      { text: 'Claim and fully fill out your Google Business Profile immediately', priority: true  },
      { text: 'Publish a free tax guide PDF — AI models cite authoritative content', priority: true  },
    ],
  },
  {
    name: 'Blue Ridge Adventure Co.',
    query: 'kayak rentals Asheville NC',
    score: 57,
    tier: 'Partially Visible',
    tierColor: '#eab308',
    platforms: [
      { name: 'ChatGPT',    label: 'mentioned · rank #2', pct: 73, found: true  },
      { name: 'Claude',     label: 'not found',           pct: 0,  found: false },
      { name: 'Perplexity', label: 'mentioned · rank #1', pct: 87, found: true  },
      { name: 'Gemini',     label: 'mentioned · top 5',   pct: 49, found: true  },
    ],
    recs: [
      { text: 'Claude does not mention you — add detailed FAQ content to your website', priority: true  },
      { text: 'Your Perplexity rank #1 is strong — keep Yelp and TripAdvisor current', priority: false },
    ],
  },
]

type Phase = 'input' | 'clicking' | 'results'

const SCORE_STEPS = 35

export function DemoPlayer({ onCtaClick }: { onCtaClick: () => void }) {
  const [bizIdx, setBizIdx] = useState(0)
  const [currentBiz, setCurrentBiz] = useState<DemoBusiness>(BUSINESSES[0])
  const [bizChars, setBizChars] = useState(0)
  const [queryChars, setQueryChars] = useState(0)
  const [phase, setPhase] = useState<Phase>('input')
  const [score, setScore] = useState(0)
  const [platformsIn, setPlatformsIn] = useState(false)
  const [recsIn, setRecsIn] = useState(false)

  const cancelRef = useRef<() => void>(() => {})
  const idxRef = useRef(0)

  useEffect(() => {
    function run() {
      const idx = idxRef.current % BUSINESSES.length
      const biz = BUSINESSES[idx]
      idxRef.current++

      cancelRef.current()
      const ids: ReturnType<typeof setTimeout>[] = []
      let dead = false
      cancelRef.current = () => { dead = true; ids.forEach(clearTimeout) }

      function q(fn: () => void, ms: number) {
        ids.push(setTimeout(() => { if (!dead) fn() }, ms))
      }

      // Reset all state for the new business
      setBizIdx(idx)
      setCurrentBiz(biz)
      setBizChars(0)
      setQueryChars(0)
      setPhase('input')
      setScore(0)
      setPlatformsIn(false)
      setRecsIn(false)

      // Type business name: 50ms per char
      for (let i = 1; i <= biz.name.length; i++) {
        q(() => setBizChars(c => c + 1), i * 50)
      }

      // Pause 500ms then type query: 40ms per char
      const qStart = biz.name.length * 50 + 500
      for (let i = 1; i <= biz.query.length; i++) {
        q(() => setQueryChars(c => c + 1), qStart + i * 40)
      }

      // Pause 800ms then show button clicking
      const clickAt = qStart + biz.query.length * 40 + 800
      q(() => setPhase('clicking'), clickAt)

      // 700ms later → results screen
      const resultsAt = clickAt + 700
      q(() => { setPhase('results'); setScore(0) }, resultsAt)

      // Animate score in 35 steps regardless of final value (~1.4s total)
      const stepSize = Math.max(1, Math.round(biz.score / SCORE_STEPS))
      for (let i = 1; i <= SCORE_STEPS; i++) {
        q(() => setScore(s => Math.min(s + stepSize, biz.score)), resultsAt + 150 + i * 38)
      }
      const scoreEndAt = resultsAt + 150 + SCORE_STEPS * 38

      // Platform rows stagger in after score
      const platformsAt = scoreEndAt + 300
      q(() => setPlatformsIn(true), platformsAt)

      // Recommendations fade in after platforms
      const recsAt = platformsAt + 800
      q(() => setRecsIn(true), recsAt)

      // Hold on results for 5s then cycle to next business
      q(run, recsAt + 5000)
    }

    run()
    return () => cancelRef.current()
  }, [])

  const bizDone = bizChars >= currentBiz.name.length
  const showBizCursor = phase === 'input' && !bizDone
  const showQueryCursor = phase === 'input' && bizDone && queryChars < currentBiz.query.length

  // SVG arc for score
  const R = 34
  const circ = 2 * Math.PI * R
  const dash = (score / 100) * circ

  return (
    <div className="form-card demo-player anim-5">
      {/* Progress dots */}
      <div className="demo-dots">
        {BUSINESSES.map((_, i) => (
          <span key={i} className={`demo-dot${i === bizIdx ? ' demo-dot-active' : ''}`} />
        ))}
      </div>

      {phase !== 'results' ? (
        /* ── Input phase ── */
        <div>
          <div className="demo-header">
            <span className="demo-live-badge">
              <span className="demo-live-dot" />
              Live Demo
            </span>
            <p className="demo-header-sub">See how it works</p>
          </div>

          <div className="demo-field">
            <div className="demo-field-label">Business Name</div>
            <div className="demo-input-mock">
              {bizChars > 0 ? (
                <>
                  <span>{currentBiz.name.slice(0, bizChars)}</span>
                  {showBizCursor && <span className="demo-cursor" />}
                </>
              ) : (
                <span className="demo-mock-placeholder">e.g. Coastal Coffee Co.</span>
              )}
            </div>
          </div>

          <div className={`demo-field${!bizDone ? ' demo-field-dim' : ''}`}>
            <div className="demo-field-label">What should AI find you for?</div>
            <div className="demo-input-mock">
              {queryChars > 0 ? (
                <>
                  <span>{currentBiz.query.slice(0, queryChars)}</span>
                  {showQueryCursor && <span className="demo-cursor" />}
                </>
              ) : bizDone ? (
                <span className="demo-mock-placeholder">best coffee shop in San Diego</span>
              ) : null}
            </div>
          </div>

          <button
            className={`btn-primary${phase === 'clicking' ? ' demo-btn-clicking' : ''}`}
            tabIndex={-1}
            style={{ marginTop: '0.5rem' }}
          >
            {phase === 'clicking' ? 'Generating report...' : 'Generate My Report'}
            {phase === 'clicking' ? (
              <div className="spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        /* ── Results phase ── */
        <div style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) both' }}>

          {/* Score */}
          <div className="demo-score-row">
            <div className="demo-arc-wrap">
              <svg width="82" height="82" viewBox="0 0 82 82">
                <circle cx="41" cy="41" r={R} fill="none" stroke="var(--border)" strokeWidth="5" />
                <circle
                  cx="41" cy="41" r={R}
                  fill="none"
                  stroke={currentBiz.tierColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  transform="rotate(-90 41 41)"
                />
              </svg>
              <div className="demo-arc-num" style={{ color: currentBiz.tierColor }}>{score}</div>
            </div>
            <div>
              <div className="demo-score-label">AI Visibility Score</div>
              <div className="demo-score-biz">{currentBiz.name}</div>
              <div className="demo-score-tier" style={{ color: currentBiz.tierColor }}>
                {currentBiz.tier}
              </div>
            </div>
          </div>

          {/* Platform results */}
          <div className={`demo-platforms-list${platformsIn ? ' demo-platforms-in' : ''}`}>
            {currentBiz.platforms.map((p, i) => (
              <div key={p.name} className="demo-plat-row" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="demo-plat-top">
                  <span className="demo-plat-name">{p.name}</span>
                  <span className={`demo-plat-status${p.found ? ' demo-plat-found' : ' demo-plat-missing'}`}>
                    {p.label}
                  </span>
                </div>
                <div className="demo-bar-track">
                  <div
                    className="demo-bar-fill"
                    style={{
                      '--w': `${p.pct}%`,
                      background: p.found ? 'var(--accent)' : 'var(--border)',
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className={`demo-recs${recsIn ? ' demo-recs-in' : ''}`}>
            <div className="demo-recs-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
              Recommendations
            </div>
            {currentBiz.recs.map((rec, i) => (
              <div
                key={i}
                className={`demo-rec-item${rec.priority ? ' demo-rec-priority' : ''}`}
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <span className="demo-rec-dot" />
                <span className="demo-rec-text">{rec.text}</span>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={onCtaClick} style={{ marginTop: '1.25rem' }}>
            Try with your business
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
