import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { requireAuth } from '../middleware/auth.js'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL!,
  growth: process.env.STRIPE_PRICE_GROWTH!,
  growth_annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL!,
}

// Strip _annual suffix to get the base tier name stored in the DB
function normalizeDbTier(tier: string): string {
  return tier.replace('_annual', '')
}

// POST /api/stripe/create-checkout
// Body: { tier: 'starter' | 'starter_annual' | 'growth' | 'growth_annual' }
router.post('/create-checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tier } = req.body

  if (!tier || !PRICE_MAP[tier]) {
    res.status(400).json({ data: null, error: 'Invalid tier. Must be starter, starter_annual, growth, or growth_annual.' })
    return
  }

  const priceId = PRICE_MAP[tier]
  const userId = req.userId!
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

  try {
    // Look up existing stripe_customer_id for this user
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single()

    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined

    // Create a Stripe customer if we don't have one yet
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { supabase_user_id: userId },
        ...(profile?.email ? { email: profile.email } : {}),
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?canceled=true`,
      metadata: { supabase_user_id: userId, tier: normalizeDbTier(tier) },
    })

    res.json({ data: { url: session.url }, error: null })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ data: null, error: 'Failed to create checkout session' })
  }
})

// POST /api/stripe/verify-session
// Fallback for when the Stripe webhook hasn't (yet) reached us — e.g. local
// dev without `stripe listen`, or a transient delivery delay in prod. The
// /success page calls this with the session_id it received from Checkout.
// We retrieve the session from Stripe, confirm the caller owns it, and flip
// the profile to active. Idempotent: re-running on an already-active profile
// is a no-op.
router.post('/verify-session', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.body
  const userId = req.userId!

  if (!session_id || typeof session_id !== 'string') {
    res.status(400).json({ data: null, error: 'session_id is required' })
    return
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)

    // The session must belong to the authenticated user. Without this check,
    // any signed-in user could claim someone else's payment by guessing IDs.
    if (session.metadata?.supabase_user_id !== userId) {
      res.status(403).json({ data: null, error: 'Session does not belong to this user' })
      return
    }

    if (session.payment_status !== 'paid') {
      res.json({ data: { status: session.payment_status, activated: false }, error: null })
      return
    }

    const tier = session.metadata?.tier
    if (!tier) {
      res.status(400).json({ data: null, error: 'Session is missing tier metadata' })
      return
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase
      .from('profiles')
      .update({
        subscription_status: 'active',
        subscription_tier: tier,
        stripe_customer_id: session.customer as string,
      })
      .eq('id', userId)

    res.json({ data: { status: 'paid', activated: true, tier }, error: null })
  } catch (err: any) {
    console.error('Stripe verify-session error:', err)
    res.status(500).json({ data: null, error: 'Failed to verify session' })
  }
})

// GET /api/stripe/subscription
// Returns the current user's subscription tier and status from their profile.
router.get('/subscription', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_tier, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      res.status(404).json({ data: null, error: 'Profile not found' })
      return
    }

    res.json({
      data: {
        status: profile.subscription_status ?? 'free',
        tier: profile.subscription_tier ?? 'free',
        has_customer: !!profile.stripe_customer_id,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('Subscription fetch error:', err)
    res.status(500).json({ data: null, error: 'Failed to fetch subscription' })
  }
})

// POST /api/stripe/create-portal
// Creates a Stripe Customer Portal session so the user can manage their
// subscription (upgrade, downgrade, cancel, update payment method).
router.post('/create-portal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_customer_id) {
      res.status(400).json({ data: null, error: 'No billing account found. Subscribe to a plan first.' })
      return
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${frontendUrl}/account`,
    })

    res.json({ data: { url: session.url }, error: null })
  } catch (err: any) {
    console.error('Stripe portal error:', err)
    res.status(500).json({ data: null, error: 'Failed to create billing portal session' })
  }
})

// POST /api/stripe/webhook
// Stripe sends events here — must use raw body for signature verification
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature']

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' })
    return
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw Buffer — see server.ts for express.raw() setup
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    res.status(400).json({ error: `Webhook error: ${err.message}` })
    return
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Idempotency guard: insert event_id first, then process. If insert hits the
  // primary-key conflict, Stripe is retrying an event we've already applied —
  // return 2xx so Stripe stops retrying and skip the handler.
  const { error: dedupError } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: event.id, event_type: event.type })

  if (dedupError) {
    if (dedupError.code === '23505') {
      console.log(`Stripe webhook duplicate, skipping: ${event.id} (${event.type})`)
      res.json({ received: true, duplicate: true })
      return
    }
    console.error('Failed to record Stripe event for idempotency:', dedupError)
    res.status(500).json({ error: 'Failed to record event' })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const tier = session.metadata?.tier

      if (userId && tier) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_tier: tier,
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      await supabase
        .from('profiles')
        .update({ subscription_status: 'canceled', subscription_tier: 'free' })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      await supabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const status = subscription.status // 'active' | 'past_due' | 'canceled' | etc.

      await supabase
        .from('profiles')
        .update({ subscription_status: status === 'active' ? 'active' : status })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  res.json({ received: true })
})

export default router
