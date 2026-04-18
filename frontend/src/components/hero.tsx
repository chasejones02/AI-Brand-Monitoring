/**
 * Hero — Text-only hero block.
 * The eye itself is rendered as a viewport-fixed element by LandingPage
 * so it stays centered while this text scrolls up and overlays it.
 */

import { useEffect, useState } from 'react'

type FeedItem = {
  platform: 'ChatGPT' | 'Claude' | 'Perplexity' | 'Gemini'
  biz: string
  status: string
  query: string
  found: boolean
}

const FEED_ITEMS: FeedItem[] = [
  { platform: 'ChatGPT',    biz: 'Coastal Coffee Co.',      status: 'mentioned · #1', query: 'best coffee in San Diego',           found: true  },
  { platform: 'Claude',     biz: 'Luma Skin Studio',        status: 'mentioned · #1', query: 'top facial studio in Austin',         found: true  },
  { platform: 'Perplexity', biz: 'Apex Roofing Solutions',  status: 'not found',      query: 'roofing contractor Phoenix AZ',       found: false },
  { platform: 'ChatGPT',    biz: 'Blue Ridge Adventure Co.',status: 'mentioned · #2', query: 'kayak rentals in Asheville',          found: true  },
  { platform: 'Gemini',     biz: 'Greenfield Tax Advisors', status: 'not found',      query: 'small business accountant Denver',    found: false },
  { platform: 'Perplexity', biz: 'Coastal Coffee Co.',      status: 'mentioned · #2', query: 'specialty coffee San Diego',          found: true  },
]

function LiveMentionFeed() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % FEED_ITEMS.length), 3500)
    return () => clearInterval(t)
  }, [])

  const item = FEED_ITEMS[idx]

  return (
    <div className="hero-feed" aria-live="polite">
      <span className="hero-feed-pulse" aria-hidden>
        <span className="hero-feed-pulse-dot" />
      </span>
      <span className="hero-feed-label">Live scans</span>
      <span className="hero-feed-divider" aria-hidden />
      <div key={idx} className="hero-feed-row">
        <span className="hero-feed-platform">{item.platform}</span>
        <span className="hero-feed-biz">{item.biz}</span>
        <span className={`hero-feed-status ${item.found ? 'is-found' : 'is-missing'}`}>
          {item.status}
        </span>
        <span className="hero-feed-query">"{item.query}"</span>
      </div>
    </div>
  )
}

export function Hero({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <div className="hero-compact">
      <h1 className="hero-compact-title anim-2">
        Does AI see <em>your brand</em>?
      </h1>

      <p className="hero-compact-sub anim-3">
        Customers ask ChatGPT before Google now. See if your business is in the answer.
      </p>

      <div className="hero-compact-cta anim-4">
        <button className="btn-primary hero-check-btn" onClick={onCtaClick}>
          Check Your Visibility
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="hero-trust anim-4">
        <span>Free scan</span>
        <span className="hero-trust-sep" aria-hidden>·</span>
        <span>No credit card</span>
        <span className="hero-trust-sep" aria-hidden>·</span>
        <span>Upgrade when ready</span>
      </p>

      <div className="anim-5">
        <LiveMentionFeed />
      </div>
    </div>
  )
}
