export function CtaSection({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <section className="cta-final">
      <div className="container">
        <div className="cta-final-inner reveal">
          <h2 className="cta-final-title">
            Find out where you stand.
          </h2>
          <p className="cta-final-sub">
            Your customers are already asking AI for businesses like yours.
            See if you're in the answer — it takes 60 seconds.
          </p>

          <button className="btn-primary cta-final-btn" onClick={onCtaClick}>
            Check Your Visibility
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>

          <p className="cta-final-trust">
            <span>Free scan</span>
            <span className="cta-final-sep" aria-hidden>·</span>
            <span>No credit card</span>
            <span className="cta-final-sep" aria-hidden>·</span>
            <span>Upgrade when ready</span>
          </p>
        </div>
      </div>
    </section>
  )
}
