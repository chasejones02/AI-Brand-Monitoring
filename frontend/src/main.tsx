import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry, Sentry } from './lib/sentry'
import { initPostHog } from './lib/posthog'
import './styles/globals.css'
import App from './App'

// Init Sentry before mounting React so render errors are captured from the
// first paint. No-op when VITE_SENTRY_DSN is unset.
initSentry()

// Init PostHog product analytics. No-op when VITE_POSTHOG_KEY is unset.
initPostHog()

// TEMP smoke test — visit /?sentry-test=1 to fire one event. Remove after verifying.
if (window.location.search.includes('sentry-test')) {
  Sentry.captureMessage('Frontend smoke test ' + Date.now(), 'info')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
