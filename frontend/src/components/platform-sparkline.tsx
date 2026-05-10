import type { TrendPlatformPoint } from '../lib/api'

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

const SPARK_W = 160
const SPARK_H = 32

interface PlatformSparklineProps {
  platform: string
  points: TrendPlatformPoint[]
}

export function PlatformSparkline({ platform, points }: PlatformSparklineProps) {
  const label = PLATFORM_LABELS[platform] ?? platform
  const color = PLATFORM_COLORS[platform] ?? 'var(--accent)'
  const latest = points[points.length - 1]?.score ?? 0
  const previous = points.length > 1 ? points[points.length - 2].score : null
  const delta = previous != null ? latest - previous : null

  const path =
    points.length > 1
      ? points
          .map((p, i) => {
            const x = (i / (points.length - 1)) * SPARK_W
            const y = SPARK_H - (Math.max(0, Math.min(100, p.score)) / 100) * SPARK_H
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
          })
          .join(' ')
      : null

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          {Math.round(latest)}
        </span>
        {delta != null && Math.abs(delta) >= 1 && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: delta > 0 ? 'var(--green)' : 'var(--red)',
            }}
          >
            {delta > 0 ? '↑' : '↓'}
            {Math.abs(Math.round(delta))}
          </span>
        )}
      </div>
      {path ? (
        <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" style={{ width: '100%', height: 32 }}>
          <path
            d={`${path} L ${SPARK_W} ${SPARK_H} L 0 ${SPARK_H} Z`}
            fill={color}
            opacity="0.15"
          />
          <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-dim)',
            fontSize: '0.72rem',
          }}
        >
          Need more scans
        </div>
      )}
    </div>
  )
}
