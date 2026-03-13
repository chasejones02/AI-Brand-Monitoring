/**
 * ReportPreview — Sample report section with plan tab switcher.
 *
 * State: activePlan controls which report content + feature list is visible.
 * Plans: 'free' | 'starter' | 'growth' | 'agency'
 *
 * The report preview card scrolls back to top when switching plans.
 */

import { useState, useRef } from 'react'

type Plan = 'free' | 'starter' | 'growth' | 'agency'

// Shared platform scores bar rows used by all plans
function PlatformScores() {
  return (
    <div className="platform-scores">
      <div className="platform-score-row">
        <span className="ps-name">ChatGPT</span>
        <div className="ps-bar-wrap"><div className="ps-bar" style={{ '--w': '82%' } as React.CSSProperties}></div></div>
        <span className="ps-val">82</span>
      </div>
      <div className="platform-score-row">
        <span className="ps-name">Claude</span>
        <div className="ps-bar-wrap"><div className="ps-bar" style={{ '--w': '90%' } as React.CSSProperties}></div></div>
        <span className="ps-val">90</span>
      </div>
      <div className="platform-score-row">
        <span className="ps-name">Perplexity</span>
        <div className="ps-bar-wrap"><div className="ps-bar mid" style={{ '--w': '71%' } as React.CSSProperties}></div></div>
        <span className="ps-val">71</span>
      </div>
      <div className="platform-score-row">
        <span className="ps-name">Gemini</span>
        <div className="ps-bar-wrap"><div className="ps-bar low" style={{ '--w': '28%' } as React.CSSProperties}></div></div>
        <span className="ps-val">28</span>
      </div>
    </div>
  )
}

function ScoreDisplay() {
  return (
    <div className="score-display">
      <div className="score-label">AI Visibility Score</div>
      <div className="score-number">78</div>
      <div className="score-max">out of 100</div>
    </div>
  )
}

function CompetitorRadar() {
  return (
    <>
      <div className="report-divider"></div>
      <div className="report-section-label">Competitor Radar</div>
      <div className="comp-row">
        <span className="comp-name">Sweet Things Co.</span>
        <div className="comp-bar-wrap"><div className="comp-bar" style={{ width: '91%' }}></div></div>
        <span className="comp-val">91</span>
      </div>
      <div className="comp-row">
        <span className="comp-name">Harbor Cakes</span>
        <div className="comp-bar-wrap"><div className="comp-bar" style={{ width: '84%' }}></div></div>
        <span className="comp-val">84</span>
      </div>
      <div className="comp-row">
        <span className="comp-name">Flour + Co.</span>
        <div className="comp-bar-wrap"><div className="comp-bar" style={{ width: '62%' }}></div></div>
        <span className="comp-val">62</span>
      </div>
    </>
  )
}

function QueryBreakdown({ extra }: { extra?: boolean }) {
  return (
    <>
      <div className="report-divider"></div>
      <div className="report-section-label">Query Breakdown</div>
      <div className="query-item">
        <div className="query-text">"best bakery near downtown for custom cakes"</div>
        <div className="query-meta">
          <span className="query-badge mentioned">Mentioned #2</span>
          <span className="query-platform-tag">ChatGPT · Claude · Perplexity</span>
        </div>
      </div>
      <div className="query-item">
        <div className="query-text">"where to buy artisan sourdough in [city]"</div>
        <div className="query-meta">
          <span className="query-badge mentioned">Mentioned #1</span>
          <span className="query-platform-tag">Claude · Gemini</span>
        </div>
      </div>
      <div className="query-item">
        <div className="query-text">"bakeries open Sunday with vegan options"</div>
        <div className="query-meta">
          <span className="query-badge not-found">Not found</span>
          <span className="query-platform-tag">All platforms</span>
        </div>
      </div>
      {extra && (
        <div className="query-item">
          <div className="query-text">"best place to order a wedding cake in [city]"</div>
          <div className="query-meta">
            <span className="query-badge mentioned">Mentioned #3</span>
            <span className="query-platform-tag">ChatGPT · Perplexity</span>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Plan-specific report content ───────────────────────

function FreeContent() {
  return (
    <>
      <div className="report-preview-header">
        <div>
          <div className="report-biz-name">Maple Street Bakery</div>
          <div className="report-date">Report generated · March 2026</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.72rem', color: 'var(--green)', fontFamily: "'JetBrains Mono',monospace" }}>
          <div className="scan-dot active"></div>
          Complete
        </div>
      </div>
      <ScoreDisplay />
      <PlatformScores />
    </>
  )
}

function PaidHeader({ badge }: { badge: string }) {
  return (
    <div className="report-preview-header">
      <div>
        <div className="report-biz-name">Maple Street Bakery</div>
        <div className="report-date">Report generated · March 2026</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <span style={{ fontSize: '.65rem', fontWeight: 600, background: 'rgba(240,165,0,.1)', color: 'var(--accent)', border: '1px solid rgba(240,165,0,.25)', borderRadius: '4px', padding: '.1rem .45rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>{badge}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: 'var(--green)', fontFamily: "'JetBrains Mono',monospace" }}><div className="scan-dot active"></div>Live</div>
      </div>
    </div>
  )
}

function StarterContent() {
  return (
    <>
      <PaidHeader badge="Weekly" />
      <ScoreDisplay />
      <PlatformScores />
      <div className="report-divider"></div>
      <div className="report-section-label">4-Week Trend</div>
      <div className="trend-bars">
        <div className="trend-col"><div className="trend-bar" style={{ height: '26px' }}></div><div className="trend-lbl">wk 1</div></div>
        <div className="trend-col"><div className="trend-bar" style={{ height: '32px' }}></div><div className="trend-lbl">wk 2</div></div>
        <div className="trend-col"><div className="trend-bar" style={{ height: '30px' }}></div><div className="trend-lbl">wk 3</div></div>
        <div className="trend-col"><div className="trend-bar current" style={{ height: '44px' }}></div><div className="trend-lbl">now</div></div>
      </div>
      <div className="trend-delta up">↑ +12 pts over 4 weeks</div>
      <CompetitorRadar />
      <QueryBreakdown />
    </>
  )
}

function GrowthContent() {
  return (
    <>
      <PaidHeader badge="Daily" />
      <ScoreDisplay />
      <PlatformScores />
      <div className="report-divider"></div>
      <div className="report-section-label">30-Day Trend</div>
      <div className="trend-bars">
        <div className="trend-col"><div className="trend-bar" style={{ height: '22px' }}></div><div className="trend-lbl">wk 1</div></div>
        <div className="trend-col"><div className="trend-bar" style={{ height: '30px' }}></div><div className="trend-lbl">wk 2</div></div>
        <div className="trend-col"><div className="trend-bar" style={{ height: '28px' }}></div><div className="trend-lbl">wk 3</div></div>
        <div className="trend-col"><div className="trend-bar" style={{ height: '36px' }}></div><div className="trend-lbl">wk 4</div></div>
        <div className="trend-col"><div className="trend-bar current" style={{ height: '44px' }}></div><div className="trend-lbl">today</div></div>
      </div>
      <div className="trend-delta up">↑ +18 pts over 30 days</div>
      <CompetitorRadar />
      <QueryBreakdown extra />
      <div className="report-divider"></div>
      <div className="report-section-label">Email Digest Preview</div>
      <div className="query-item" style={{ borderColor: 'rgba(240,165,0,.15)' }}>
        <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '.4rem', letterSpacing: '.04em' }}>Weekly summary — March 11, 2026</div>
        <div style={{ fontSize: '.73rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>Score up <span style={{ color: 'var(--green)', fontFamily: "'JetBrains Mono',monospace" }}>+3 pts</span> this week. You moved from #3 → #2 on ChatGPT for your top query. Sweet Things Co. gained ground on Gemini — worth watching.</div>
      </div>
    </>
  )
}

function AgencyContent() {
  return (
    <>
      <div className="report-preview-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <div className="report-biz-name">Maple Street Bakery</div>
            <span className="wl-badge">White-label</span>
          </div>
          <div className="report-date">Daily scan · March 11, 2026</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.72rem', color: 'var(--green)', fontFamily: "'JetBrains Mono',monospace" }}><div className="scan-dot active"></div>Live</div>
      </div>
      <div className="profile-chips">
        <span className="profile-chip active-chip">Maple Street Bakery</span>
        <span className="profile-chip">Harbor Cakes</span>
        <span className="profile-chip">Flour + Co.</span>
        <span className="profile-chip" style={{ color: 'var(--text-dim)' }}>+17 more</span>
      </div>
      <ScoreDisplay />
      <PlatformScores />
      <div className="report-divider"></div>
      <div className="report-section-label">Daily Scan Log</div>
      <div className="daily-log-row">
        <span>Maple Street Bakery</span>
        <span className="log-time">08:00 AM</span>
        <span className="log-change pos">+3 pts</span>
      </div>
      <div className="daily-log-row">
        <span>Harbor Cakes</span>
        <span className="log-time">08:02 AM</span>
        <span className="log-change neg">−1 pt</span>
      </div>
      <div className="daily-log-row">
        <span>Flour + Co.</span>
        <span className="log-time">08:05 AM</span>
        <span className="log-change neutral">no change</span>
      </div>
      <CompetitorRadar />
      <QueryBreakdown />
      <div className="report-divider"></div>
      <div className="report-section-label">API Usage</div>
      <div className="api-usage-row">
        <span className="api-usage-label">Queries used</span>
        <div className="api-usage-bar-wrap"><div className="api-usage-bar" style={{ width: '42%' }}></div></div>
        <span className="api-usage-val">4,200 / 10k</span>
      </div>
      <div className="api-usage-row">
        <span className="api-usage-label">Profiles active</span>
        <div className="api-usage-bar-wrap"><div className="api-usage-bar" style={{ width: '25%' }}></div></div>
        <span className="api-usage-val">5 / 20</span>
      </div>
      <div className="report-divider"></div>
      <div className="report-section-label">Actionable Recommendations</div>
      <div className="rec-item rec-high">
        <div className="rec-priority">High</div>
        <div className="rec-body">
          <div className="rec-title">Boost your Google review count</div>
          <div className="rec-detail">Your competitors have 3× more Google reviews — AI models use review volume as a trust signal. Ask recent customers for a review this week.</div>
        </div>
      </div>
      <div className="rec-item rec-med">
        <div className="rec-priority">Med</div>
        <div className="rec-body">
          <div className="rec-title">Add vegan menu options to your website</div>
          <div className="rec-detail">You're invisible on "bakeries with vegan options" queries. A dedicated menu page could unlock 3 new query matches.</div>
        </div>
      </div>
      <div className="rec-item rec-med">
        <div className="rec-priority">Med</div>
        <div className="rec-body">
          <div className="rec-title">Claim and update your Yelp listing</div>
          <div className="rec-detail">Perplexity surfaces Yelp data heavily. An incomplete listing is hurting your rank on 2 of your top queries.</div>
        </div>
      </div>
    </>
  )
}

// ─── Feature lists per plan ─────────────────────────────

function rpIcon(svgContent: React.ReactNode) {
  return <div className="rp-icon">{svgContent}</div>
}

function FreeFeatures() {
  return (
    <div className="report-points">
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><rect x="1" y="8" width="3" height="13" rx="1" /><rect x="6" y="5" width="3" height="16" rx="1" /><rect x="11" y="2" width="3" height="19" rx="1" /><rect x="16" y="6" width="3" height="15" rx="1" /><rect x="21" y="10" width="3" height="11" rx="1" /></svg>)}
        <div><div className="rp-title">AI Visibility Score</div><div className="rp-desc">A single 0–100 score capturing your AI presence across mention rate, position, and sentiment.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>)}
        <div><div className="rp-title">Per-platform breakdown</div><div className="rp-desc">See exactly what ChatGPT, Claude, Perplexity, and Gemini say about your business — all 4 platforms included.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>)}
        <div><div className="rp-title">Email delivery</div><div className="rp-desc">Your report arrives in your inbox as a formatted snapshot — no dashboard login required.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>)}
        <div><div className="rp-title">One-time snapshot</div><div className="rp-desc">See exactly where you stand today — no credit card required. Upgrade anytime for ongoing monitoring.</div></div>
      </div>
    </div>
  )
}

function StarterFeatures() {
  return (
    <div className="report-points">
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>)}
        <div><div className="rp-title">Historical trend graphs</div><div className="rp-desc">Track your AI visibility score week over week. See what's working — and what's slipping.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" /></svg>)}
        <div><div className="rp-title">Competitor radar</div><div className="rp-desc">Find out which competitors AI recommends instead of you — and see the exact gap to close.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)}
        <div><div className="rp-title">Weekly automated scans</div><div className="rp-desc">Fresh reports every week — no manual runs. Always know where you stand without lifting a finger.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>)}
        <div><div className="rp-title">Query-by-query breakdown</div><div className="rp-desc">See mention rank, sentiment, and AI responses for every query you're tracking.</div></div>
      </div>
    </div>
  )
}

function GrowthFeatures() {
  return (
    <div className="report-points">
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>)}
        <div><div className="rp-title">Daily automated scans</div><div className="rp-desc">Catch ranking changes the same day they happen — not a week later. Stay ahead of competitors as AI models update.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>)}
        <div><div className="rp-title">30-day trend graphs</div><div className="rp-desc">Track your score day by day. See exactly when something changed — and what might have caused it.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" /></svg>)}
        <div><div className="rp-title">Competitor radar</div><div className="rp-desc">15 queries tracked across all 4 AI platforms — see who's stealing your recommendations and by how much.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>)}
        <div><div className="rp-title">Email digest reports</div><div className="rp-desc">Weekly summaries delivered to your inbox. Know your score, movement, and top changes without logging in.</div></div>
      </div>
    </div>
  )
}

function AgencyFeatures() {
  return (
    <div className="report-points">
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>)}
        <div><div className="rp-title">Up to 20 client profiles</div><div className="rp-desc">Monitor multiple businesses from one dashboard. Perfect for marketing agencies and consultants.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>)}
        <div><div className="rp-title">Daily scans</div><div className="rp-desc">Catch changes in AI recommendations the day they happen. Ideal for fast-moving competitive landscapes.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>)}
        <div><div className="rp-title">White-label PDF reports</div><div className="rp-desc">Send branded reports to clients under your agency's name. Your logo, your domain, your value.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>)}
        <div><div className="rp-title">Actionable recommendations engine</div><div className="rp-desc">"Your competitors have 3× more Google reviews — here's how to fix that." AI-generated steps tied directly to what's costing you rankings.</div></div>
      </div>
      <div className="report-point">
        {rpIcon(<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>)}
        <div><div className="rp-title">API access</div><div className="rp-desc">Pull visibility data directly into your existing tools, dashboards, or client reporting workflows.</div></div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────

interface ReportPreviewProps {
  onScrollToForm: () => void
}

export function ReportPreview({ onScrollToForm }: ReportPreviewProps) {
  const [activePlan, setActivePlan] = useState<Plan>('free')
  const previewRef = useRef<HTMLDivElement>(null)

  function switchPlan(plan: Plan) {
    setActivePlan(plan)
    // Scroll the preview card back to top
    previewRef.current?.scrollTo({ top: 0 })
  }

  const plans: { key: Plan; label: string; price?: string }[] = [
    { key: 'free', label: 'Free' },
    { key: 'starter', label: 'Starter', price: '$29/mo' },
    { key: 'growth', label: 'Growth', price: '$49/mo' },
    { key: 'agency', label: 'Agency', price: '$149/mo' },
  ]

  const contentMap: Record<Plan, React.ReactNode> = {
    free: <FreeContent />,
    starter: <StarterContent />,
    growth: <GrowthContent />,
    agency: <AgencyContent />,
  }

  const featureMap: Record<Plan, React.ReactNode> = {
    free: <FreeFeatures />,
    starter: <StarterFeatures />,
    growth: <GrowthFeatures />,
    agency: <AgencyFeatures />,
  }

  return (
    <section className="report-section" id="report">
      <div className="container">
        <div className="section-label">Sample report</div>
        <h2>What you'll receive.</h2>

        <div className="plan-tabs">
          {plans.map(p => (
            <button
              key={p.key}
              className={`plan-tab${activePlan === p.key ? ' active' : ''}`}
              onClick={() => switchPlan(p.key)}
            >
              {p.label}
              {p.price && <span className="plan-price">{p.price}</span>}
            </button>
          ))}
        </div>

        <div className="report-grid">
          <div className="report-preview" ref={previewRef}>
            {contentMap[activePlan]}

            {/* Blur overlay: free plan only */}
            {activePlan === 'free' && (
              <div className="report-blur-mask">
                <button className="unlock-btn" onClick={onScrollToForm}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
                  Get your full report →
                </button>
              </div>
            )}
          </div>

          <div>
            {featureMap[activePlan]}
          </div>
        </div>
      </div>
    </section>
  )
}
