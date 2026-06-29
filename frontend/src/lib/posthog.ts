import posthog from 'posthog-js'

// Init runs once at app boot from main.tsx. If VITE_POSTHOG_KEY is unset the
// SDK never loads, so dev environments without a key behave normally and send
// nothing. Mirrors the env-gated pattern used for Sentry.
let initialized = false

export function initPostHog() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    // Defaults to PostHog Cloud US. Override via env if you picked the EU region.
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',

    // We fire pageviews manually on route change (see usePostHogPageviews),
    // because this is a single-page app — the URL changes without a full reload.
    capture_pageview: false,

    // Autocapture handles clicks/inputs/submits automatically, which powers
    // funnels without per-component instrumentation.
    autocapture: true,

    // Respect Do Not Track and don't persist across domains we don't own.
    respect_dnt: true,

    // Don't record people until we know who they are isn't desired here — we
    // want anonymous funnel data too — so leave identification opt-in via the
    // auth context (identifyUser / resetUser below).
    loaded: () => {
      initialized = true
    },
  })

  initialized = true
}

// Fire a pageview. Called on every route change.
export function capturePageview() {
  if (!initialized) return
  posthog.capture('$pageview')
}

// The acquisition funnel. These five events, plus the automatic $pageview,
// are the steps we build the PostHog funnel insight from:
//   $pageview → business_created → scan_started → scan_completed
//             → checkout_started → subscription_activated
// Keep names in sync with the PostHog funnel definition. Don't rename casually —
// renaming breaks historical funnel continuity.
export const EVENTS = {
  BUSINESS_CREATED: 'business_created',       // entered the funnel (anon or authed)
  SCAN_STARTED: 'scan_started',               // confirmed preview, scan kicked off
  SCAN_COMPLETED: 'scan_completed',           // activation — first useful report
  CHECKOUT_STARTED: 'checkout_started',       // free→paid intent (hit Stripe)
  SUBSCRIPTION_ACTIVATED: 'subscription_activated', // conversion — paid & active
} as const

// Track a named product event (e.g. 'scan_started', 'checkout_started').
//
// skip_client_rate_limiting is REQUIRED here: posthog-js applies a client-side
// rate limiter that silently dropped these low-volume custom funnel events
// (SDK-internal $-prefixed events like $pageview/$autocapture are exempt, which
// is why only our custom events went missing). send_instantly also bypasses the
// batch queue so a capture immediately before an SPA navigation isn't lost.
// Do not remove these options — without them the funnel events stop landing.
export function captureEvent(name: string, props?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(name, props, {
    send_instantly: true,
    skip_client_rate_limiting: true,
  })
}

// Tie events to a logged-in user so funnels can follow them across sessions.
// We pass only the Supabase user id — no email/PII — matching the privacy
// posture of the Sentry config.
export function identifyUser(userId: string) {
  if (!initialized) return
  posthog.identify(userId)
}

// Clear the identity on sign-out so the next visitor isn't merged into it.
export function resetUser() {
  if (!initialized) return
  posthog.reset()
}

export { posthog }
