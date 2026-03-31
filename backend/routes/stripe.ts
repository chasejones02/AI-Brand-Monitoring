import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { requireAuth } from '../middleware/auth.js'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  growth: process.env.STRIPE_PRICE_GROWTH!,
  agency: process.env.STRIPE_PRICE_AGENCY!,
}

// POST /api/stripe/create-checkout
// Body: { tier: 'starter' | 'growth' | 'agency' }
router.post('/create-checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tier } = req.body

  if (!tier || !PRICE_MAP[tier]) {
    res.status(400).json({ data: null, error: 'Invalid tier. Must be starter, growth, or agency.' })
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
      metadata: { supabase_user_id: userId, tier },
    })

    res.json({ data: { url: session.url }, error: null })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ data: null, error: 'Failed to create checkout session' })
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
