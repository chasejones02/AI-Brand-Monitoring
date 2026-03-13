/**
 * HeroForm — 3-step form card in the hero section.
 *
 * State machine:
 *   'input'   → Business name + email form (step 1)
 *   'queries' → Query entry with add/remove (step 2)
 *   'success' → Confirmation message
 *
 * The form id "hero-form" is used for scroll-to-form from nav/CTA.
 */

import { useState, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createBusiness, triggerScan } from '../lib/api'
import { ScanPreview } from './scan-preview'

const MAX_QUERIES = 10

type FormStep = 'input' | 'queries' | 'success'

export const HeroForm = forwardRef<HTMLDivElement>(function HeroForm(_, ref) {
  const navigate = useNavigate()
  const [step, setStep] = useState<FormStep>('input')
  const [bizName, setBizName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [queries, setQueries] = useState(['', ''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const firstQueryRef = useRef<HTMLInputElement>(null)

  // Expose email setter for CTA prefill
  const emailRef = useRef<HTMLInputElement>(null)

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setStep('queries')
    setTimeout(() => firstQueryRef.current?.focus(), 100)
  }

  async function handleStep2() {
    const filledQueries = queries.filter(q => q.trim().length >= 3)
    if (filledQueries.length === 0) {
      setError('Add at least one query (3+ characters).')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: '' } },
      })

      if (signUpError) throw signUpError

      // If email confirmation is required, show success without redirecting
      if (!data.session) {
        setStep('success')
        return
      }

      // Create business + trigger scan
      const { business_id } = await createBusiness({ name: bizName, queries: filledQueries })
      const { scan_id } = await triggerScan(business_id)

      navigate(`/dashboard?scanId=${scan_id}`)
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
    <div style={{ paddingRight: '2rem' }}>
      <div className="form-card anim-5" id="hero-form" ref={ref}>
        {/* Step 1: Business info */}
        {step === 'input' && (
          <div>
            <div className="form-header">
              <h2>Get your free report</h2>
              <p>One-time scan. No credit card. Results delivered to your inbox.</p>
            </div>

            <form onSubmit={handleStep1}>
              <div className="form-group">
                <label htmlFor="biz-name">Business Name</label>
                <input
                  type="text"
                  id="biz-name"
                  name="business_name"
                  placeholder="e.g. Riverside Dental Studio"
                  required
                  autoComplete="organization"
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  ref={emailRef}
                  name="email"
                  placeholder="you@yourbusiness.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary">
                Generate My Free Report
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </form>

            <p className="form-trust">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              No spam. Unsubscribe anytime. We never share your data.
            </p>

            <ScanPreview />
          </div>
        )}

        {/* Step 2: Query entry */}
        {step === 'queries' && (
          <div style={{ animation: 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) both' }}>
            <div className="form-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                    gap: '0.3rem', fontSize: '0.78rem', fontFamily: "'Outfit',sans-serif",
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5" /><path d="m12 5-7 7 7 7" /></svg>
                  Back
                </button>
              </div>
              <h2>What should AI find you for?</h2>
              <p>Enter the search phrases your customers actually use — not your business name, but the queries that <em>should</em> lead to you.</p>
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
              onClick={handleStep2}
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
              You can add up to 10 queries. More queries = more complete picture.
            </p>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="success-state" style={{ display: 'block', animation: 'fadeUp 0.5s cubic-bezier(.22,1,.36,1) both' }}>
            <div className="success-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>Report queued!</h3>
            <p>
              We're scanning ChatGPT, Claude, Perplexity, and Gemini for
              <strong> "{bizName}"</strong>.<br /><br />
              Your full AI Visibility Report will arrive in your inbox within a few minutes.
            </p>
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>While you wait — see what our paid plans include:</p>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(240,165,0,.15)', borderRadius: '6px', padding: '.35rem .7rem', fontSize: '.75rem', color: 'var(--accent)' }}>Weekly scans</div>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(240,165,0,.15)', borderRadius: '6px', padding: '.35rem .7rem', fontSize: '.75rem', color: 'var(--accent)' }}>Competitor radar</div>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(240,165,0,.15)', borderRadius: '6px', padding: '.35rem .7rem', fontSize: '.75rem', color: 'var(--accent)' }}>Trend graphs</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
