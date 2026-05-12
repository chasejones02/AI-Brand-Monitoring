import { useState, useEffect } from 'react'
import type { TrackingSet } from '../lib/api'

export type EditorMode =
  | { kind: 'create' }
  | { kind: 'edit'; set: TrackingSet }

interface TrackingSetEditorProps {
  open: boolean
  mode: EditorMode
  onCancel: () => void
  onSubmit: (payload: { name: string; queries: string[] }) => Promise<void>
  isSubmitting: boolean
  error: string
}

// Single editor used for both "Add a tracking set" and "Edit an unlocked set".
// Locked sets never open this — the tab shows the lock chip and the action
// stays disabled until the 30-day window expires.
export function TrackingSetEditor({
  open,
  mode,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
}: TrackingSetEditorProps) {
  const startName = mode.kind === 'edit' ? mode.set.name : ''
  const startQueries =
    mode.kind === 'edit'
      ? mode.set.queries.filter(q => q.is_active).map(q => q.query_text)
      : ['', '', '', '', '']

  const [name, setName] = useState(startName)
  const [queries, setQueries] = useState<string[]>(padTo5(startQueries))
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (open) {
      setName(startName)
      setQueries(padTo5(startQueries))
      setFormError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode.kind, mode.kind === 'edit' ? mode.set.id : ''])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onCancel()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, isSubmitting, onCancel])

  if (!open) return null

  function updateQuery(i: number, val: string) {
    setQueries(prev => prev.map((q, idx) => (idx === i ? val : q)))
  }

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Give this set a name')
      return
    }
    const cleaned = queries.map(q => q.trim()).filter(q => q.length >= 3)
    if (cleaned.length === 0) {
      setFormError('Add at least one query (3+ characters)')
      return
    }
    if (cleaned.length > 5) {
      setFormError('A tracking set can hold up to 5 queries')
      return
    }
    setFormError('')
    await onSubmit({ name: trimmedName, queries: cleaned })
  }

  const isCreate = mode.kind === 'create'
  const title = isCreate ? 'New tracking set' : `Edit set · ${mode.set.name}`

  return (
    <div style={overlay} onClick={() => !isSubmitting && onCancel()}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={accentBar} />

        <div style={header}>
          <p style={eyebrow}>{isCreate ? 'Add set' : 'Edit set'}</p>
          <h2 style={titleStyle}>{title}</h2>
          <p style={subtitle}>
            {isCreate
              ? 'Name your set and add up to 5 queries to track. Once you scan it, the queries will be locked for 30 days so your trend stays apples-to-apples.'
              : 'Update the name or queries. After saving, your next scan starts a fresh 30-day tracking window.'}
          </p>
        </div>

        <div style={fieldBlock}>
          <label style={fieldLabel}>Name</label>
          <input
            type="text"
            value={name}
            maxLength={60}
            placeholder="e.g. Boutique queries"
            onChange={e => setName(e.target.value)}
            style={input}
            autoFocus
          />
        </div>

        <div style={fieldBlock}>
          <label style={fieldLabel}>
            Queries <span style={fieldOptional}>up to 5</span>
          </label>
          <div style={queryList}>
            {queries.map((q, i) => (
              <div key={i} style={queryRow}>
                <span style={queryIndex}>{String(i + 1).padStart(2, '0')}</span>
                <input
                  type="text"
                  value={q}
                  onChange={e => updateQuery(i, e.target.value)}
                  placeholder={i === 0 ? 'e.g. best bakery in Brookings' : 'Another query…'}
                  style={queryInput}
                />
              </div>
            ))}
          </div>
        </div>

        {(formError || error) && <p style={errorStyle}>{formError || error}</p>}

        <div style={actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={cancelBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ ...confirmBtn, opacity: isSubmitting ? 0.6 : 1 }}
          >
            {isSubmitting
              ? 'Saving…'
              : isCreate
              ? 'Create set →'
              : 'Save changes →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function padTo5(arr: string[]): string[] {
  const out = arr.slice(0, 5)
  while (out.length < 5) out.push('')
  return out
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(7, 9, 13, 0.78)',
  backdropFilter: 'blur(6px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
}

const card: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '600px',
  maxHeight: '92vh',
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '2rem 2rem 1.75rem',
  fontFamily: "'Outfit', sans-serif",
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
}

const accentBar: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: '2rem',
  right: '2rem',
  height: '1px',
  background:
    'linear-gradient(90deg, transparent, var(--accent), transparent)',
  opacity: 0.5,
}

const header: React.CSSProperties = { marginBottom: '1.5rem' }

const eyebrow: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--accent)',
  fontFamily: "'JetBrains Mono', monospace",
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: "'Instrument Serif', 'Plus Jakarta Sans', serif",
  fontSize: '2.1rem',
  fontWeight: 400,
  color: 'var(--text)',
  lineHeight: 1.05,
  letterSpacing: '-0.01em',
}

const subtitle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.92rem',
  lineHeight: 1.55,
  color: 'var(--text-muted)',
}

const fieldBlock: React.CSSProperties = { marginBottom: '1.25rem' }

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: '0.45rem',
  fontFamily: "'JetBrains Mono', monospace",
}

const fieldOptional: React.CSSProperties = {
  color: 'var(--text-dim)',
  letterSpacing: '0.04em',
  textTransform: 'none',
  fontWeight: 500,
  marginLeft: '0.4rem',
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text)',
  fontFamily: "'Outfit', sans-serif",
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const queryList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

const queryRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
}

const queryIndex: React.CSSProperties = {
  flex: '0 0 auto',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--text-dim)',
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.04em',
}

const queryInput: React.CSSProperties = {
  ...input,
  fontSize: '0.92rem',
  padding: '0.6rem 0.75rem',
}

const errorStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  color: 'var(--red)',
  fontSize: '0.85rem',
}

const actions: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginTop: '0.5rem',
}

const cancelBtn: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '0.85rem 1.25rem',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontFamily: "'Outfit', sans-serif",
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s',
}

const confirmBtn: React.CSSProperties = {
  flex: 1,
  padding: '0.85rem 1.25rem',
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontFamily: "'Outfit', sans-serif",
  fontWeight: 600,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  transition: 'opacity 0.15s, transform 0.15s',
}
