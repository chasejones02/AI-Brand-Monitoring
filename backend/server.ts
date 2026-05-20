import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import scanRouter from './routes/scan.js'
import resultsRouter from './routes/results.js'
import businessRouter from './routes/business.js'
import stripeRouter from './routes/stripe.js'
import quotaRouter from './routes/quota.js'
import trackingSetsRouter from './routes/trackingSets.js'
import { supabase } from './services/supabase.js'
import { globalApiLimiter, scanLimiter, checkoutLimiter } from './middleware/rateLimit.js'

const app = express()
const PORT = process.env.PORT ?? 3001

// Trust the first reverse-proxy hop (Railway/Render/Vercel) so express-rate-limit
// keys by the real client IP from X-Forwarded-For instead of the proxy's IP.
// Do NOT set to `true` — that lets clients spoof the header.
app.set('trust proxy', 1)

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

// Stripe webhook needs raw body BEFORE express.json() parses it
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

// Floodwall on every /api/* route except the Stripe webhook (Stripe retries
// legitimately). Tighter, route-specific limiters layer on top below.
app.use('/api', globalApiLimiter)
app.use('/api/stripe/create-checkout', checkoutLimiter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/scan', scanLimiter, scanRouter)
app.use('/api/results', resultsRouter)
app.use('/api/business', businessRouter)
app.use('/api/stripe', stripeRouter)
app.use('/api/quota', quotaRouter)
// Mounts at /api so the router's own paths can include both /business/:id/...
// (list/create) and /tracking-sets/:setId (update/delete) cleanly.
app.use('/api', trackingSetsRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ data: null, error: 'Not found' })
})

// Reap orphaned scans — any scan still in pending/running state when the
// server starts was interrupted by a previous crash/restart. Mark as failed
// so free users aren't permanently blocked by a stuck scan and the UI can
// show an accurate state.
async function reapOrphanedScans() {
  const { data, error } = await supabase
    .from('scans')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .in('status', ['pending', 'running'])
    .select('id')
  if (error) {
    console.error('Failed to reap orphaned scans:', error)
    return
  }
  if (data && data.length > 0) {
    console.log(`Reaped ${data.length} orphaned scan(s) from previous run`)
  }
}

app.listen(PORT, () => {
  console.log(`AI Brand Monitor API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  reapOrphanedScans()
})
