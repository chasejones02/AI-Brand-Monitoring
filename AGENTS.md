# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Project Overview

AI Brand Monitor is a SaaS tool that tracks how businesses appear in AI-generated answers across ChatGPT, Codex, Perplexity, and Gemini. Users sign up, enter their business name and target queries, and get a dashboard showing their AI visibility score, query-by-query breakdowns, competitor analysis, trend graphs, and actionable recommendations.

**Target users:** Small and medium businesses — local services, e-commerce, consultants, small SaaS, and marketing agencies.

**Business model:** Subscription tiers at $29/mo (Starter), $49/mo (Growth), $149/mo (Agency).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (Postgres + Auth + RLS) |
| AI Queries | OpenAI API, Anthropic API, Perplexity API |
| Payments | Stripe |
| Hosting | Vercel (frontend) + Railway/Render (backend) |
| Auth | Supabase Auth |

---

## Quick Reference Commands

```bash
# Frontend dev (http://localhost:5173)
cd frontend && npm run dev

# Backend dev (http://localhost:3001, hot reload via tsx)
cd backend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Lint frontend
cd frontend && npm run lint
```

No test runner is configured yet.

---

## Frontend Rules — MANDATORY

**Every frontend task MUST use the `frontend-design` skill.**

Before writing any frontend code, always read and follow `/mnt/skills/public/frontend-design/SKILL.md` (or `/mnt/skills/user/frontend-design/SKILL.md`). This is non-negotiable.

For complex multi-component UIs (dashboards, multi-page flows, anything needing routing or heavy state management), also read and follow `/mnt/skills/user/web-artifacts-building/SKILL.md`.

### Design Direction

This product targets busy business owners who want clarity, not complexity. The aesthetic should be:

- **Tone:** Clean, confident, and editorial — not playful, not corporate. Think "Bloomberg Terminal meets a well-designed indie SaaS." Data-forward but never cluttered.
- **Typography:** Use distinctive, characterful fonts. Never use Inter, Roboto, Arial, or system fonts. Pair a sharp display font (e.g., Instrument Serif, Playfair Display, Fraunces) with a clean sans-serif body font (e.g., Satoshi, General Sans, Outfit). Vary choices across pages — don't converge on one pairing everywhere. The app currently uses `Outfit`.
- **Color:** Dark-mode-first with sharp accent colors. Avoid purple gradients on white backgrounds and all other generic "AI slop" patterns. Use CSS variables for theming (`--bg`, `--surface`, `--accent`, `--green`, `--red`, `--text` etc. in `globals.css`). Current accent is `#f0a500` (orange). One dominant color + one accent is better than 5 evenly distributed colors.
- **Layout:** Asymmetry is welcome. Use generous whitespace. The dashboard should feel spacious, not cramped. Grid-breaking elements and overlapping cards are encouraged where they improve hierarchy.
- **Motion:** Staggered reveals on page load, smooth transitions between states, subtle hover effects. Don't overdo micro-interactions — focus on a few high-impact moments. Prefer CSS animations for HTML; use Framer Motion for React.
- **Backgrounds & texture:** Add depth with noise textures, subtle gradients, or geometric patterns. Never default to flat solid white or flat solid dark backgrounds. The body currently uses a `::before` noise texture overlay.

### What to NEVER do in frontend

- Never use Inter, Roboto, Arial, Space Grotesk, or system fonts
- Never use purple-gradient-on-white color schemes
- Never use cookie-cutter component patterns (generic card grids, centered hero + 3-column features)
- Never produce "AI slop" — every page should look intentionally designed for this specific product
- Never use localStorage or sessionStorage in artifacts (use React state or in-memory storage)
- Never create separate CSS/JS files for artifacts — everything in a single file

---

## Architecture

### Project Structure

```
ai-brand-monitor/
├── frontend/src/
│   ├── App.tsx                    # React Router setup + ProtectedRoute
│   ├── pages/
│   │   ├── landing.tsx            # Marketing landing page
│   │   ├── auth.tsx               # Login/signup split-panel
│   │   ├── dashboard.tsx          # Scan results with polling
│   │   └── success.tsx            # Post-checkout confirmation
│   ├── components/                # Section components for landing page
│   │   ├── hero-form.tsx          # Main signup + scan trigger form
│   │   ├── report-preview.tsx     # Mock report preview
│   │   └── pricing.tsx            # Pricing tier cards
│   ├── contexts/auth-context.tsx  # Supabase session state
│   ├── hooks/use-scroll-reveal.ts # IntersectionObserver fade-up
│   ├── lib/
│   │   ├── api.ts                 # Authenticated fetch wrappers for all endpoints
│   │   └── supabase.ts            # Supabase client init (VITE_SUPABASE_*)
│   └── styles/globals.css         # All CSS: variables, animations, layout
├── backend/
│   ├── server.ts                  # Express app, routes, CORS
│   ├── middleware/auth.ts         # requireAuth + requireSubscription
│   ├── routes/
│   │   ├── scan.ts                # POST /api/scan
│   │   ├── business.ts            # POST/GET /api/business
│   │   ├── results.ts             # GET /api/results/:scanId, /business/:id
│   │   └── stripe.ts              # POST /api/stripe/*
│   └── services/
│       ├── queryEngine.ts         # All AI platform calls + mention analysis
│       ├── scorer.ts              # Scoring algorithm
│       └── supabase.ts            # Supabase admin client + TypeScript types
└── supabase/migrations/
    └── 20260313000000_initial_schema.sql
```

### Frontend Routes

```
/                       → LandingPage (public)
/auth                   → AuthPage (redirects to /dashboard if logged in)
/dashboard?scanId=<id>  → DashboardPage (protected)
/success                → SuccessPage (post-Stripe checkout)
```

`DashboardPage` reads `scanId` from the URL query param and polls `GET /api/results/:scanId` every 3 seconds until `status === 'completed'`.

### API Routes

```
GET  /health
POST /api/business            → create business + queries (requireAuth)
GET  /api/business            → list user's businesses with queries (requireAuth)
POST /api/scan                → trigger scan (requireAuth)
GET  /api/results/:scanId     → poll scan status + results (requireAuth)
GET  /api/results/business/:id → scan history for a business (requireAuth)
POST /api/stripe/create-checkout
POST /api/stripe/webhook
```

All responses follow `{ data, error }` shape.

### Database Schema (key tables)

**profiles** — extends `auth.users`; holds `subscription_status` ('free'|'active'|'canceled'|'past_due'), `subscription_tier`, `stripe_customer_id`. Auto-created by trigger on signup.

**businesses** → **queries** → **scans** → **scan_results** — cascade deletes all the way down.

**scan_results** stores one row per `(scan_id, query_id, platform)` with `raw_response`, `mentioned`, `mention_position`, `sentiment`, `mention_score`, `position_score`, `sentiment_score`.

RLS is enabled on all tables. Backend uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) for write operations during scan execution.

### Scan Data Flow

```
1. hero-form.tsx: POST /api/business → business_id
2. hero-form.tsx: POST /api/scan { business_id } → scan_id (202, async)
3. Redirect to /dashboard?scanId=<scan_id>
4. dashboard.tsx polls GET /api/results/:scanId every 3s

Backend async (runScan):
  For each query:
    → runQueryOnPlatforms() — Promise.allSettled across all platforms
    → analyzeMention() — gpt-4o-mini JSON analysis (falls back to string match)
    → scoreResult() — mention + position + sentiment scores
  → calculateVisibilityScore() — weighted average across all results
  → scan.status = 'completed'
```

### Platform Strategy

`getAvailablePlatforms()` checks env keys with `isRealKey()` (non-placeholder, length > 20).

**Free scans:** Perplexity only. OpenAI lacks web search and won't mention small local businesses, which would unfairly deflate the score. Falls back to all platforms if Perplexity isn't configured.

**Paid scans:** All configured platforms. Currently: OpenAI (`gpt-4o-mini`) + Perplexity (`sonar` with system prompt). Anthropic key is placeholder — activate by replacing `REPLACE_ME` in `.env`.

Perplexity uses the OpenAI SDK with `baseURL: 'https://api.perplexity.ai'` and a system message instructing it to name specific businesses. `max_tokens: 1024` (higher than OpenAI/Anthropic at 500 to avoid mid-list truncation).

### Authentication Flow

1. Supabase Auth issues JWT on login/signup
2. Frontend stores session in Supabase SDK (not localStorage)
3. `authFetch()` in `lib/api.ts` reads the session and injects `Authorization: Bearer <token>`
4. `requireAuth` middleware verifies JWT, attaches `req.userId`

---

## AI Query Engine Notes

- Cache results aggressively — same query to same platform within 24h should return cached data
- Run multiple queries per prompt and aggregate to handle AI response variance
- Store raw AI responses alongside parsed/scored results for debugging
- Respect rate limits on all AI APIs — use exponential backoff
- Log API costs per user for margin tracking

### Two-Pass Scoring (implemented)

Every scan uses a two-step process per query result:

1. **Query pass** — send the user's query to the AI platform (OpenAI, Anthropic, Perplexity) and capture the raw response. The query is sent verbatim — no prompt injection — to simulate a real user search.
2. **Analysis pass** — send a second `gpt-4o-mini` call at `temperature: 0` asking it to detect whether the business is mentioned, including name variations, abbreviations, parent brands, and compound names (e.g. "Google Chrome" counts as a mention of "Chrome").

The analysis pass returns structured JSON: `mentioned`, `variant_used`, `position_index`, `sentiment`. This replaces the old regex substring match, which was too brittle for real business names.

If the analysis call fails, `fallbackMentionAnalysis()` in `queryEngine.ts` kicks in automatically using string-match logic (less accurate — watch for the `console.warn`).

---

## Scoring Algorithm (v1 — keep simple)

```
AI Visibility Score = (mention_score + position_score + sentiment_score) / max_possible * 100

mention_score:   +10 if business is mentioned (via AI analysis, not regex)
position_score:  +5 if mentioned first, +3 if top 3, +1 if mentioned at all
sentiment_score: +3 positive, +1 neutral, -2 negative
Max per result:  18 points
```

Score ranges:
- 0–20:   Not Visible — AI almost never mentions this business for these queries
- 21–40:  Rarely Visible — occasional mentions, not in top results
- 41–60:  Partially Visible — appearing sometimes, mixed positioning
- 61–80:  Visible — regularly mentioned, often in top 3
- 81–100: Highly Visible — consistently first or second, positive framing

Normalize across all target queries × all platforms. This will evolve — don't over-engineer v1.

---

## Coding Conventions

- **TypeScript** everywhere (frontend and backend)
- **Functional components** with hooks — no class components
- **Named exports** for components, default exports only for pages
- **Error boundaries** around major sections of the dashboard
- **API responses** follow a consistent shape: `{ data, error }`
- File names: `kebab-case` for files, `PascalCase` for components
- Keep components small — if a component exceeds ~150 lines, break it up

---

## Key Features & Build Phases

### Phase 1 — MVP (Current Focus)
- User signup/auth (Supabase Auth)
- Business name + target query input form
- Query engine: Perplexity (free) + OpenAI & Perplexity (paid)
- Results page: mention detection, position, sentiment
- Basic AI Visibility Score (0–100)
- Stripe checkout — 3 tiers ($29/$49/$149)

**Ship trigger:** A stranger can sign up, pay, enter their business, and get a useful report with zero manual intervention.

### Phase 2 — Real Product
- All 4 AI platforms (ChatGPT, Codex, Gemini, Perplexity)
- Automated recurring scans (weekly/daily)
- Historical tracking + trend graphs
- Competitor radar
- Email reports
- Multi-tier pricing enforcement

### Phase 3 — Growth Engine
- Actionable recommendations engine
- AI optimization guides
- White-label / agency features
- Embeddable "AI Visibility Badge"
- API access

---

## User Preferences & Corrections Log

**This section is a living document.** Any time the user provides feedback, corrections, or style preferences during development, Codex MUST update this section immediately by editing this file. Before starting any task, Codex should re-read this section to avoid repeating past mistakes.

### How to use this section
1. When the user says something like "don't do X" or "I prefer Y" or "that's wrong, it should be Z" — add an entry below.
2. Each entry should include the date, what was wrong, and what the correct behavior is.
3. Before generating any code or content, scan this list and follow every active preference.

### Active Preferences

_No preferences recorded yet. Entries will be added as the user provides feedback._

---

## Reminders for Codex

1. **Always read the frontend-design skill before any frontend work.** No exceptions.
2. **Always check the User Preferences section above before starting any task.**
3. **After user feedback, update the User Preferences section FIRST, then fix the code.**
4. Ship working code. Don't over-abstract early. Inline is fine until patterns emerge.
5. The MVP ship trigger is: a stranger can sign up, pay, enter queries, and get a report. Build toward that and nothing else until it's done.
6. When in doubt about design choices, lean toward bold and opinionated over safe and generic.
7. **Before starting any task, check `ROADMAP.md` in the repo root.** It contains the prioritized list of non-negotiable fixes that must be completed before launch. Do not build new features if unchecked items remain in the Non-Negotiables section.
