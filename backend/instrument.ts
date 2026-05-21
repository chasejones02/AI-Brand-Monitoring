// Sentry MUST be initialized before any other instrumented module is imported.
// server.ts imports this file first; do not move the import order around.
import * as Sentry from '@sentry/node'
import { env } from './config/env.js'

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,

    // Errors only — no performance traces. Cuts event volume hard and keeps
    // us well under the free-tier monthly cap. Flip to a small fraction if
    // we ever want span data.
    tracesSampleRate: 0,

    // Ignore expected client-side mistakes — those aren't bugs in our code.
    ignoreErrors: [
      // Express 4 doesn't surface 404s as exceptions, but if any auth/validation
      // path throws a non-Error with these messages they shouldn't page anyone.
      'Not found',
      'Missing authorization header',
      'Invalid or expired token',
    ],

    beforeSend(event) {
      // Strip request bodies entirely — they can contain business names,
      // emails, query text, etc. Keep the URL, method, and headers (minus auth).
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        if (event.request.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
          delete event.request.headers['stripe-signature']
        }
      }

      // Don't ship user emails. We tag events with userId elsewhere when we
      // need to correlate; that's enough for debugging.
      if (event.user) {
        delete event.user.email
        delete event.user.username
        delete event.user.ip_address
      }

      return event
    },
  })

  console.log(`Sentry initialized (env: ${env.NODE_ENV})`)
}
