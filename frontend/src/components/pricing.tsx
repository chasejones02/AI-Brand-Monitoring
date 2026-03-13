/**
 * Pricing — 3-column pricing cards (Starter, Growth, Agency).
 */

const check = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function Pricing() {
  return (
    <section className="pricing-section" id="pricing">
      <div className="container">
        <div className="section-label">Pricing</div>
        <h2>Start free.<br />Scale when you're ready.</h2>
        <p className="section-sub">Start with a free report. Upgrade for recurring scans, trend tracking, and multi-brand coverage.</p>

        <div className="pricing-grid">
          {/* Starter */}
          <div className="pricing-card">
            <div className="pricing-tier">Starter</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">29</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For solo businesses ready to own their AI presence.</p>
            <ul className="pricing-features">
              <li>{check} 5 queries tracked</li>
              <li>{check} Weekly scans</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Competitor radar</li>
              <li>{check} 1 business profile</li>
            </ul>
            <button className="btn-pricing">Start 7-day free trial</button>
          </div>

          {/* Growth */}
          <div className="pricing-card featured">
            <div className="pricing-tag">Most popular</div>
            <div className="pricing-tier">Growth</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">49</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For growing businesses that need daily visibility and deeper insight.</p>
            <ul className="pricing-features">
              <li>{check} 15 queries tracked</li>
              <li>{check} Daily scans</li>
              <li>{check} All 4 AI platforms</li>
              <li>{check} Competitor radar</li>
              <li>{check} Historical trend graphs</li>
              <li>{check} Email digest reports</li>
            </ul>
            <button className="btn-pricing featured-btn">Start 7-day free trial</button>
          </div>

          {/* Agency */}
          <div className="pricing-card">
            <div className="pricing-tier">Agency</div>
            <div className="pricing-price">
              <span className="pricing-dollar">$</span>
              <span className="pricing-amount">149</span>
              <span className="pricing-period">/mo</span>
            </div>
            <p className="pricing-desc">For marketing agencies managing multiple brands and clients.</p>
            <ul className="pricing-features">
              <li>{check} 30 queries tracked</li>
              <li>{check} Multi-brand (up to 20 profiles)</li>
              <li>{check} Actionable recommendations engine</li>
              <li>{check} White-label PDF reports</li>
              <li>{check} API access</li>
              <li>{check} Priority support</li>
            </ul>
            <button className="btn-pricing">Contact sales</button>
          </div>
        </div>
      </div>
    </section>
  )
}
