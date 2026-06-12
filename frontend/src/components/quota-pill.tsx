import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { QuotaStatus } from '../lib/api'

interface QuotaPillProps {
  quota: QuotaStatus | null
}

function formatCountdown(target: string | null): string | null {
  if (!target) return null
  const ms = new Date(target).getTime() - Date.now()
  if (ms <= 0) return null
  const totalMin = Math.floor(ms / 60000)
  const days = Math.floor(totalMin / (60 * 24))
  if (days >= 1) return `${days}d`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function QuotaPill({ quota }: QuotaPillProps) {
  const [, force] = useState(0)

  // Re-render every 30s so the countdown stays fresh.
  useEffect(() => {
    if (!quota?.next_reset_at) return
    const t = setInterval(() => force(c => c + 1), 30_000)
    return () => clearInterval(t)
  }, [quota?.next_reset_at])

  if (!quota) return null

  const exhausted = quota.remaining <= 0
  const isFree = quota.tier === 'free'
  const countdown = formatCountdown(quota.next_reset_at)

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.45rem 0.85rem',
    border: '1px solid',
    borderColor: exhausted ? 'rgba(239,68,68,0.4)' : 'var(--border)',
    background: exhausted ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontFamily: "'JetBrains Mono', monospace",
    color: exhausted ? 'var(--red)' : 'var(--text)',
    whiteSpace: 'nowrap',
  }

  if (isFree) {
    return (
      <div style={baseStyle}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: exhausted ? 'var(--red)' : 'var(--green)',
            flexShrink: 0,
          }}
        />
        {exhausted ? (
          <>
            <span>Free scan used</span>
            <Link
              to="/pricing"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: '0.25rem',
              }}
            >
              Upgrade →
            </Link>
          </>
        ) : (
          <span>Free scan available</span>
        )}
      </div>
    )
  }

  return (
    <div style={baseStyle} title={countdown ? `Next scan frees up in ${countdown}` : undefined}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: exhausted ? 'var(--red)' : 'var(--green)',
          flexShrink: 0,
        }}
      />
      <span>
        {quota.used_in_window}/{quota.daily_limit} scans · this month
      </span>
      {exhausted && countdown && (
        <span style={{ color: 'var(--text-muted)' }}>· next in {countdown}</span>
      )}
    </div>
  )
}
