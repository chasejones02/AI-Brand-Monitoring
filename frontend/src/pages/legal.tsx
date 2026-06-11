import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Nav } from '../components/nav'
import { Footer } from '../components/footer'

const updated = 'June 10, 2026'

function LegalPage({
  label,
  title,
  intro,
  sections,
}: {
  label: string
  title: string
  intro: string
  sections: Array<{ title: string; body: string[] }>
}) {
  return (
    <div style={s.page}>
      <div className="landing-clean-bg" aria-hidden />
      <Nav />

      <main style={s.main}>
        <div style={s.shell}>
          <Link to="/" style={s.backLink}>
            <span style={s.backArrow}>←</span> Back to home
          </Link>

          <header style={s.header}>
            <p style={s.kicker}>{label}</p>
            <h1 style={s.title}>{title}</h1>
            <p style={s.intro}>{intro}</p>
            <span style={s.updated}>Last updated {updated}</span>
          </header>

          <div style={s.sections}>
            {sections.map((section, i) => (
              <section key={section.title} style={s.card}>
                <span style={s.cardIndex}>{String(i + 1).padStart(2, '0')}</span>
                <div style={s.cardBody}>
                  <h2 style={s.sectionTitle}>{section.title}</h2>
                  {section.body.map(paragraph => (
                    <p key={paragraph} style={s.body}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div style={s.contactBox}>
            <div>
              <p style={s.contactTitle}>Questions about this {label.toLowerCase()}?</p>
              <p style={s.contactCopy}>We usually reply within a business day.</p>
            </div>
            <a href="mailto:hello@visaion.com" style={s.contactBtn}>
              hello@visaion.com
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalPage
      label="Terms"
      title="Terms of Service"
      intro="These terms govern access to Visaion, an AI visibility monitoring service for businesses."
      sections={[
        {
          title: 'Using Visaion',
          body: [
            'You may use Visaion to create a business profile, generate target queries, run AI visibility scans, review scan results, and manage your subscription.',
            'You are responsible for the accuracy of the business information, website details, descriptions, and queries you submit.',
          ],
        },
        {
          title: 'Accounts and access',
          body: [
            'You must provide accurate account information and keep your login credentials secure. You are responsible for activity that happens under your account.',
            'We may suspend or limit access if we believe an account is being used fraudulently, unlawfully, or in a way that harms the service.',
          ],
        },
        {
          title: 'AI scan results',
          body: [
            'Visaion sends your selected or generated queries to AI platforms and analyzes the responses for business mentions, competitor mentions, sentiment, and position.',
            'AI responses can be incomplete, inaccurate, inconsistent, or change over time. Visaion does not guarantee that a platform will mention your business or that a score will improve after you make changes.',
          ],
        },
        {
          title: 'Subscriptions and billing',
          body: [
            'Paid plans are billed through Stripe. Subscription features, scan limits, and pricing are shown at checkout or on the pricing page.',
            'You can manage, cancel, upgrade, or downgrade your subscription through the billing portal when available from your account page. Cancellation affects future billing and may not automatically refund prior charges.',
          ],
        },
        {
          title: 'Acceptable use',
          body: [
            'Do not use Visaion to submit illegal content, infringe someone else\'s rights, overload the service, reverse engineer the platform, or interfere with other users.',
            'Do not submit sensitive personal data, regulated health data, payment card numbers, passwords, or private information that you are not authorized to provide.',
          ],
        },
        {
          title: 'Intellectual property',
          body: [
            'You keep ownership of the business information and content you submit. Visaion owns the service, software, interface, branding, and platform materials.',
            'You may use your own reports for internal business and marketing decisions, subject to these terms.',
          ],
        },
        {
          title: 'Limitation of liability',
          body: [
            'Visaion is provided as a business intelligence tool, not as legal, financial, advertising, or professional advice.',
            'To the fullest extent permitted by law, Visaion is not liable for indirect, incidental, special, consequential, or lost-profit damages arising from use of the service.',
          ],
        },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalPage
      label="Privacy"
      title="Privacy Policy"
      intro="This policy explains what Visaion collects, why we collect it, and how information is used to provide AI visibility reports."
      sections={[
        {
          title: 'Information we collect',
          body: [
            'We collect account information such as your name, email address, authentication details, and subscription status.',
            'We collect business information you submit, including business name, location, website, industry or description, target queries, scan history, scan results, AI responses, recommendations, and usage metadata.',
          ],
        },
        {
          title: 'How we use information',
          body: [
            'We use information to create your account, generate queries, run scans, calculate visibility scores, show reports, manage subscriptions, troubleshoot errors, prevent abuse, and improve the service.',
            'We may use aggregate or de-identified usage patterns to understand product performance and reliability.',
          ],
        },
        {
          title: 'AI providers and processors',
          body: [
            'To run scans, Visaion may send queries, business names, locations, descriptions, and AI responses to third-party AI providers for query execution, mention analysis, and recommendations.',
            'Authentication is handled with Supabase, payments are processed by Stripe, and application errors may be reported through Sentry when configured.',
          ],
        },
        {
          title: 'Payment information',
          body: [
            'Visaion does not store full payment card numbers. Stripe processes payment details and provides billing status, customer identifiers, subscription events, and invoice information needed to operate paid plans.',
          ],
        },
        {
          title: 'Data retention',
          body: [
            'We retain account, business, scan, and billing records for as long as needed to provide the service, meet operational needs, resolve disputes, enforce agreements, and comply with legal obligations.',
            'If you want to request deletion of your account or business data, contact us at hello@visaion.com.',
          ],
        },
        {
          title: 'Sharing information',
          body: [
            'We do not sell your personal information. We share information with service providers that help us operate Visaion, including hosting, authentication, payments, AI processing, and error monitoring.',
            'We may disclose information if required by law, to protect rights and safety, or in connection with a merger, acquisition, financing, or sale of assets.',
          ],
        },
        {
          title: 'Security',
          body: [
            'We use technical and organizational safeguards designed to protect information, but no online service can guarantee absolute security.',
            'You should use a strong password, keep account access private, and avoid submitting sensitive information that is not needed for AI visibility scanning.',
          ],
        },
      ]}
    />
  )
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: "'Outfit', sans-serif",
    position: 'relative',
  },
  main: {
    position: 'relative',
    zIndex: 1,
    padding: '8rem 1.5rem 4rem',
  },
  shell: {
    width: 'min(780px, 100%)',
    margin: '0 auto',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.82rem',
    letterSpacing: '0.02em',
    marginBottom: '2.5rem',
  },
  backArrow: {
    color: 'var(--accent)',
  },
  header: {
    marginBottom: '2.75rem',
  },
  kicker: {
    display: 'inline-block',
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    fontSize: '0.7rem',
    fontWeight: 700,
    marginBottom: '1rem',
  },
  title: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 400,
    fontSize: 'clamp(2.4rem, 6vw, 3.6rem)',
    lineHeight: 1.0,
    letterSpacing: '-0.03em',
    margin: '0 0 1.25rem',
  },
  intro: {
    color: 'var(--text-muted)',
    fontSize: '1.05rem',
    lineHeight: 1.7,
    maxWidth: '640px',
    margin: '0 0 1.5rem',
  },
  updated: {
    display: 'inline-block',
    color: 'var(--text-dim)',
    fontSize: '0.74rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.35rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: '999px',
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  card: {
    display: 'flex',
    gap: '1.25rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderLeft: '2px solid var(--accent)',
    borderRadius: '10px',
    padding: '1.6rem 1.75rem',
  },
  cardIndex: {
    flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--accent)',
    opacity: 0.7,
    paddingTop: '0.15rem',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: 'var(--text)',
    fontSize: '1.05rem',
    fontWeight: 600,
    lineHeight: 1.3,
    margin: '0 0 0.85rem',
  },
  body: {
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
    lineHeight: 1.75,
    margin: '0 0 0.85rem',
  },
  contactBox: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginTop: '2.5rem',
    padding: '1.5rem 1.75rem',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'rgba(240,165,0,0.04)',
  },
  contactTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: 'var(--text)',
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 0.3rem',
  },
  contactCopy: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    margin: 0,
  },
  contactBtn: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.92rem',
    padding: '0.7rem 1.25rem',
    border: '1px solid var(--accent)',
    borderRadius: '8px',
    whiteSpace: 'nowrap',
  },
}
