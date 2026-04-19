export function TrustStrip() {
  return (
    <section className="trust-section">
      <div className="container">
        <div className="trust-inner reveal">
          <div className="trust-block">
            <div className="trust-block-label">Scanning across</div>
            <div className="trust-platforms">
              <span className="trust-platform">ChatGPT</span>
              <span className="trust-platform-sep" aria-hidden>·</span>
              <span className="trust-platform">Claude</span>
              <span className="trust-platform-sep" aria-hidden>·</span>
              <span className="trust-platform">Perplexity</span>
              <span className="trust-platform-sep" aria-hidden>·</span>
              <span className="trust-platform">Gemini</span>
            </div>
          </div>

          <div className="trust-divider" aria-hidden />

          <div className="trust-block">
            <div className="trust-early">
              <span className="trust-early-dot" />
              Just launched — be one of the first 100
            </div>
          </div>

          <div className="trust-divider" aria-hidden />

          <div className="trust-block">
            <div className="trust-promises">
              <span className="trust-promise">Free scan</span>
              <span className="trust-promise-sep" aria-hidden>·</span>
              <span className="trust-promise">No credit card</span>
              <span className="trust-promise-sep" aria-hidden>·</span>
              <span className="trust-promise">Upgrade when ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
