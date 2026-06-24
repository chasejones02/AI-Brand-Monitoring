/**
 * Footer — Thin single-row bar with working links only.
 */

import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <ul className="footer-links">
          <li><Link to="/pricing">Pricing</Link></li>
          <li><Link to="/terms">Terms</Link></li>
          <li><Link to="/privacy">Privacy</Link></li>
          <li><a href="mailto:support@visaionbrand.com">Contact</a></li>
        </ul>
        <div className="footer-copy">
          © 2026 Vis<span className="logo-ai">ai</span>on. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
