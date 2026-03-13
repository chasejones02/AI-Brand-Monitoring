/**
 * Ticker — Scrolling social proof bar.
 * Items are rendered twice in JSX (instead of duplicating innerHTML)
 * to create the seamless infinite scroll effect.
 */

const items = [
  { biz: 'Maple Street Bakery', score: '78/100', detail: 'Mentioned on 3/4 platforms' },
  { biz: 'Summit Legal Group', score: '45/100', detail: 'Not found on Perplexity' },
  { biz: 'BlueSky Plumbing Co.', score: '91/100', detail: 'Top mention on all platforms' },
  { biz: 'Harbor View Realty', score: '34/100', detail: 'Competitor ranked #1' },
  { biz: 'Nova Fitness Studio', score: '62/100', detail: 'Positive sentiment · 2/4 platforms' },
  { biz: 'Clearwater Accounting', score: '55/100', detail: 'Neutral mention · ChatGPT only' },
]

function TickerItems() {
  return (
    <>
      {items.map((item, i) => (
        <span className="ticker-item" key={i}>
          <span className="tick-biz">{item.biz}</span>
          <span className="ticker-sep">·</span>
          AI Score <span className="tick-score">{item.score}</span>
          <span className="ticker-sep">·</span>
          {item.detail}
        </span>
      ))}
    </>
  )
}

export function Ticker() {
  return (
    <div className="ticker-wrap">
      <div className="ticker-inner">
        {/* Render items twice for seamless loop */}
        <TickerItems />
        <TickerItems />
      </div>
    </div>
  )
}
