import { Router, Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import Stripe from 'stripe'
import { requireAuth } from '../middleware/auth.js'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

type AppSubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due'
type AppSubscriptionTier = 'free' | 'starter' | 'growth'
type ProfileUpdate = {
  subscription_status?: AppSubscriptionStatus
  subscription_tier?: AppSubscriptionTier
  stripe_customer_id?: string
}

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

// Reverse lookup: Stripe price ID → DB tier ('starter'/'growth'). Used by the
// subscription.updated webhook so plan changes made in the Stripe portal
// propagate to profiles.subscription_tier.
const PRICE_TO_TIER: Record<string, string> = Object.entries(PRICE_MAP).reduce(
  (acc, [tierKey, priceId]) => {
    if (priceId) acc[priceId] = normalizeDbTier(tierKey)
    return acc
  },
  {} as Record<string, string>
)

function isAppTier(tier: string | undefined | null): tier is AppSubscriptionTier {
  return tier === 'free' || tier === 'starter' || tier === 'growth'
}

function isPaidTier(tier: string | undefined | null): tier is Exclude<AppSubscriptionTier, 'free'> {
  return tier === 'starter' || tier === 'growth'
}

function priceToTier(priceId: string | undefined | null): AppSubscriptionTier | undefined {
  const tier = priceId ? PRICE_TO_TIER[priceId] : undefined
  return isAppTier(tier) ? tier : undefined
}

function entitlementTier(
  status: AppSubscriptionStatus,
  priceId: string | undefined | null,
  fallbackTier?: string | null
): AppSubscriptionTier {
  if (status === 'free' || status === 'canceled') return 'free'
  return priceToTier(priceId) ?? (isPaidTier(fallbackTier) ? fallbackTier : 'starter')
}

async function updateProfileByUserId(
  supabase: any,
  userId: string,
  update: ProfileUpdate
) {
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)

  if (error) throw new Error(`Profile update failed for user ${userId}: ${error.message}`)
}

async function updateProfileByCustomerId(
  supabase: any,
  customerId: string,
  update: ProfileUpdate
) {
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('stripe_customer_id', customerId)

  if (error) throw new Error(`Profile update failed for Stripe customer ${customerId}: ${error.message}`)
}

// POST /api/stripe/create-checkout
// Body: {
//   tier: 'starter' | 'starter_annual' | 'growth' | 'growth_annual',
//   return_set_id?: string  // optional tracking_set UUID. When present, the
//                           // /success page uses it to send the user straight
//                           // back to the dashboard focused on the set they
//                           // were previewing before they upgraded.
// }
router.post('/create-checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { tier, return_set_id } = req.body

  if (!tier || !PRICE_MAP[tier]) {
    res.status(400).json({ data: null, error: 'Invalid tier. Must be starter, starter_annual, growth, or growth_annual.' })
    return
  }

  // UUID sanity check — anything else is dropped so the success_url stays clean.
  const returnSetId =
    typeof return_set_id === 'string' && /^[0-9a-f-]{36}$/i.test(return_set_id)
      ? return_set_id
      : null

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

    const successUrl = returnSetId
      ? `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&setId=${returnSetId}`
      : `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${frontendUrl}/?canceled=true`,
      metadata: {
        supabase_user_id: userId,
        tier: normalizeDbTier(tier),
        ...(returnSetId ? { return_set_id: returnSetId } : {}),
      },
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
    if (!isPaidTier(tier)) {
      res.status(400).json({ data: null, error: 'Session is missing tier metadata' })
      return
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await updateProfileByUserId(supabase, userId, {
      subscription_status: 'active',
      subscription_tier: tier,
      stripe_customer_id: session.customer as string,
    })

    res.json({ data: { status: 'paid', activated: true, tier }, error: null })
  } catch (err: any) {
    console.error('Stripe verify-session error:', err)
    res.status(500).json({ data: null, error: 'Failed to verify session' })
  }
})

// Map a Stripe subscription status to the four states the app tracks. Stripe
// has more granular statuses ('trialing', 'unpaid', 'incomplete', etc.) than we
// surface, so collapse them here.
function mapStripeStatus(status: Stripe.Subscription.Status): AppSubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      // 'incomplete' / 'paused' — treat as not-yet-entitled.
      return 'free'
  }
}

// Pick the subscription that best represents the customer's entitlement: prefer
// a live one (active/trialing/past_due), else fall back to the most recent.
function pickRelevantSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (subs.length === 0) return null
  const live = subs.find(s => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status))
  if (live) return live
  return [...subs].sort((a, b) => b.created - a.created)[0]
}

// GET /api/stripe/subscription
// Returns the current user's subscription tier and status. The profile columns
// are a cache that drifts whenever a webhook is missed (local dev without
// `stripe listen`, transient delivery failures). To keep the account page
// honest, we reconcile against Stripe as the source of truth whenever the user
// has a Stripe customer, and self-heal the cached profile if it drifted.
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

    let status: string = profile.subscription_status ?? 'free'
    let tier: string = profile.subscription_tier ?? 'free'
    const customerId: string | null = profile.stripe_customer_id ?? null

    if (customerId) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 10,
        })
        const relevant = pickRelevantSubscription(subs.data)
        if (relevant) {
          const liveStatus = mapStripeStatus(relevant.status)
          const priceId = relevant.items?.data?.[0]?.price?.id
          const liveTier = entitlementTier(liveStatus, priceId, tier)

          // Self-heal the cache when Stripe disagrees, so the rest of the app
          // (quota, scan gating) sees the corrected entitlement too.
          if (liveStatus !== status || liveTier !== tier) {
            await updateProfileByUserId(supabase, userId, {
              subscription_status: liveStatus,
              subscription_tier: liveTier,
            })
          }
          status = liveStatus
          tier = liveTier
        }
      } catch (stripeErr) {
        // Stripe lookup failed — fall back to the cached profile values rather
        // than failing the whole request.
        console.warn('Stripe subscription reconcile failed, using cached profile:', stripeErr)
      }
    }

    res.json({
      data: {
        status,
        tier,
        has_customer: !!customerId,
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
    Sentry.captureException(err, {
      tags: { area: 'stripe_webhook', reason: 'signature_verification' },
    })
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
    Sentry.captureException(new Error(`Stripe webhook idempotency insert failed: ${dedupError.message}`), {
      tags: { area: 'stripe_webhook', event_id: event.id, event_type: event.type },
    })
    res.status(500).json({ error: 'Failed to record event' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        const tier = session.metadata?.tier

        if (!userId || !isPaidTier(tier)) {
          throw new Error(`Checkout session ${session.id} is missing valid paid-tier metadata`)
        }

        if (userId) {
          await updateProfileByUserId(supabase, userId, {
            subscription_status: 'active',
            subscription_tier: tier,
            stripe_customer_id: session.customer as string,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await updateProfileByCustomerId(supabase, customerId, {
          subscription_status: 'canceled',
          subscription_tier: 'free',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await updateProfileByCustomerId(supabase, customerId, {
          subscription_status: 'past_due',
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = mapStripeStatus(subscription.status)
        const priceId = subscription.items?.data?.[0]?.price?.id

        await updateProfileByCustomerId(supabase, customerId, {
          subscription_status: status,
          subscription_tier: entitlementTier(status, priceId),
        })
        break
      }
    }
  } catch (err) {
    console.error('Stripe webhook handler failed:', err)
    Sentry.captureException(err, {
      tags: { area: 'stripe_webhook', event_id: event.id, event_type: event.type },
    })
    await supabase.from('processed_stripe_events').delete().eq('event_id', event.id)
    res.status(500).json({ error: 'Webhook handler failed' })
    return
  }

  res.json({ received: true })
})

export default router
