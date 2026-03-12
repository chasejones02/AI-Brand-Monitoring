# CLAUDE.md — AI Brand Monitor

## Project Overview

AI Brand Monitor is a SaaS tool that tracks how businesses appear in AI-generated answers across ChatGPT, Claude, Perplexity, and Gemini. Users sign up, enter their business name and target queries, and get a dashboard showing their AI visibility score, query-by-query breakdowns, competitor analysis, trend graphs, and actionable recommendations.

**Target users:** Small and medium businesses — local services, e-commerce, consultants, small SaaS, and marketing agencies.

**Business model:** Subscription tiers at $29/mo (Starter), $49/mo (Growth), $149/mo (Agency).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Node.js or Python (FastAPI) |
| Database | Supabase (Postgres) |
| AI Queries | OpenAI API, Anthropic API, Google Gemini API, Perplexity API |
| Job Scheduler | Cron jobs via Railway or Vercel |
| Payments | Stripe |
| Hosting | Vercel (frontend) + Railway/Render (backend) |
| Auth | Supabase Auth or Clerk |

---

## Frontend Rules — MANDATORY

**Every frontend task MUST use the `frontend-design` skill.**

Before writing any frontend code, always read and follow `/mnt/skills/public/frontend-design/SKILL.md` (or `/mnt/skills/user/frontend-design/SKILL.md`). This is non-negotiable.

For complex multi-component UIs (dashboards, multi-page flows, anything needing routing or heavy state management), also read and follow `/mnt/skills/user/web-artifacts-building/SKILL.md`.

### Design Direction

This product targets busy business owners who want clarity, not complexity. The aesthetic should be:

- **Tone:** Clean, confident, and editorial — not playful, not corporate. Think "Bloomberg Terminal meets a well-designed indie SaaS." Data-forward but never cluttered.
- **Typography:** Use distinctive, characterful fonts. Never use Inter, Roboto, Arial, or system fonts. Pair a sharp display font (e.g., Instrument Serif, Playfair Display, Fraunces) with a clean sans-serif body font (e.g., Satoshi, General Sans, Outfit). Vary choices across pages — don't converge on one pairing everywhere.
- **Color:** Dark-mode-first with sharp accent colors. Avoid purple gradients on white backgrounds and all other generic "AI slop" patterns. Use CSS variables for theming. One dominant color + one accent is better than 5 evenly distributed colors.
- **Layout:** Asymmetry is welcome. Use generous whitespace. The dashboard should feel spacious, not cramped. Grid-breaking elements and overlapping cards are encouraged where they improve hierarchy.
- **Motion:** Staggered reveals on page load, smooth transitions between states, subtle hover effects. Don't overdo micro-interactions — focus on a few high-impact moments. Prefer CSS animations for HTML; use Framer Motion for React.
- **Backgrounds & texture:** Add depth with noise textures, subtle gradients, or geometric patterns. Never default to flat solid white or flat solid dark backgrounds.

### What to NEVER do in frontend

- Never use Inter, Roboto, Arial, Space Grotesk, or system fonts
- Never use purple-gradient-on-white color schemes
- Never use cookie-cutter component patterns (generic card grids, centered hero + 3-column features)
- Never produce "AI slop" — every page should look intentionally designed for this specific product
- Never use localStorage or sessionStorage in artifacts (use React state or in-memory storage)
- Never create separate CSS/JS files for artifacts — everything in a single file

---

## Project Structure

```
ai-brand-monitor/
├── CLAUDE.md                  # This file
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route-level pages
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities, API clients
│   │   ├── styles/            # Global styles, CSS variables
│   │   └── App.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                   # API server
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic (query engine, scoring, etc.)
│   ├── jobs/                  # Scheduled query jobs
│   ├── models/                # Database models
│   └── server.ts (or main.py)
├── shared/                    # Shared types/constants
└── scripts/                   # Build, deploy, seed scripts
```

---

## Key Features & Build Phases

### Phase 1 — MVP (Current Focus)
- User signup/auth (Supabase Auth or Clerk)
- Business name + 5 target query input form
- Query engine: sends prompts to ChatGPT + one other AI platform
- Results page: mention detection, position, sentiment, competitors
- Basic AI Visibility Score (0–100)
- Stripe checkout — single $29/mo tier

**Ship trigger:** A stranger can sign up, pay, enter their business, and get a useful report with zero manual intervention.

### Phase 2 — Real Product
- All 4 AI platforms (ChatGPT, Claude, Gemini, Perplexity)
- Automated recurring scans (weekly/daily)
- Historical tracking + trend graphs
- Competitor radar
- Email reports
- Multi-tier pricing

### Phase 3 — Growth Engine
- Actionable recommendations engine
- AI optimization guides
- White-label / agency features
- Embeddable "AI Visibility Badge"
- API access

---

## Coding Conventions

- **TypeScript** everywhere (frontend and backend if Node)
- **Functional components** with hooks — no class components
- **Named exports** for components, default exports only for pages
- **Error boundaries** around major sections of the dashboard
- **API responses** follow a consistent shape: `{ data, error, meta }`
- **Environment variables** for all API keys — never hardcode secrets
- File names: `kebab-case` for files, `PascalCase` for components
- Keep components small — if a component exceeds ~150 lines, break it up

---

## AI Query Engine Notes

- Cache results aggressively — same query to same platform within 24h should return cached data
- Run multiple queries per prompt and aggregate to handle AI response variance
- Store raw AI responses alongside parsed/scored results for debugging
- Respect rate limits on all AI APIs — use exponential backoff
- Log API costs per user for margin tracking

---

## Scoring Algorithm (v1 — keep simple)

```
AI Visibility Score = (mention_score + position_score + sentiment_score) / max_possible * 100

mention_score:   +10 per platform that mentions the business
position_score:  +5 if mentioned first, +3 if top 3, +1 if mentioned at all
sentiment_score: +3 positive, +1 neutral, -2 negative
```

Normalize across all target queries. This will evolve — don't over-engineer v1.

---

## User Preferences & Corrections Log

**This section is a living document.** Any time the user provides feedback, corrections, or style preferences during development, Claude MUST update this section immediately by editing this file. Before starting any task, Claude should re-read this section to avoid repeating past mistakes.

### How to use this section
1. When the user says something like "don't do X" or "I prefer Y" or "that's wrong, it should be Z" — add an entry below.
2. Each entry should include the date, what was wrong, and what the correct behavior is.
3. Before generating any code or content, scan this list and follow every active preference.

### Active Preferences

_No preferences recorded yet. Entries will be added as the user provides feedback._

<!-- 
TEMPLATE FOR NEW ENTRIES:

### [YYYY-MM-DD] — Short description
- **What happened:** Claude did X
- **What the user wants instead:** Y
- **Applies to:** frontend / backend / design / general
-->

---

## Quick Reference Commands

```bash
# Frontend dev
cd frontend && npm run dev

# Backend dev
cd backend && npm run dev   # or: uvicorn main:app --reload

# Build frontend for production
cd frontend && npm run build

# Run scheduled query jobs manually
cd backend && npm run jobs:run

# Database migrations
cd backend && npx supabase db push
```

---

## Reminders for Claude

1. **Always read the frontend-design skill before any frontend work.** No exceptions.
2. **Always check the User Preferences section above before starting any task.**
3. **After user feedback, update the User Preferences section FIRST, then fix the code.**
4. Ship working code. Don't over-abstract early. Inline is fine until patterns emerge.
5. The MVP ship trigger is: a stranger can sign up, pay, enter queries, and get a report. Build toward that and nothing else until it's done.
6. When in doubt about design choices, lean toward bold and opinionated over safe and generic.
