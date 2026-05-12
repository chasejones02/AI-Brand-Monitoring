import { useState } from 'react'
import type { TrendScanPoint } from '../lib/api'

interface TrendChartProps {
  scans: TrendScanPoint[]
  height?: number
  /** Optional label rendered as the chart's section title (default "Visibility trend"). */
  title?: string
}

const W = 800
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 }

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--accent)'
  return 'var(--red)'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TrendChart({ scans, height = 220, title = 'Visibility trend' }: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (scans.length < 2) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        Run another scan on this set to see its visibility trend over time.
      </div>
    )
  }

  const innerW = W - PADDING.left - PADDING.right
  const innerH = height - PADDING.top - PADDING.bottom
  const points = scans.map((s, i) => {
    const score = s.visibility_score ?? 0
    const x = PADDING.left + (i / Math.max(1, scans.length - 1)) * innerW
    const y = PADDING.top + innerH - (score / 100) * innerH
    return { x, y, score, scan: s }
  })

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const latestScore = points[points.length - 1].score
  const lineColor = scoreColor(latestScore)

  const gridLines = [0, 25, 50, 75, 100]
  const active = hoverIdx != null ? points[hoverIdx] : null

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.5rem',
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          {title}
        </span>
        {active && (
          <span
            style={{
              fontSize: '0.78rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-muted)',
            }}
          >
            {formatDate(active.scan.completed_at ?? active.scan.started_at)}
            {' · '}
            <span style={{ color: scoreColor(active.score), fontWeight: 700 }}>
              {Math.round(active.score)}
            </span>
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {gridLines.map(g => {
          const y = PADDING.top + innerH - (g / 100) * innerH
          return (
            <g key={g}>
              <line
                x1={PADDING.left}
                x2={W - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--border-dim)"
                strokeDasharray="2 4"
              />
              <text
                x={PADDING.left - 6}
                y={y + 3}
                fontSize="9"
                fill="var(--text-dim)"
                textAnchor="end"
                fontFamily="'JetBrains Mono', monospace"
              >
                {g}
              </text>
            </g>
          )
        })}

        <path
          d={`${path} L ${points[points.length - 1].x} ${PADDING.top + innerH} L ${points[0].x} ${PADDING.top + innerH} Z`}
          fill={lineColor}
          opacity="0.08"
        />

        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${lineColor}80)` }}
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 5 : 3}
              fill={scoreColor(p.score)}
              stroke="var(--bg)"
              strokeWidth="2"
              style={{ transition: 'r 0.15s' }}
            />
            <rect
              x={p.x - 18}
              y={PADDING.top}
              width="36"
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        ))}

        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map(i => (
            <text
              key={`x-${i}`}
              x={points[i].x}
              y={height - 8}
              fontSize="9"
              fill="var(--text-dim)"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {formatDate(points[i].scan.completed_at ?? points[i].scan.started_at)}
            </text>
          ))}
      </svg>
    </div>
  )
}
