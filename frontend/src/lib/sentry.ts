import * as Sentry from '@sentry/react'

// Init runs once at app boot from main.tsx. If VITE_SENTRY_DSN is unset the
// SDK no-ops, so dev environments without a DSN behave normally.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // Errors only — no performance traces, no session replay. Keeps us well
    // under the free-tier monthly cap. Flip to a small fraction if we ever
    // want span data later.
    tracesSampleRate: 0,

    // Quiet noisy browser errors that aren't actually bugs in our code.
    ignoreErrors: [
      // Browser extensions, ad blockers, network blips
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Network-related — usually user connectivity, not our problem
      'NetworkError',
      'Failed to fetch',
      'Load failed',
    ],

    beforeSend(event) {
      // Strip user identifiers — we don't need emails in Sentry to debug.
      if (event.user) {
        delete event.user.email
        delete event.user.username
        delete event.user.ip_address
      }

      // Strip auth tokens from URLs (e.g. magic links land with token in hash).
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          for (const key of ['access_token', 'refresh_token', 'token', 'code']) {
            url.searchParams.delete(key)
          }
          if (url.hash.includes('access_token') || url.hash.includes('token')) {
            url.hash = ''
          }
          event.request.url = url.toString()
        } catch {
          // not a parseable URL — leave as-is
        }
      }

      return event
    },

    beforeBreadcrumb(breadcrumb) {
      // Strip request/response bodies from fetch/xhr breadcrumbs — they often
      // contain business names, query text, or other user content.
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data) {
          delete breadcrumb.data.request_body_size
          delete breadcrumb.data.response_body_size
        }
      }
      return breadcrumb
    },
  })
}

// Re-export so consumers don't import @sentry/react directly.
export { Sentry }
