/**
 * CtaSection — Bottom call-to-action with email input.
 * On submit, scrolls to and pre-fills the hero form.
 */

import { useState } from 'react'

interface CtaSectionProps {
  onSubmit: (email: string) => void
}

export function CtaSection({ onSubmit }: CtaSectionProps) {
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(email)
  }

  return (
    <section className="cta-section">
      <div className="container">
        <h2>Your competitors are<br /><em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>already being found</em> by AI.</h2>
        <p>Run your free scan and see exactly where you stand.</p>

        <form className="cta-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Your email address"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="submit" className="btn-cta">Get Free Report →</button>
        </form>
        <p style={{ fontSize: '.75rem', color: 'var(--text-dim)' }}>No credit card required. Takes 60 seconds.</p>

        <p
          style={{
            marginTop: '3rem',
            fontSize: '0.85rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 500,
          }}
        >
          See your brand.{' '}
          <span style={{ color: 'var(--accent)', fontStyle: 'italic', textTransform: 'none', letterSpacing: '0.02em', fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem' }}>
            Visaion.
          </span>
        </p>
      </div>
    </section>
  )
}
