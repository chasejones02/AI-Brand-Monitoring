/**
 * HowItWorks — 3-step grid explaining the product flow.
 */

export function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-label">How it works</div>
        <h2>From name to report<br />in under 60 seconds.</h2>
        <p className="section-sub">No setup. No agents. No scrapers. We query the actual AI platforms and analyze the results in real time.</p>

        <div className="steps-grid">
          <div className="step">
            <div className="step-num">01</div>
            <div className="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
            <h3>Enter your business &amp; queries</h3>
            <p>Tell us your business name and the search phrases your customers use — like <em>"best accountant in Denver"</em>. We handle the rest.</p>
          </div>

          <div className="step">
            <div className="step-num">02</div>
            <div className="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </div>
            <h3>We query 4 AI platforms</h3>
            <p>Our engine fires relevant prompts at ChatGPT, Claude, Perplexity, and Gemini — the same queries your potential customers use.</p>
          </div>

          <div className="step">
            <div className="step-num">03</div>
            <div className="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
            </div>
            <h3>Report hits your inbox</h3>
            <p>You get a full breakdown: mention rate, position, sentiment, and an AI Visibility Score from 0–100. Actionable. Clear. Immediate.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
