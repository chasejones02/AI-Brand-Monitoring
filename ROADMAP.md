# AI Brand Monitor Roadmap

> Last updated: 2026-06-12. Keep this file updated as items are completed.
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
- [x] Build a scan history list on the dashboard using existing `GET /api/results/business/:id`
- [x] Add a "Run New Scan" button - this is the core retention mechanic
- [x] Add tier-based quota system. **Now a per-user rolling-30-day cap (Starter 25, Growth 40), changed 2026-06-12 from the original daily model for margin safety** — see `supabase/migrations/20260612000000_monthly_scan_quota.sql`. Note: RPC still returns a `daily_limit` column / `daily_quota_exceeded` reason code that are monthly semantically (legacy names kept to avoid churning the API contract).
- [x] Add trend chart, per-platform sparklines, per-query trend rows
- **Files:** `frontend/src/pages/dashboard.tsx`, `frontend/src/components/{quota-pill,trend-chart,platform-sparkline,query-trend-row,scan-history-list,history-trends-section}.tsx`, `backend/routes/{quota,scan,results}.ts`, `supabase/migrations/20260510000000_scan_quotas.sql`

### 8. Subscription management page
- [x] Integrate Stripe Customer Portal (`stripe.billingPortal.sessions.create`)
- [x] Add a new frontend page/route for subscription management (upgrade, downgrade, cancel)
- **Files:** New route in `backend/routes/stripe.ts`, new page in `frontend/src/pages/account.tsx`

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
- [x] Use competitor counts in locked free-tier teasers
- **Files:** `backend/services/queryEngine.ts`, `backend/routes/scan.ts`, `frontend/src/pages/dashboard.tsx`

### P3. Preserve the exact business variant AI used
- [x] Add `variant_used` to `scan_results`
- [x] Save `analysis.variant_used` during scans
- [x] Return and display the exact variant used in the report
- **Files:** `supabase/migrations/`, `backend/services/supabase.ts`, `backend/routes/scan.ts`, `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`

### P4. Add pre-scan query review
- [x] Free users see the five auto-generated queries as a read-only preview before the scan starts
- [x] Starter/Growth users can edit generated queries before running the scan
- [x] Avoid burning a free scan until the user confirms the preview
- **Files:** `frontend/src/components/hero-form.tsx`, `frontend/src/pages/dashboard.tsx`, `backend/routes/business.ts`

### P5. Add rule-based recommendations
- [x] Generate 7 recommendations per scan via single gpt-4o-mini call (non-fatal, scan completes regardless)
- [x] Store on `scans.recommendations` (JSONB); tier-gate at API layer: free=1, starter=3, growth=7
- [x] Show locked cards with visible title + blurred body + upgrade CTA
- **Files:** `backend/services/recommendationEngine.ts`, `backend/routes/scan.ts`, `backend/routes/results.ts`, `frontend/src/components/recommendations-panel.tsx`

### P6. Improve scoring clarity and quality
- [x] Replace cliff-style position scoring with a smoother curve
- [~] ~~Score confidence indicator~~ — deferred. Not adding.
- [~] ~~Industry benchmark for Growth~~ — deferred until we have real scan data to compute meaningful averages. Hardcoded copy would be dishonest at launch.
- **Files:** `backend/services/scorer.ts`, `backend/routes/results.ts`, `frontend/src/pages/dashboard.tsx`, `supabase/migrations/20260518000000_smooth_position_score.sql`

### P7. Align pricing tiers for launch
- [x] Drop Agency from launch pricing UI and checkout options
- [x] Launch with Free, Starter, and Growth only
- [x] Default pricing page billing toggle to annual
- [x] Set annual prices: Starter $24/mo billed annually, Growth $41/mo billed annually
- [x] Mark Growth as "Most Popular"
- [x] Use loss-aversion copy for paid features
- [x] Add social proof/testimonials to pricing page
- **Files:** `frontend/src/components/pricing.tsx`, `frontend/src/pages/pricing.tsx`, `backend/routes/stripe.ts`

---

## Strong-to-Have (before or shortly after launch)

- [x] **Rate limiting** - `express-rate-limit` applied: global 100/min floodwall on `/api/*` (skips Stripe webhook), 5/min on `/api/scan`, 10/min on `/api/stripe/create-checkout`. `trust proxy` set to 1 for Railway/Render/Vercel.
- [x] **Startup env validation** - Zod schema in `backend/config/env.ts` validates all env vars at module-init time. Exits with a per-field error list if anything is missing, malformed, or still set to a `.env.example` placeholder. Enforces Stripe key prefixes (`sk_test_`/`sk_live_`, `whsec_`, `price_`) and requires at least one AI provider key. Warns when `NODE_ENV=production` is paired with test Stripe key or localhost frontend URL.
- [x] **Error tracking** - Sentry wired via `backend/instrument.ts` (loads after env validation, before any instrumented module). Express error handler mounted, manual `captureException` calls added to the silent-failure spots: background `runScan` rejection, scan timeout, recommendation engine failure, Stripe webhook signature/idempotency errors. `beforeSend` scrubs request bodies, auth/cookie headers, and user emails. `SENTRY_DSN` is optional — SDK no-ops when unset.

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

### AI provider keys — separate prod keys
- [ ] Create a production-only `ANTHROPIC_API_KEY` at console.anthropic.com (separate from local dev key so they can be revoked independently)
- [ ] Confirm Anthropic billing is active and a usage limit is set (Haiku 4.5 is cheap but a runaway loop could still rack up cost)
- [ ] Repeat for `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` — each provider should have its own prod key with a usage cap

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
- [x] All configured platforms: Perplexity, ChatGPT, Claude, Gemini
- [x] 25 on-demand scans per rolling 30-day window (was 1/day; changed 2026-06-12)
- [~] ~~10 queries: 5 auto + 5 custom~~ — capped at **5 queries per tracking set** (editor + creation). Per-tier query-count differentiation is intentionally deferred: each extra query multiplies per-scan API cost, which would break the monthly-cap margin math.
- [ ] Full query editor before scan runs
- [ ] Competitor extraction up to 3 tracked competitors
- [ ] 4 per-platform recommendations per scan
- [ ] Sentiment summary across all platforms
- [ ] 1 business profile

### Growth - $49/mo or $41/mo billed annually
- [ ] Everything in Starter
- [x] 40 on-demand scans per rolling 30-day window (was 3/day; changed 2026-06-12)
- [~] ~~20 custom queries~~ — capped at 5 per tracking set (see Starter note; deferred for cost reasons)
- [x] Track up to 5 competitors with scores
- [x] Historical trend graphs (overall + per-platform + per-query)
- [~] ~~Weekly email digest~~ — removed from launch product 2026-06-12 (not built; depends on automated recurring scans, which we are not shipping unless users ask)
- [ ] Sentiment trend over time

### Agency - dropped for launch
- [x] Do not launch Agency until multi-business profiles exist in schema, backend, and UI.

---

## Phase 2 - Real Product (after MVP is stable)

Do NOT start these until launch blockers are done and real users have used the product for at least 2 weeks.

- ~~Automated recurring scans~~ — superseded by on-demand quota model (see #7).
- [x] Historical trend graphs (shipped with #7)
- [ ] Competitor radar (richer view; basic competitor extraction already shipped)
- [ ] Email digest reports — deferred; recurring-scan UI/copy was pulled from the product 2026-06-12, build only if users ask
- [ ] Multi-tier usage enforcement (mostly handled by quota RPC; query-count limits still TODO)
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
