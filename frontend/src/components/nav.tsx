/**
 * Nav — Fixed top navigation bar.
 * Logo + nav links + CTA button that scrolls to the hero form.
 */

interface NavProps {
  onCtaClick: () => void
}

export function Nav({ onCtaClick }: NavProps) {
  return (
    <nav>
      <div className="container nav-inner">
        <a href="#" className="logo">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="8" width="3" height="7" fill="#000" rx="1" />
              <rect x="6" y="5" width="3" height="10" fill="#000" rx="1" />
              <rect x="11" y="2" width="3" height="13" fill="#000" rx="1" />
            </svg>
          </div>
          <span className="logo-text">
            Vis<span className="logo-ai">ai</span>on
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#report">Sample report</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="/auth">Sign in</a></li>
        </ul>

        <button className="btn-nav" onClick={onCtaClick}>
          Get Free Report
        </button>
      </div>
    </nav>
  )
}
