import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

const errorBody = (message: string) => ({
  data: null,
  error: message,
  code: 'rate_limited',
})

// Stripe legitimately retries webhooks — never throttle them.
// req.path here is relative to the limiter's mount point (/api).
const skipStripeWebhook = (req: Request) => req.path === '/stripe/webhook'

// Broad floodwall: catches obvious abuse, doesn't interfere with normal use.
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipStripeWebhook,
  message: errorBody('Too many requests, please slow down'),
})

// Strict cap on the scan endpoint — each call fans out to paid AI APIs.
// Sits in addition to the per-user daily quota enforced by the scan route.
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('Too many scan requests, please wait a moment'),
})

// Moderate cap on checkout creation — protects the Stripe API from spray.
export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: errorBody('Too many checkout attempts, please wait a moment'),
})
