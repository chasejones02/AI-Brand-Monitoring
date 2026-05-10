interface ScanSummary {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  triggered_by: string
  started_at: string
  completed_at: string | null
}

interface ScanHistoryListProps {
  scans: ScanSummary[]
  activeScanId: string | null
  onSelect: (id: string) => void
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--accent)'
  return 'var(--red)'
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ScanHistoryList({ scans, activeScanId, onSelect }: ScanHistoryListProps) {
  if (scans.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      {scans.map((scan, i) => {
        const isActive = scan.id === activeScanId
        const score = scan.visibility_score ?? 0
        const color = scoreColor(score)

        return (
          <button
            key={scan.id}
            onClick={() => onSelect(scan.id)}
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '1rem',
              alignItems: 'center',
              padding: '0.85rem 1.1rem',
              background: isActive ? 'rgba(201,143,10,0.08)' : 'transparent',
              border: 'none',
              borderBottom: i < scans.length - 1 ? '1px solid var(--border-dim)' : 'none',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
          >
            {/* Score puck */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `2px solid ${scan.status === 'completed' ? color : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: '0.85rem',
                color: scan.status === 'completed' ? color : 'var(--text-dim)',
                flexShrink: 0,
              }}
            >
              {scan.status === 'completed' ? Math.round(score) : '—'}
            </div>

            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 }}>
                {formatDateTime(scan.started_at)}
              </p>
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {scan.status === 'completed' && 'Completed'}
                {scan.status === 'failed' && 'Failed'}
                {(scan.status === 'pending' || scan.status === 'running') && 'Running…'}
                {scan.triggered_by !== 'manual' && ` · ${scan.triggered_by}`}
              </p>
            </div>

            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {isActive ? 'Viewing' : 'View →'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
