/**
 * Ticker — Scrolling social proof bar.
 * Simulates real AI platform responses with business names
 * that match the type of query being searched.
 * Items are rendered twice to create seamless infinite scroll.
 */

const items = [
  { platform: 'ChatGPT', query: 'best coffee shop in San Diego', biz: 'Coastal Coffee Co.', highlight: true },
  { platform: 'Perplexity', query: 'emergency plumber near me', biz: 'BlueSky Plumbing Co.', highlight: false },
  { platform: 'Claude', query: 'top facial studio in Austin', biz: 'Luma Skin Studio', highlight: true },
  { platform: 'Gemini', query: 'small business accountant Denver', biz: 'Greenfield Tax Advisors', highlight: false },
  { platform: 'ChatGPT', query: 'best roofing contractor Phoenix', biz: 'Apex Roofing Solutions', highlight: true },
  { platform: 'Perplexity', query: 'real estate agent Charlotte NC', biz: 'Harbor View Realty', highlight: false },
  { platform: 'Claude', query: 'personal trainer downtown Portland', biz: 'Nova Fitness Studio', highlight: true },
  { platform: 'Gemini', query: 'bakery with custom cakes Brooklyn', biz: 'Maple Street Bakery', highlight: false },
]

function TickerItems() {
  return (
    <>
      {items.map((item, i) => (
        <span className="ticker-item" key={i}>
          <span className="tick-platform">{item.platform}</span>
          <span className="ticker-sep">·</span>
          <span className="tick-query">"{item.query}"</span>
          <span className="ticker-sep">·</span>
          <span className="tick-biz">{item.biz}</span>
          {item.highlight && <span className="tick-you">That's you</span>}
        </span>
      ))}
    </>
  )
}

export function Ticker() {
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        <TickerItems />
        <TickerItems />
      </div>
    </div>
  )
}
