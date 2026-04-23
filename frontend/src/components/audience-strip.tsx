const AUDIENCES = [
  'Local Services',
  'Restaurants & Cafes',
  'Health & Wellness',
  'Professional Services',
  'E-Commerce',
  'Contractors & Trades',
  'Real Estate',
  'Marketing Agencies',
  'Consultants',
  'Fitness & Studios',
  'Auto & Repair',
  'Salons & Spas',
]

export function AudienceStrip() {
  return (
    <section className="aud-section">
      <div className="container">
        <div className="aud-header reveal">
          <span className="aud-eyebrow">Built for small businesses</span>
          <h2 className="aud-title">If you run a business, this is for you.</h2>
        </div>

        <div className="aud-pills reveal">
          {AUDIENCES.map((a) => (
            <span key={a} className="aud-pill">{a}</span>
          ))}
        </div>

        <p className="aud-footer reveal">
          No tech skills needed. If you can Google your own business, you can use Visaion.
        </p>
      </div>
    </section>
  )
}
