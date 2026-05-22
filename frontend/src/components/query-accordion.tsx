import { useState } from 'react'
import { Link } from 'react-router-dom'

// Shared types — must match the shape used by the dashboard's ScanData.
interface Citation {
  uri: string
  title: string | null
}

interface PlatformResult {
  mentioned: boolean
  mention_position: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  competitors_mentioned: string[]
  variant_used: string | null
  citations: Citation[] | null
  raw_response: string | null
  scores: { mention: number; position: number; sentiment: number; total: number; max: number }
}

// Per Google's Grounding ToS, each platform's citation strip must say where
// the sources came from. OpenAI's docs also require inline citations be
// "clearly visible and clickable" when web_search is used. Claude grounding
// will land here later with its own attribution.
const CITATION_ATTRIBUTION: Record<string, string> = {
  gemini: 'Sources via Google Search',
  openai: 'Sources cited by ChatGPT',
}

function hostFromUri(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '')
  } catch {
    return uri
  }
}

export interface QueryResultLike {
  query_id: string
  query_text: string
  source?: 'generated' | 'custom'
  intent?: string | null
  generation_reason?: string | null
  platforms: Record<string, PlatformResult>
}

interface QueryAccordionProps {
  result: QueryResultLike
  index: number
  platforms: string[]
  defaultOpen?: boolean
  glowWrapped?: boolean
  isFreeScan?: boolean
}

const PLATFORM_LABELS: Record<string, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
}

const PLATFORM_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97706',
  gemini: '#4285f4',
  perplexity: '#7c3aed',
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--accent)'
  return 'var(--red)'
}

function sentimentIcon(sentiment: string | null) {
  if (sentiment === 'positive') return { symbol: '↑', color: 'var(--green)' }
  if (sentiment === 'negative') return { symbol: '↓', color: 'var(--red)' }
  return { symbol: '→', color: 'var(--text-muted)' }
}

// Collapsed by default. Tap header to expand. Shows full per-platform
// breakdown, score math, and competitors only when expanded — this is the
// replacement for the old QueryRow + separate "Query Breakdown" section.
export function QueryAccordion({ result, index, platforms, defaultOpen = false, glowWrapped = false, isFreeScan = false }: QueryAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const componentScore = (key: 'mention' | 'position' | 'sentiment') =>
    platforms.reduce((sum, p) => sum + (result.platforms[p]?.scores[key] ?? 0), 0)
  const mentionPts = componentScore('mention')
  const positionPts = componentScore('position')
  const sentimentPts = componentScore('sentiment')
  const totalScore = mentionPts + positionPts + sentimentPts
  const maxScore = platforms.length * 18
  const anyMentioned = platforms.some(p => result.platforms[p]?.mentioned)
  const mentionsCount = platforms.filter(p => result.platforms[p]?.mentioned).length
  const competitors = Array.from(
    new Set(platforms.flatMap(p => result.platforms[p]?.competitors_mentioned ?? []))
  )
  const bestPos = platforms.reduce<number | null>((best, p) => {
    const pos = result.platforms[p]?.mention_position
    if (pos == null) return best
    return best == null || pos < best ? pos : best
  }, null)
  const dotColor = anyMentioned
    ? scoreColor(maxScore > 0 ? (totalScore / maxScore) * 100 : 0)
    : 'var(--text-dim)'

  return (
    <div
      style={{
        ...styles.row,
        ...(glowWrapped ? { border: 'none', background: 'transparent', borderRadius: 0 } : {}),
        animation: `fadeUp 0.35s cubic-bezier(.22,1,.36,1) ${Math.min(index, 12) * 0.04}s both`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={styles.header}
        aria-expanded={open}
      >
        <span style={styles.dot} aria-hidden>
          <span style={{ ...styles.dotInner, background: dotColor }} />
        </span>

        <p style={styles.text}>{result.query_text}</p>

        <div style={styles.summary}>
          <span style={styles.summaryMentions}>
            <span style={styles.summaryMentionsNum}>{mentionsCount}</span>
            <span style={styles.summaryMentionsLabel}>
              /{platforms.length} mentioned
            </span>
          </span>
          {bestPos != null && (
            <span style={styles.summaryBest}>#{bestPos}</span>
          )}
          <span
            style={{
              ...styles.summaryScore,
              color: dotColor,
            }}
          >
            {totalScore}
            <span style={styles.summaryScoreUnit}>pts</span>
          </span>
          <span style={{ ...styles.chevron, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        </div>
      </button>

      {open && (
        <div style={styles.body}>
          <div style={styles.platforms}>
            {platforms.map(platform => {
              const pr = result.platforms[platform]
              const label = PLATFORM_LABELS[platform] ?? platform
              const color = PLATFORM_COLORS[platform] ?? 'var(--text-muted)'
              const mentioned = !!pr?.mentioned
              const { symbol, color: sentColor } = sentimentIcon(pr?.sentiment ?? null)
              return (
                <div
                  key={platform}
                  style={{
                    ...styles.platformBadge,
                    background: mentioned ? 'rgba(255,255,255,0.025)' : 'transparent',
                    borderColor: mentioned ? color + '50' : 'var(--border-dim)',
                    opacity: mentioned ? 1 : 0.55,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: mentioned ? color : 'var(--text-dim)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={styles.platformLabel}>{label}</span>
                  {mentioned && pr?.mention_position && (
                    <span style={styles.platformPos}>#{pr.mention_position}</span>
                  )}
                  {mentioned && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: sentColor,
                      }}
                    >
                      {symbol}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {(() => {
            const variants = platforms
              .filter(p => result.platforms[p]?.mentioned && result.platforms[p]?.variant_used)
              .map(p => ({ platform: p, variant: result.platforms[p]!.variant_used! }))
            return variants.length > 0 ? (
              <div style={styles.variants}>
                <span style={styles.scoreMathLabel}>AI referred to this business as</span>
                <div style={styles.variantList}>
                  {variants.map(({ platform, variant }) => (
                    <span key={platform} style={styles.variantItem}>
                      <span style={{ color: PLATFORM_COLORS[platform] ?? 'var(--text-muted)', fontSize: '0.55rem' }}>●</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{PLATFORM_LABELS[platform] ?? platform}:</span>
                      <span style={{ fontStyle: 'italic' }}>"{variant}"</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {(() => {
            const platformsWithCitations = platforms
              .map(p => ({
                platform: p,
                citations: result.platforms[p]?.citations ?? null,
              }))
              .filter(({ citations }) => Array.isArray(citations) && citations.length > 0) as {
              platform: string
              citations: Citation[]
            }[]
            if (platformsWithCitations.length === 0) return null
            return (
              <div style={styles.sources}>
                {platformsWithCitations.map(({ platform, citations }) => (
                  <div key={platform} style={styles.sourcesGroup}>
                    <span style={styles.scoreMathLabel}>
                      {CITATION_ATTRIBUTION[platform] ?? `Sources cited by ${PLATFORM_LABELS[platform] ?? platform}`}
                    </span>
                    <div style={styles.sourcesList}>
                      {citations.slice(0, 8).map(c => (
                        <a
                          key={c.uri}
                          href={c.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.sourceLink}
                          title={c.title ?? c.uri}
                        >
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: PLATFORM_COLORS[platform] ?? 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          />
                          <span style={styles.sourceHost}>{hostFromUri(c.uri)}</span>
                          {c.title && (
                            <span style={styles.sourceTitle}>{c.title}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {anyMentioned && (
            <div style={styles.scoreMath}>
              <span style={styles.scoreMathLabel}>How this query scored</span>
              <div style={styles.scoreMathRow}>
                <span style={styles.scoreMathItem}>
                  <span style={styles.scoreMathNum}>{mentionPts}</span> mention
                </span>
                <span style={styles.scoreMathPlus}>+</span>
                <span style={styles.scoreMathItem}>
                  <span style={styles.scoreMathNum}>{positionPts}</span> position
                </span>
                <span style={styles.scoreMathPlus}>+</span>
                <span style={styles.scoreMathItem}>
                  <span
                    style={{
                      ...styles.scoreMathNum,
                      color: sentimentPts < 0 ? 'var(--red)' : undefined,
                    }}
                  >
                    {sentimentPts < 0 ? `−${Math.abs(sentimentPts)}` : sentimentPts}
                  </span>{' '}
                  sentiment
                </span>
                <span style={styles.scoreMathEq}>=</span>
                <span
                  style={{
                    ...styles.scoreMathTotal,
                    color: dotColor,
                  }}
                >
                  {totalScore}/{maxScore}
                </span>
              </div>
            </div>
          )}

          {competitors.length > 0 && !isFreeScan && (
            <div style={styles.competitors}>
              <span style={styles.scoreMathLabel}>Mentioned alongside</span>
              <div style={styles.competitorChips}>
                {competitors.map(c => (
                  <span key={c} style={styles.competitorChip}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {competitors.length > 0 && isFreeScan && (
            <div style={styles.competitors}>
              <span style={styles.scoreMathLabel}>Mentioned alongside</span>
              <div style={styles.competitorChipsLocked}>
                {/* Blurred placeholder pills — count matches real data so the
                    user knows exactly how many competitors were found */}
                {competitors.slice(0, 5).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      ...styles.competitorChipBlurred,
                      width: ['72px', '108px', '88px', '64px', '96px'][i % 5],
                    }}
                  />
                ))}
                {competitors.length > 5 && (
                  <span aria-hidden style={{ ...styles.competitorChipBlurred, width: '52px' }} />
                )}
              </div>
              <Link to="/pricing" style={styles.competitorGate}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} analyzed · Upgrade to see who →
              </Link>
            </div>
          )}

          {!anyMentioned && (
            <p style={styles.noMentions}>
              No AI platform named this business for this query. That's a
              meaningful gap — the best lever here is matching the exact
              language a customer would use to ask.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, background 0.2s ease',
  },
  header: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '1rem',
    alignItems: 'center',
    padding: '1.1rem 1.4rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
    textAlign: 'left',
    color: 'var(--text)',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'transparent',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotInner: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  text: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.4,
    color: 'var(--text)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexShrink: 0,
  },
  summaryMentions: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.15rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  summaryMentionsNum: {
    color: 'var(--text)',
    fontWeight: 700,
  },
  summaryMentionsLabel: {
    color: 'var(--text-dim)',
  },
  summaryBest: {
    padding: '0.15rem 0.4rem',
    background: 'rgba(240,165,0,0.06)',
    border: '1px solid rgba(240,165,0,0.22)',
    borderRadius: '99px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.68rem',
    color: 'var(--accent)',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  summaryScore: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.95rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  summaryScoreUnit: {
    fontSize: '0.65rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
    marginLeft: '0.2rem',
  },
  chevron: {
    fontSize: '1.05rem',
    color: 'var(--text-dim)',
    transition: 'transform 0.2s cubic-bezier(.22,1,.36,1)',
    width: '14px',
    textAlign: 'center',
    display: 'inline-block',
  },
  body: {
    padding: '0.5rem 1.4rem 1.4rem',
    borderTop: '1px solid var(--border-dim)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    animation: 'fadeUp 0.25s cubic-bezier(.22,1,.36,1) both',
  },
  platforms: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.85rem',
  },
  platformBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.65rem',
    border: '1px solid',
    borderRadius: '99px',
    transition: 'border-color 0.15s, opacity 0.15s, background 0.15s',
  },
  platformLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  platformPos: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  scoreMath: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  scoreMathLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  scoreMathRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    flexWrap: 'wrap',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  scoreMathItem: {
    display: 'inline-flex',
    gap: '0.3rem',
    alignItems: 'baseline',
  },
  scoreMathNum: {
    color: 'var(--text)',
    fontWeight: 700,
  },
  scoreMathPlus: {
    color: 'var(--text-dim)',
  },
  scoreMathEq: {
    color: 'var(--text-dim)',
    marginLeft: '0.25rem',
  },
  scoreMathTotal: {
    fontWeight: 700,
  },
  competitors: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  competitorChips: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  competitorChip: {
    display: 'inline-flex',
    padding: '0.25rem 0.55rem',
    background: 'rgba(148,163,184,0.08)',
    border: '1px solid var(--border)',
    borderRadius: '99px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  // Locked competitor UI (free scan)
  competitorChipsLocked: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap' as const,
    marginBottom: '0.6rem',
  },
  competitorChipBlurred: {
    display: 'inline-block',
    height: '26px',
    background: 'rgba(148,163,184,0.12)',
    border: '1px solid var(--border)',
    borderRadius: '99px',
    filter: 'blur(5px)',
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
    flexShrink: 0,
  },
  competitorGate: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginTop: '0.1rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--accent)',
    textDecoration: 'none',
    letterSpacing: '0.01em',
    opacity: 0.9,
    transition: 'opacity 0.15s',
  },
  noMentions: {
    margin: 0,
    fontSize: '0.85rem',
    lineHeight: 1.55,
    color: 'var(--text-muted)',
  },
  variants: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.45rem',
  },
  variantList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
  },
  variantItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  sources: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.65rem',
  },
  sourcesGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  sourcesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  sourceLink: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.45rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(255,255,255,0.018)',
    border: '1px solid var(--border-dim)',
    borderRadius: '6px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'border-color 0.15s, background 0.15s',
    overflow: 'hidden',
  },
  sourceHost: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.74rem',
    color: 'var(--text)',
    fontWeight: 600,
    flexShrink: 0,
  },
  sourceTitle: {
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
}
