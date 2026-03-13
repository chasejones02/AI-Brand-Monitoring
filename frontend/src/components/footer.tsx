/**
 * Footer — Bottom bar with logo + links.
 */

export function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-copy">© 2026 Vis<span className="logo-ai">ai</span>on. All rights reserved.</div>
        <ul className="footer-links">
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
      </div>
    </footer>
  )
}
