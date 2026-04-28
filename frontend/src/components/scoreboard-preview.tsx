import { DemoPlayer } from './demo-player'
import { GlowCard } from './ui/spotlight-card'
import { TiltCard } from './ui/tilt-card'

export function ScoreboardPreview({ onCtaClick }: { onCtaClick: () => void }) {
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

        <TiltCard className="analyze-preview-card sb-demo-tilt reveal">
          <GlowCard customSize radius={18} className="sb-demo-card !block !p-0 !gap-0">
            <div className="analysis-demo-label">
              <span className="analysis-demo-dot" />
              Live Demo
            </div>
            <DemoPlayer />
          </GlowCard>
        </TiltCard>

        <div className="sb-cta reveal">
          <button className="btn-primary" onClick={onCtaClick}>
            Try it with your business
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
          <p className="sb-cta-sub">Free scan - Takes 60 seconds</p>
        </div>
      </div>
    </section>
  )
}
