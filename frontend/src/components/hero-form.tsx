/**
 * HeroForm — business name + query entry form.
 *
 * Unauthenticated users: saves biz data to sessionStorage and redirects
 * to /auth to create an account. Auth page picks up the pending data
 * and completes the scan creation after signup.
 *
 * Authenticated users: creates the business + triggers a scan directly.
 */

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { createBusiness, triggerScan } from '../lib/api'

const MAX_QUERIES = 10

export function HeroForm() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [bizName, setBizName] = useState('')
  const [queries, setQueries] = useState(['', ''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const bizNameRef = useRef<HTMLInputElement>(null)
  const firstQueryRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!bizName.trim()) {
      setError('Please enter your business name.')
      return
    }
    const filledQueries = queries.filter(q => q.trim().length >= 3)
    if (filledQueries.length === 0) {
      setError('Add at least one query (3+ characters).')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      if (session) {
        // Already logged in — create business + trigger scan directly
        const { business_id } = await createBusiness({ name: bizName.trim(), queries: filledQueries })
        const { scan_id } = await triggerScan(business_id)
        navigate(`/dashboard?scanId=${scan_id}`)
      } else {
        // Save biz data and redirect to auth
        sessionStorage.setItem('pending_scan', JSON.stringify({ bizName: bizName.trim(), queries: filledQueries }))
        navigate('/auth')
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function addQuery() {
    if (queries.length >= MAX_QUERIES) return
    setQueries([...queries, ''])
  }

  function removeQuery(index: number) {
    if (queries.length <= 2) return
    setQueries(queries.filter((_, i) => i !== index))
  }

  function updateQuery(index: number, value: string) {
    const next = [...queries]
    next[index] = value
    setQueries(next)
  }

  return (
    <div className="form-card" id="hero-form">
      <div style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) both' }}>
        <div className="form-header">
          <h2>Check your AI visibility</h2>
          <p>Enter your business name and the queries your customers use to find businesses like yours.</p>
        </div>

        <div className="form-group">
          <label htmlFor="biz-name">Business Name</label>
          <input
            type="text"
            id="biz-name"
            name="business_name"
            placeholder="e.g. Riverside Dental Studio"
            required
            autoComplete="organization"
            ref={bizNameRef}
            value={bizName}
            onChange={e => setBizName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); firstQueryRef.current?.focus() } }}
          />
        </div>

        <div className="query-explainer">
          Think of it as: <strong>if someone asked ChatGPT to find a business like yours, what would they type?</strong>
          <div className="query-examples">
            <span className="query-example-chip">"best pizza in Austin"</span>
            <span className="query-example-chip">"affordable accountant Denver"</span>
            <span className="query-example-chip">"top CRM for small teams"</span>
            <span className="query-example-chip">"emergency plumber near me"</span>
          </div>
        </div>

        <div className="query-section-label" style={{ marginTop: '0.75rem' }}>
          <span>Your queries</span>
          <span className="query-count">{queries.length} / {MAX_QUERIES}</span>
        </div>

        <div className="query-list" style={{ marginTop: '0.45rem' }}>
          {queries.map((q, i) => (
            <div className="query-row" key={i}>
              <input
                ref={i === 0 ? firstQueryRef : undefined}
                type="text"
                name="queries[]"
                placeholder={i === 0 ? 'e.g. best [your service] in [your city]' : 'e.g. affordable [your service] near me'}
                value={q}
                onChange={e => updateQuery(i, e.target.value)}
              />
              {queries.length > 2 && (
                <button
                  type="button"
                  className="query-remove"
                  onClick={() => removeQuery(i)}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-add-query"
          onClick={addQuery}
          disabled={queries.length >= MAX_QUERIES}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add another query
        </button>

        {error && (
          <p style={{ fontSize: '0.8rem', color: 'var(--red)', marginBottom: '0.25rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={isSubmitting ? { opacity: 0.8 } : undefined}
        >
          <span>{isSubmitting ? 'Queuing scan...' : 'Run My Scan'}</span>
          {isSubmitting ? (
            <div className="spinner" style={{ display: 'block' }}></div>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          )}
        </button>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.75rem' }}>
          Free scan. No credit card. Results in 60 seconds.
        </p>
      </div>
    </div>
  )
}
