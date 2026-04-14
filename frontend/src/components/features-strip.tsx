/**
 * FeaturesStrip — Compact 3-card row under the hero.
 */

const FEATURES = [
  {
    title: 'Real-time Monitoring',
    body: 'Track how AI answers change week over week — stay ahead of shifts before they cost you customers.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 3 5-7" />
      </svg>
    ),
  },
  {
    title: 'Platform Breakdown',
    body: 'A per-platform scoreboard across ChatGPT, Claude, Perplexity, and Gemini so you know exactly where you are — and where you are not.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6 3" />
      </svg>
    ),
  },
  {
    title: 'Custom Reports',
    body: 'Clean, executive-ready reports you can share with clients or a team — no spreadsheet gymnastics required.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
]

export function FeaturesStrip() {
  return (
    <section className="features-strip">
      <div className="container features-inner">
        {FEATURES.map((f) => (
          <article key={f.title} className="feature-card reveal">
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
