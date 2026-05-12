import { Link } from 'react-router-dom'
import type { Recommendation } from '../pages/dashboard'

const PLATFORM_LABELS: Record<string, string> = {
  all: 'All platforms',
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
}

const PLATFORM_COLORS: Record<string, string> = {
  all: 'var(--text-dim)',
  perplexity: '#7c3aed',
  openai: '#10a37f',
  anthropic: '#d97706',
  gemini: '#4285f4',
}

const IMPACT_CONFIG = {
  high: { label: 'High impact', color: 'var(--red)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  medium: { label: 'Medium', color: 'var(--accent)', bg: 'rgba(240,165,0,0.08)', border: 'rgba(240,165,0,0.2)' },
  low: { label: 'Low', color: 'var(--green)', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
}

const TIER_LABELS: Record<string, { next: string; plan: string }> = {
  free: { next: 'Starter', plan: 'starter' },
  starter: { next: 'Growth', plan: 'growth' },
  growth: { next: '', plan: '' },
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  tier: string
}

export function RecommendationsPanel({ recommendations, tier }: RecommendationsPanelProps) {
  const unlocked = recommendations.filter(r => !r.locked)
  const locked = recommendations.filter(r => r.locked)
  const { next } = TIER_LABELS[tier] ?? TIER_LABELS['free']

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.eyebrow}>Recommendations</span>
          <h2 style={s.title}>What to fix next</h2>
        </div>
        <div style={s.headerRight}>
          <span style={s.countBadge}>
            {unlocked.length} of {recommendations.length} unlocked
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={s.list}>
        {recommendations.map((rec, i) => {
          const impact = IMPACT_CONFIG[rec.impact] ?? IMPACT_CONFIG.medium
          const platformColor = PLATFORM_COLORS[rec.platform] ?? PLATFORM_COLORS.all
          const isLocked = !!rec.locked

          return (
            <div
              key={rec.priority}
              style={{
                ...s.card,
                opacity: isLocked ? 0.75 : 1,
                borderColor: isLocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                animation: `fadeUp 0.3s cubic-bezier(.22,1,.36,1) ${Math.min(i, 6) * 0.06}s both`,
              }}
            >
              {/* Left accent bar */}
              <div style={{ ...s.accentBar, background: isLocked ? 'rgba(255,255,255,0.06)' : impact.color }} />

              <div style={s.cardBody}>
                <div style={s.cardMeta}>
                  <span style={{ ...s.impactChip, color: impact.color, background: impact.bg, borderColor: impact.border }}>
                    {impact.label}
                  </span>
                  <span style={s.platformChip}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: platformColor, display: 'inline-block', flexShrink: 0 }} />
                    {PLATFORM_LABELS[rec.platform] ?? rec.platform}
                  </span>
                  <span style={s.priorityNum}>#{rec.priority}</span>
                </div>

                <p style={{ ...s.cardTitle, color: isLocked ? 'var(--text-muted)' : 'var(--text)' }}>
                  {isLocked && (
                    <svg width="11" height="12" viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginRight: '0.4rem', flexShrink: 0, display: 'inline', verticalAlign: 'middle', opacity: 0.5 }}>
                      <rect x="1" y="5.5" width="9" height="6" rx="1.5" />
                      <path d="M3 5.5V3.5a2.5 2.5 0 015 0v2" />
                    </svg>
                  )}
                  {rec.title}
                </p>

                {isLocked ? (
                  <div style={s.lockedBody}>
                    <div style={s.blurLines}>
                      <div style={{ ...s.blurLine, width: '92%' }} />
                      <div style={{ ...s.blurLine, width: '78%' }} />
                      <div style={{ ...s.blurLine, width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <p style={s.cardDesc}>{rec.body}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Upgrade CTA — only shown when there are locked recs */}
      {locked.length > 0 && next && (
        <div style={s.upgradeBar}>
          <div style={s.upgradeLeft}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={s.upgradeText}>
              {locked.length} more recommendation{locked.length !== 1 ? 's' : ''} unlocked on {next}
            </span>
          </div>
          <Link to={`/pricing`} style={s.upgradeBtn}>
            Upgrade to {next} →
          </Link>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    marginBottom: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  headerRight: {
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  title: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  countBadge: {
    fontSize: '0.72rem',
    color: 'var(--text-dim)',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '99px',
    padding: '0.25rem 0.65rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.6rem',
  },
  card: {
    display: 'flex',
    background: 'var(--surface)',
    border: '1px solid',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, opacity 0.2s ease',
  },
  accentBar: {
    width: '3px',
    flexShrink: 0,
    transition: 'background 0.2s ease',
  },
  cardBody: {
    flex: 1,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  impactChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid',
    fontFamily: "'JetBrains Mono', monospace",
  },
  platformChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '99px',
    padding: '0.18rem 0.55rem',
  },
  priorityNum: {
    marginLeft: 'auto',
    fontSize: '0.65rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-dim)',
    letterSpacing: '0.06em',
  },
  cardTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
    display: 'flex',
    alignItems: 'center',
  },
  cardDesc: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    lineHeight: 1.65,
  },
  lockedBody: {
    padding: '0.25rem 0',
  },
  blurLines: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.45rem',
  },
  blurLine: {
    height: '10px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    filter: 'blur(3px)',
  },
  upgradeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginTop: '0.75rem',
    padding: '0.85rem 1.25rem',
    background: 'rgba(240,165,0,0.04)',
    border: '1px solid rgba(240,165,0,0.15)',
    borderRadius: '10px',
  },
  upgradeLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  upgradeText: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  upgradeBtn: {
    flexShrink: 0,
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--accent)',
    textDecoration: 'none',
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.02em',
    transition: 'opacity 0.2s',
  },
}
