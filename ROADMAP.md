# AI Brand Monitor Roadmap

> Last updated: 2026-05-05. Keep this file updated as items are completed.
> Important: after any roadmap item ships, check it off in this file in the same change set.

---

## Status: Pre-Launch

The core loop (sign up -> business entry -> scan -> results -> pay) works end-to-end. The remaining launch work is split into core reliability blockers and report value/conversion blockers. Do not build speculative Phase 2 features until the launch blockers below are complete.

---

## Non-Negotiables (fix before launch)

### 1. Stuck scan recovery
- [x] Add a 5-minute timeout that flips `status` to `failed` if a scan never completes
- [x] Surface an error state + retry button in the dashboard UI
- **Files:** `backend/routes/scan.ts`, `frontend/src/pages/dashboard.tsx`

### 2. Password reset
- [x] Add "Forgot password?" link on auth page
- [x] Wire up `supabase.auth.resetPasswordForEmail()`
- [x] Handle `PASSWORD_RECOVERY` event to show new-password form
- [x] Custom branded email template (`supabase/templates/reset-password.html`)
- **Files:** `frontend/src/pages/auth.tsx`

### 3. Fix dashboard polling on terminal errors
- [x] Stop the 3s polling loop on terminal error states (e.g. `subscription_required`, `failed`)
- [x] Show appropriate error UI instead of infinite spinner
- [x] Reap orphaned `running` scans on backend startup so crashes don't leave users stuck
- [x] Paywall counts only `completed` scans so stuck rows don't consume a free scan
- **Files:** `frontend/src/pages/dashboard.tsx`, `backend/server.ts`, `backend/routes/scan.ts`

### 4. Stripe webhook idempotency
- [x] Store processed Stripe event IDs in DB
- [x] Check event ID before applying any webhook handler to prevent double-updates on retries
- **Files:** `backend/routes/stripe.ts`, `supabase/migrations/20260505000000_stripe_webhook_idempotency.sql`

### 5. Free tier race condition
- [x] Replace the two-step count+insert check with an atomic Postgres function or DB-level constraint
- **Files:** `backend/routes/scan.ts`, `supabase/migrations/20260428000000_generated_free_scan_flow.sql`

### 6. Implement Gemini support
- [x] Add Gemini to `queryEngine.ts` using `@google/genai` and `GEMINI_API_KEY`
- [x] Keep dashboard platform rendering backed by real scan results
- **Files:** `backend/services/queryEngine.ts`, `backend/services/supabase.ts`, `backend/package.json`

### 7. Scan history + re-scan UX
- [ ] Build a scan history list on the dashboard using existing `GET /api/results/business/:id`
- [ ] Add a "Run New Scan" button - this is the core retention mechanic
- **Files:** `frontend/src/pages/dashboard.tsx`

### 8. Subscription management page
- [ ] Integrate Stripe Customer Portal (`stripe.billingPortal.sessions.create`)
- [ ] Add a new frontend page/route for subscription management (upgrade, downgrade, cancel)
- **Files:** New route in `backend/routes/stripe.ts`, new page in `frontend/src/pages/`

---

## Report Value + Freemium Conversion (fix before launch)

### P1. Surface the aha moment in the report
- [x] Return `raw_response` from `GET /api/results/:scanId`
- [x] Show the full raw AI response for each query/platform result, especially Perplexity on free scans
- [x] Rewrite score details in plain English: "Mentioned in X of Y results", not raw point totals
- [x] Add aggregate sentiment summary for the scan
- [x] Fix free-tier platform display: show one full Perplexity card plus locked ChatGPT, Claude, and Gemini cards
- **Files:** `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`

### P2. Make competitor tracking real
- [x] Extend `analyzeMention()` to extract `competitors_mentioned`
- [x] Save competitor names into `scan_results.competitors_mentioned`
- [x] Show competitor names in the dashboard report when returned by analysis
- [ ] Use competitor counts in locked free-tier teasers
- **Files:** `backend/services/queryEngine.ts`, `backend/routes/scan.ts`, `frontend/src/pages/dashboard.tsx`

### P3. Preserve the exact business variant AI used
- [ ] Add `variant_used` to `scan_results`
- [ ] Save `analysis.variant_used` during scans
- [ ] Return and display the exact variant used in the report
- **Files:** `supabase/migrations/`, `backend/services/supabase.ts`, `backend/routes/scan.ts`, `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`

### P4. Add pre-scan query review
- [ ] Free users see the five auto-generated queries as a read-only preview before the scan starts
- [ ] Starter/Growth users can edit generated queries before running the scan
- [ ] Avoid burning a free scan until the user confirms the preview
- **Files:** `frontend/src/components/hero-form.tsx`, `frontend/src/pages/dashboard.tsx`, `backend/routes/business.ts`

### P5. Add rule-based recommendations
- [ ] Generate two free Perplexity-specific recommendations from scan data
- [ ] Generate Starter recommendations by platform
- [ ] Show locked additional recommendations in the free report
- **Files:** `backend/services/`, `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`

### P6. Improve scoring clarity and quality
- [ ] Replace cliff-style position scoring with a smoother curve
- [ ] Add score confidence based on number of query/platform data points (Growth-exclusive in UI)
- [ ] Add industry benchmark score copy/data model for Growth
- **Files:** `backend/services/scorer.ts`, `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`

### P7. Align pricing tiers for launch
- [ ] Drop Agency from launch pricing UI and checkout options
- [ ] Launch with Free, Starter, and Growth only
- [ ] Default pricing page billing toggle to annual
- [ ] Set annual prices: Starter $24/mo billed annually, Growth $41/mo billed annually
- [ ] Mark Growth as "Most Popular"
- [ ] Use loss-aversion copy for paid features
- [ ] Add social proof/testimonials to pricing page
- **Files:** `frontend/src/components/pricing.tsx`, `frontend/src/pages/pricing.tsx`, `backend/routes/stripe.ts`

---

## Strong-to-Have (before or shortly after launch)

- [ ] **Rate limiting** - Add `express-rate-limit` to all API endpoints. Prevents OpenAI bill abuse.
- [ ] **Startup env validation** - Validate all required env vars on boot. Fail fast, not on first use.
- [ ] **Error tracking** - Add Sentry (free tier) so broken scans in production are visible.

---

## Pre-Deploy Checklist (do BEFORE first production deploy)

Currently developing against Stripe **test mode** (sandbox). Before flipping to live payments, all of the following must be done. Skipping any of these will either break payments or accept real cards in a broken pipeline.

### Stripe — switch from test to live mode
- [ ] Activate the Stripe account (business info, tax info, bank account for payouts) in the Stripe dashboard
- [ ] Toggle dashboard to **Live mode** and recreate Products + Prices for Starter and Growth (test-mode price IDs do NOT carry over)
- [ ] Copy the new live `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_GROWTH` price IDs into the production env
- [ ] Replace `STRIPE_SECRET_KEY` in production env with the live `sk_live_...` key
- [ ] Replace `VITE_STRIPE_PUBLISHABLE_KEY` (or equivalent) in the frontend env with the live `pk_live_...` key
- [ ] Create a **live-mode** webhook endpoint in Stripe pointed at the production backend URL (e.g. `https://api.yourdomain.com/api/stripe/webhook`)
- [ ] Subscribe that endpoint to the same events the backend handles: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`
- [ ] Copy the live webhook **signing secret** (`whsec_...`) into production env as `STRIPE_WEBHOOK_SECRET`. This is NOT the same as the local `stripe listen` secret used in development
- [ ] Make a real $0.50 test purchase end-to-end after deploy and confirm `profiles.subscription_status` flips to `active`

### Supabase — production database
- [ ] Run all migrations in `supabase/migrations/` against the production Supabase project, in filename order
- [ ] Confirm `processed_stripe_events` table exists in production before deploying the new webhook code (deploying code first will 500 every webhook until the migration runs)
- [ ] Production env has the production `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — never the local dev project's keys

### General env hygiene
- [ ] `FRONTEND_URL` in backend env points to the live frontend domain (used for Stripe success/cancel redirects)
- [ ] CORS origin in `backend/server.ts` allows the production frontend domain
- [ ] No `whsec_...` from `stripe listen` is committed or in production env — those are local-dev-only and rotate every CLI session

---

## Recommended Schedule

| Week | Focus |
|------|-------|
| Week 1 | Finish original reliability blockers plus P1 report value fixes. |
| Week 2 | Competitor extraction, query review, recommendations, and pricing alignment. |
| Soft launch | Invite 10 known users. Watch activation, scan completion, upgrade clicks, and API cost. |
| Post soft-launch | Phase 2 features only after the core loop and free-to-paid path are stable. |

---

## Tier Strategy For Launch

### Free - AI Visibility Snapshot
- [ ] 1 lifetime scan, Perplexity only
- [ ] 5 auto-generated queries with read-only pre-scan preview
- [ ] Full Perplexity raw responses
- [ ] Plain-English score explanation
- [ ] 2 Perplexity-specific recommendations
- [ ] Locked cards for ChatGPT, Claude, and Gemini
- [ ] No recurring scans, competitor names, scan history, or trend data

### Starter - $29/mo or $24/mo billed annually
- [ ] All configured platforms: Perplexity, ChatGPT, Claude, Gemini
- [ ] Weekly automated scans
- [ ] 10 queries: 5 auto + 5 custom
- [ ] Full query editor before scan runs
- [ ] Competitor extraction up to 3 tracked competitors
- [ ] 4 per-platform recommendations per scan
- [ ] Sentiment summary across all platforms
- [ ] 1 business profile

### Growth - $49/mo or $41/mo billed annually
- [ ] Everything in Starter
- [ ] Daily automated scans
- [ ] 20 custom queries
- [ ] Track up to 5 competitors with scores
- [ ] Historical trend graphs
- [ ] Weekly email digest
- [ ] Industry benchmark
- [ ] Sentiment trend over time
- [ ] Confidence indicator per score

### Agency - dropped for launch
- [x] Do not launch Agency until multi-business profiles exist in schema, backend, and UI.

---

## Phase 2 - Real Product (after MVP is stable)

Do NOT start these until launch blockers are done and real users have used the product for at least 2 weeks.

- [ ] Automated recurring scans (weekly/daily cadence)
- [ ] Historical trend graphs
- [ ] Competitor radar
- [ ] Email digest reports
- [ ] Multi-tier usage enforcement
- [ ] Multi-business profiles for future Agency tier

---

## Phase 3 - Growth Engine

- [ ] AI optimization guides
- [ ] White-label / agency features
- [ ] Embeddable "AI Visibility Badge"
- [ ] API access for agencies

---

## Floor / Ceiling

**Floor (if shipped now):** Users can complete a scan, but the report still hides the most compelling evidence, gives too little guidance, and leaves pricing credibility exposed.

**Ceiling (if executed cleanly):** The free scan proves the value immediately, locked platform data creates specific curiosity, and Starter/Growth have clear reasons to upgrade. At 200 paying customers, this can become a meaningful SaaS business with manageable marginal scan cost.
