/**
 * HeroForm — Single-step "Start Your Analysis" form.
 * Collects business name, location, optional description. Queries are
 * auto-generated client-side for now (backend generation is a follow-up).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createBusiness, triggerScan } from '../lib/api'

function buildDefaultQueries(name: string, location: string, description: string): string[] {
  const loc = location.trim()
  const desc = description.trim()
  const subject = desc.length >= 3 ? desc : `businesses like ${name}`
  const queries = [
    loc ? `best ${subject} in ${loc}` : `best ${subject}`,
    loc ? `top rated ${subject} ${loc}` : `top rated ${subject}`,
    loc ? `${subject} near me ${loc}` : `${subject} near me`,
    `${name} reviews`,
    loc ? `is ${name} in ${loc} any good` : `is ${name} any good`,
  ]
  return queries.map(q => q.trim()).filter(q => q.length >= 3).slice(0, 5)
}

export function HeroForm() {
  const navigate = useNavigate()
  const [bizName, setBizName]     = useState('')
  const [location, setLocation]   = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setSubmitting]  = useState(false)
  const [error, setError]              = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bizName.trim()) { setError('Please enter your business name.'); return }
    if (!location.trim()) { setError('Please enter your business location.'); return }

    setSubmitting(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const params = new URLSearchParams({
          name: bizName.trim(),
          location: location.trim(),
          description: description.trim(),
        }).toString()
        navigate(`/auth?${params}`)
        return
      }

      const queries = buildDefaultQueries(bizName, location, description)
      const { business_id } = await createBusiness({
        name: bizName.trim(),
        industry: description.trim() || undefined,
        queries,
      })
      const { scan_id } = await triggerScan(business_id)
      navigate(`/dashboard?scanId=${scan_id}`)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="analyze-form" id="hero-form" onSubmit={handleSubmit}>
      <h2 className="analyze-form-title">Start Your Analysis</h2>

      <div className="form-group">
        <label htmlFor="biz-name">Business Name</label>
        <input
          type="text"
          id="biz-name"
          name="business_name"
          placeholder="Business Name"
          required
          autoComplete="organization"
          value={bizName}
          onChange={e => setBizName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="biz-location">Location (City, Country)</label>
        <input
          type="text"
          id="biz-location"
          name="location"
          placeholder="Location (City, Country)"
          required
          autoComplete="address-level2"
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="biz-desc">Business Description (optional)</label>
        <textarea
          id="biz-desc"
          name="description"
          placeholder="Optional..."
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {error && <p className="analyze-error">{error}</p>}

      <button type="submit" className="btn-primary analyze-btn" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <div className="spinner" />
            Analyzing...
          </>
        ) : (
          'Analyze My Brand'
        )}
      </button>
    </form>
  )
}
