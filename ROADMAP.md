# AI Brand Monitor — Roadmap

> Last audited: 2026-04-02. Keep this file updated as items are completed.

---

## Status: Pre-Launch

The core loop (sign up → business entry → scan → results → pay) works end-to-end. The 8 items below are non-negotiable before charging strangers. No new features until these are done.

---

## Non-Negotiables (fix before launch)

### 1. Stuck scan recovery
- [ ] Add a 5-minute timeout that flips `status` to `failed` if a scan never completes
- [ ] Surface an error state + retry button in the dashboard UI
- **Files:** `backend/routes/scan.ts`, `frontend/src/pages/dashboard.tsx`

### 2. Password reset ✓
- [x] Add "Forgot password?" link on auth page
- [x] Wire up `supabase.auth.resetPasswordForEmail()`
- [x] Handle `PASSWORD_RECOVERY` event to show new-password form
- [x] Custom branded email template (`supabase/templates/reset-password.html`)
- **Files:** `frontend/src/pages/auth.tsx`

### 3. Fix dashboard polling on terminal errors
- [ ] Stop the 3s polling loop on terminal error states (e.g. `subscription_required`, `failed`)
- [ ] Show appropriate error UI instead of infinite spinner
- **Files:** `frontend/src/pages/dashboard.tsx` (~line 85–107)

### 4. Stripe webhook idempotency
- [ ] Store processed Stripe event IDs in DB
- [ ] Check event ID before applying any webhook handler to prevent double-updates on retries
- **Files:** `backend/routes/stripe.ts`

### 5. Free tier race condition
- [ ] Replace the two-step count+insert check with an atomic Postgres function or DB-level constraint
- **Files:** `backend/routes/scan.ts` (~line 33–60)

### 6. Remove Gemini references
- [ ] Remove all Gemini references from `queryEngine.ts`, types, and schema until it is properly implemented
- [ ] Gemini is currently referenced but never called — will render `undefined` in the dashboard
- **Files:** `backend/services/queryEngine.ts`, `backend/services/supabase.ts`, `supabase/migrations/`

### 7. Scan history + re-scan UX
- [ ] Build a scan history list on the dashboard using existing `GET /api/results/business/:id`
- [ ] Add a "Run New Scan" button — this is the core retention mechanic
- **Files:** `frontend/src/pages/dashboard.tsx`

### 8. Subscription management page
- [ ] Integrate Stripe Customer Portal (`stripe.billingPortal.sessions.create`)
- [ ] Add a new frontend page/route for subscription management (upgrade, downgrade, cancel)
- **Files:** New route in `backend/routes/stripe.ts`, new page in `frontend/src/pages/`

---

## Strong-to-Have (before or shortly after launch)

- [ ] **Rate limiting** — Add `express-rate-limit` to all API endpoints. Prevents OpenAI bill abuse.
- [ ] **Startup env validation** — Validate all required env vars on boot. Fail fast, not on first use.
- [ ] **Error tracking** — Add Sentry (free tier) so broken scans in production are visible.

---

## Recommended Schedule

| Week | Focus |
|------|-------|
| Week 1 | Complete all 8 non-negotiables. Zero new features. |
| Week 2 | Rate limiting, env validation, Sentry. Soft-launch to 10 known users. Watch what breaks. |
| Post soft-launch | Phase 2 features only after core loop is airtight. |

---

## Phase 2 — Real Product (after MVP is stable)

Do NOT start these until the 8 non-negotiables are done and you've had real users for at least 2 weeks.

- [ ] All 4 AI platforms — add Gemini and Claude properly
- [ ] Automated recurring scans (weekly/daily cadence)
- [ ] Historical trend graphs
- [ ] Competitor radar
- [ ] Email digest reports
- [ ] Multi-tier usage enforcement

---

## Phase 3 — Growth Engine

- [ ] Actionable recommendations engine
- [ ] AI optimization guides
- [ ] White-label / agency features
- [ ] Embeddable "AI Visibility Badge"
- [ ] API access for agencies

---

## Floor / Ceiling

**Floor (if shipped now):** Scans get stuck, free tier is bypassable, no password reset, no retention mechanic. Users churn silently. MRR plateaus fast.

**Ceiling (if executed cleanly):** Concept is well-timed — AI search is eating SEO, SMBs are anxious, no clear incumbent. Agency tier at $149/mo is defensible. At 200 paying customers = $20K+ MRR with minimal marginal cost. Achievable within 12 months with tight execution on retention (weekly scans, trend graphs, email digests).
