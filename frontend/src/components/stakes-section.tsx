/**
 * StakesSection — Pain amplification under the hero.
 * Editorial typography on the left, mock ChatGPT answer on the right.
 * The mock cycles through 5 trade/city scenarios; the verdict line
 * teases what an upgrade would reveal (the actual competitor names).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type YourPosition = 'missing' | number

type Scenario = {
  trade: string
  city: string
  yourPosition: YourPosition
  competitors: [string, string, string]
  verdict: string
  cta: string
}

const SCENARIOS: Scenario[] = [
  {
    trade: 'plumber',
    city: 'Denver',
    yourPosition: 1,
    competitors: ['Front Range Pipe Pros', 'Mile High Plumbing Co.', 'Summit Drain & Sewer'],
    verdict: "You're #1. AI recommends you first.",
    cta: "Run a free scan to see your ranking.",
  },
  {
    trade: 'dentist',
    city: 'Austin',
    yourPosition: 4,
    competitors: ['Capitol Smile Studio', 'Bluebonnet Dental Care', 'Hill Country Family Dental'],
    verdict: "You'd rank #4. 3 competitors get listed first.",
    cta: "Run a free scan to see who's ahead.",
  },
  {
    trade: 'roofer',
    city: 'Phoenix',
    yourPosition: 'missing',
    competitors: ['Desert Crest Roofing', 'Saguaro Roof Solutions', 'Valley Sun Contractors'],
    verdict: "Not in the answer. AI named 3 other contractors.",
    cta: "Run a free scan to see who.",
  },
  {
    trade: 'coffee shop',
    city: 'San Diego',
    yourPosition: 2,
    competitors: ['Harbor Mist Roasters', 'Pacific Bean Collective', 'Sunset Coffee Bar'],
    verdict: "You'd rank #2 — but 1 competitor is listed first.",
    cta: "Run a free scan to see who.",
  },
  {
    trade: 'tax advisor',
    city: 'Chicago',
    yourPosition: 'missing',
    competitors: ['Lakeshore Tax Group', 'Wabash Advisors LLC', 'North Loop Accounting'],
    verdict: "Not in the answer. 3 firms recommended instead.",
    cta: "Run a free scan to see who's beating you.",
  },
]

function LockIcon() {
  return (
    <svg className="stakes-lock" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function renderAiLines(s: Scenario) {
  if (s.yourPosition === 'missing') {
    return (
      <>
        {s.competitors.map((name, i) => (
          <div className="stakes-ai-line" key={i}>
            <span className="stakes-rank">{i + 1}.</span>
            <span className="stakes-competitor">{name}</span>
            <LockIcon />
          </div>
        ))}
        <div className="stakes-ai-line stakes-ai-missing">
          <span className="stakes-rank">—</span>
          <span className="stakes-missing-label">Your business not mentioned</span>
        </div>
      </>
    )
  }

  const totalRows = Math.max(3, s.yourPosition)
  const rows: ReactNode[] = []
  let compIdx = 0
  for (let rank = 1; rank <= totalRows; rank++) {
    if (rank === s.yourPosition) {
      rows.push(
        <div className="stakes-ai-line stakes-ai-you-inline" key={rank}>
          <span className="stakes-rank stakes-rank-you">{rank}.</span>
          <span className="stakes-you-label-inline">Your business</span>
          <span className="stakes-you-tag">that's you</span>
        </div>
      )
    } else {
      rows.push(
        <div className="stakes-ai-line" key={rank}>
          <span className="stakes-rank">{rank}.</span>
          <span className="stakes-competitor">{s.competitors[compIdx++]}</span>
          <LockIcon />
        </div>
      )
    }
  }
  return rows
}

export function StakesSection({ onCtaClick }: { onCtaClick: () => void }) {
  const [idx, setIdx] = useState(0)
  const mockRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SCENARIOS.length), 4500)
    return () => clearInterval(t)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = mockRef.current
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

  const s = SCENARIOS[idx]

  return (
    <section className="stakes-section">
      <div className="container stakes-inner">
        <div className="stakes-text reveal">
          <span className="stakes-eyebrow">The cost of invisibility</span>
          <h2 className="stakes-headline">
            The customer you'll <em>never meet.</em>
          </h2>
          <p className="stakes-body">
            Right now, someone is asking ChatGPT for a business like yours. If you're
            not in the answer, they go to a competitor — and you never know the
            conversation happened. There's no missed call. No empty inbox.
            Just silence.
          </p>
          <p className="stakes-kicker">
            That's the part nobody tells you about AI search.
          </p>
        </div>

        <div
          className="stakes-mock reveal"
          ref={mockRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="stakes-chat"
            aria-hidden
            style={{
              transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
          >
            <div className="stakes-chat-header">
              <span className="stakes-chat-dot" />
              <span className="stakes-chat-label">ChatGPT</span>
            </div>

            <div key={`q-${idx}`} className="stakes-bubble stakes-bubble-user">
              What's the best <strong>{s.trade}</strong> in <strong>{s.city}</strong>?
            </div>

            <div key={`a-${idx}`} className="stakes-bubble stakes-bubble-ai">
              {renderAiLines(s)}
            </div>
          </div>

          <div key={`v-${idx}`} className="stakes-verdict">
            <div className="stakes-verdict-line">{s.verdict}</div>
            <button className="stakes-verdict-btn" onClick={onCtaClick}>
              {s.cta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
