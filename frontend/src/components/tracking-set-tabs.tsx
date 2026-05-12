import { useState, useRef, useEffect } from 'react'
import type { TrackingSet } from '../lib/api'

interface TrackingSetTabsProps {
  sets: TrackingSet[]
  activeSetId: string | null
  maxSets: number
  canCreateMore: boolean
  tier: string
  onSelect: (setId: string) => void
  onAddSet: () => void
  onRename: (setId: string, name: string) => Promise<void>
  onDeleteRequest: (setId: string) => void
}

// Editorial set switcher. Sits as a horizontal strip above the score card.
// Each tab carries a slot-numbered "S1/S2/S3" eyebrow + the user's set name,
// plus a small lock chip for any set currently inside its 30-day window.
// Double-click the name to rename inline.
export function TrackingSetTabs({
  sets,
  activeSetId,
  maxSets,
  canCreateMore,
  tier,
  onSelect,
  onAddSet,
  onRename,
  onDeleteRequest,
}: TrackingSetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  function beginRename(set: TrackingSet) {
    setEditingId(set.id)
    setDraftName(set.name)
  }

  async function commitRename(setId: string) {
    const trimmed = draftName.trim()
    setEditingId(null)
    const current = sets.find(s => s.id === setId)
    if (!trimmed || !current || trimmed === current.name) return
    try {
      await onRename(setId, trimmed)
    } catch {
      // Surface via parent's error handling; tab keeps prior name on screen.
    }
  }

  function cancelRename() {
    setEditingId(null)
    setDraftName('')
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.eyebrow}>
        <span style={styles.eyebrowLabel}>Tracking sets</span>
        <span style={styles.eyebrowMeta}>
          {sets.length} of {maxSets} · {tier}
        </span>
      </div>

      <div style={styles.tabRow}>
        {sets.map(set => {
          const isActive = set.id === activeSetId
          const isEditing = editingId === set.id
          return (
            <div
              key={set.id}
              style={{
                ...styles.tab,
                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                background: isActive
                  ? 'rgba(240, 165, 0, 0.06)'
                  : 'var(--surface)',
              }}
              onClick={() => !isEditing && onSelect(set.id)}
            >
              <div style={styles.tabHeader}>
                <span
                  style={{
                    ...styles.slot,
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  }}
                >
                  S{set.slot_number}
                </span>
                {set.is_locked && (
                  <span style={styles.lockChip} title={`Editable in ${set.days_until_unlock} ${set.days_until_unlock === 1 ? 'day' : 'days'}`}>
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                      <path
                        d="M2 5V3a2.5 2.5 0 015 0v2m-6 0h7v5H1V5z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {set.days_until_unlock}d
                  </span>
                )}
              </div>

              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={draftName}
                  maxLength={60}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={() => commitRename(set.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(set.id)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  onClick={e => e.stopPropagation()}
                  style={styles.renameInput}
                />
              ) : (
                <button
                  type="button"
                  onClick={e => {
                    if (!isActive) return
                    e.stopPropagation()
                    beginRename(set)
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation()
                    beginRename(set)
                  }}
                  title={isActive ? 'Click to rename' : set.name}
                  style={{
                    ...styles.name,
                    color: isActive ? 'var(--text)' : 'var(--text-muted)',
                    cursor: isActive ? 'text' : 'pointer',
                  }}
                >
                  {set.name}
                </button>
              )}

              {isActive && set.slot_number > 1 && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onDeleteRequest(set.id)
                  }}
                  title="Delete this tracking set"
                  style={styles.deleteBtn}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {canCreateMore && (
          <button
            type="button"
            onClick={onAddSet}
            style={styles.addTab}
            title={`Add tracking set (${sets.length}/${maxSets})`}
          >
            <span style={styles.addPlus}>+</span>
            <span style={styles.addLabel}>Add set</span>
          </button>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  eyebrow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingInline: '0.2rem',
  },
  eyebrowLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  eyebrowMeta: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
  },
  tabRow: {
    display: 'flex',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  tab: {
    position: 'relative',
    minWidth: '180px',
    flex: '1 1 200px',
    maxWidth: '280px',
    padding: '0.75rem 1rem 0.85rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition:
      'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease',
    fontFamily: "'Outfit', sans-serif",
  },
  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  slot: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontFamily: "'JetBrains Mono', monospace",
    transition: 'color 0.18s ease',
  },
  lockChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.15rem 0.4rem',
    background: 'rgba(148, 163, 184, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '99px',
    color: 'var(--text-dim)',
    fontSize: '0.62rem',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
  },
  name: {
    display: 'block',
    margin: 0,
    padding: 0,
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.02rem',
    fontWeight: 500,
    letterSpacing: '-0.005em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'color 0.18s ease',
  },
  renameInput: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--accent)',
    outline: 'none',
    padding: '1px 0',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.02rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  deleteBtn: {
    position: 'absolute',
    top: '0.4rem',
    right: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: '1rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0.15rem 0.35rem',
    borderRadius: '4px',
    transition: 'color 0.15s, background 0.15s',
  },
  addTab: {
    minWidth: '140px',
    flex: '0 0 auto',
    padding: '0.75rem 1.1rem 0.85rem',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'color 0.18s ease, border-color 0.18s ease',
  },
  addPlus: {
    fontSize: '1.15rem',
    fontWeight: 300,
    color: 'var(--accent)',
    lineHeight: 1,
  },
  addLabel: {
    fontSize: '0.92rem',
    fontWeight: 500,
  },
}
