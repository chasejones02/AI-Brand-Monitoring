import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import scanRouter from './routes/scan.js'
import resultsRouter from './routes/results.js'
import businessRouter from './routes/business.js'
import stripeRouter from './routes/stripe.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

// Stripe webhook needs raw body BEFORE express.json() parses it
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/scan', scanRouter)
app.use('/api/results', resultsRouter)
app.use('/api/business', businessRouter)
app.use('/api/stripe', stripeRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ data: null, error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`AI Brand Monitor API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
