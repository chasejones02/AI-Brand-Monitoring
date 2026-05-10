import type { BusinessTrends } from '../lib/api'
import { PlatformSparkline } from './platform-sparkline'
import { QueryTrendRow } from './query-trend-row'
import { ScanHistoryList } from './scan-history-list'

interface ScanSummary {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  visibility_score: number | null
  triggered_by: string
  started_at: string
  completed_at: string | null
}

interface HistoryTrendsSectionProps {
  trends: BusinessTrends | null
  trendsLoading: boolean
  trendsError: string
  scanHistory: ScanSummary[]
  activeScanId: string | null
  onScanSelect: (id: string) => void
}

const PLATFORM_ORDER = ['perplexity', 'openai', 'anthropic', 'gemini']

export function HistoryTrendsSection({
  trends,
  trendsLoading,
  trendsError,
  scanHistory,
  activeScanId,
  onScanSelect,
}: HistoryTrendsSectionProps) {
  if (trendsLoading && !trends) {
    return (
      <div style={sectionShellStyle}>
        <SectionHeader />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading history…</div>
      </div>
    )
  }

  if (trendsError) {
    return (
      <div style={sectionShellStyle}>
        <SectionHeader />
        <div style={{ color: 'var(--red)', fontSize: '0.85rem' }}>
          Couldn't load history: {trendsError}
        </div>
      </div>
    )
  }

  if (!trends || trends.scans.length === 0) {
    return null
  }

  // Order platforms consistently and only render those with data.
  const platforms = PLATFORM_ORDER.filter(p => trends.by_platform[p]?.length > 0)

  return (
    <div style={sectionShellStyle}>
      <SectionHeader />

      {platforms.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {platforms.map(p => (
            <PlatformSparkline key={p} platform={p} points={trends.by_platform[p]} />
          ))}
        </div>
      )}

      {trends.by_query.length > 0 && trends.scans.length >= 2 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '1rem',
              padding: '0.65rem 1rem',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span>Query</span>
            <span style={{ width: 120, textAlign: 'left' }}>Trend</span>
            <span style={{ minWidth: 60, textAlign: 'right' }}>Latest</span>
            <span style={{ minWidth: 50, textAlign: 'right' }}>Δ</span>
          </div>
          {trends.by_query.map(q => (
            <QueryTrendRow key={q.query_id} query_text={q.query_text} points={q.points} />
          ))}
        </div>
      )}

      <div>
        <p
          style={{
            margin: '0 0 0.6rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          All scans
        </p>
        <ScanHistoryList scans={scanHistory} activeScanId={activeScanId} onSelect={onScanSelect} />
      </div>
    </div>
  )
}

function SectionHeader() {
  return (
    <div>
      <h2
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '1.4rem',
          fontWeight: 400,
          color: 'var(--text)',
          margin: '0 0 0.3rem',
        }}
      >
        History &amp; Trends
      </h2>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Your visibility over the last {30} scans.
      </p>
    </div>
  )
}

const sectionShellStyle: React.CSSProperties = {
  marginTop: '3rem',
  paddingTop: '2.5rem',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
}
