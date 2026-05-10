import type { TrendQueryPoint } from '../lib/api'

const SPARK_W = 120
const SPARK_H = 24

interface QueryTrendRowProps {
  query_text: string
  points: TrendQueryPoint[]
}

export function QueryTrendRow({ query_text, points }: QueryTrendRowProps) {
  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null

  const latestScore = latest?.total_score ?? 0
  const prevScore = previous?.total_score ?? null
  const delta = prevScore != null ? latestScore - prevScore : null

  // Bars: one per scan. Fill height = total_score / 18, color by mentioned.
  const barW = SPARK_W / Math.max(points.length, 1)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: '1rem',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-dim)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          "{query_text}"
        </p>
      </div>

      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" style={{ width: SPARK_W, height: SPARK_H, flexShrink: 0 }}>
        {points.map((p, i) => {
          const h = (Math.max(0, p.total_score) / 18) * SPARK_H
          const color = p.mentioned ? 'var(--accent)' : 'var(--border)'
          return (
            <rect
              key={i}
              x={i * barW + 1}
              y={SPARK_H - h}
              width={Math.max(2, barW - 2)}
              height={h || 1}
              fill={color}
              opacity={p.mentioned ? 0.85 : 0.5}
            />
          )
        })}
      </svg>

      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          minWidth: '60px',
          textAlign: 'right',
        }}
      >
        {latest?.mentioned
          ? latest.mention_position
            ? `#${latest.mention_position}`
            : 'mentioned'
          : 'not mentioned'}
      </span>

      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          minWidth: '50px',
          textAlign: 'right',
          color:
            delta == null
              ? 'var(--text-dim)'
              : delta > 0
              ? 'var(--green)'
              : delta < 0
              ? 'var(--red)'
              : 'var(--text-muted)',
        }}
      >
        {delta == null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${delta}`}
      </span>
    </div>
  )
}
