/**
 * Hero — Left side of the hero section.
 * Static content: eyebrow badge, headline, subtitle, platform chips, CTA button.
 */

export function Hero({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <div className="hero-left" style={{ paddingRight: '1rem' }}>
      <div className="eyebrow anim-1">
        <span className="eyebrow-dot"></span>
        AI Visibility Intelligence
      </div>

      <h1 className="anim-2">
        Do AI chatbots<br />
        <em>know your business?</em>
      </h1>

      <p className="hero-sub anim-3">
        When someone asks ChatGPT, Claude, Perplexity, or Gemini to recommend a business like yours — are you mentioned? Find out in 60 seconds with a free AI visibility report.
      </p>

      <div className="platform-row anim-4">
        <span className="platform-row-label">Scans</span>
        <div className="platform-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
          ChatGPT
        </div>
        <div className="platform-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          Claude
        </div>
        <div className="platform-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          Perplexity
        </div>
        <div className="platform-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,20 2,20" /></svg>
          Gemini
        </div>
      </div>

      <div className="hero-cta anim-5">
        <button className="btn-hero-cta" onClick={onCtaClick}>
          Generate My Free Report
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        <span className="hero-cta-note">Free · No credit card · 60 seconds</span>
      </div>
    </div>
  )
}
