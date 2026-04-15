/**
 * Hero — Text-only hero block.
 * The eye itself is rendered as a viewport-fixed element by LandingPage
 * so it stays centered while this text scrolls up and overlays it.
 */

export function Hero({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <div className="hero-compact">
      <h1 className="hero-compact-title anim-2">
        Does AI see <em>your brand</em>?
      </h1>

      <p className="hero-compact-sub anim-3">Find out now</p>

      <div className="hero-compact-cta anim-4">
        <button className="btn-primary hero-check-btn" onClick={onCtaClick}>
          Check Your Visibility
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="hero-quotes anim-5">
        <span className="hero-quote"><span className="hero-quote-src">ChatGPT</span>"Mentioned <em>your brand</em> in a business query…"</span>
        <span className="hero-quote-sep">·</span>
        <span className="hero-quote"><span className="hero-quote-src">Claude</span>"Recommended <em>your brand</em> for visibility…"</span>
        <span className="hero-quote-sep">·</span>
        <span className="hero-quote"><span className="hero-quote-src">Gemini</span>"<em>your brand</em> is a valuable tool…"</span>
      </div>
    </div>
  )
}
