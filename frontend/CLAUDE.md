# Frontend — CLAUDE.md

## What this folder is

This is the React frontend for Visaion. React is a JavaScript UI library — instead of writing raw HTML, you write components (reusable pieces of the page) in `.tsx` files. Vite is the tool that bundles everything and runs the local dev server.

---

## How to run it

```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser. The page will live-reload whenever you save a file — no manual refresh needed.

- Press `o + Enter` to open the app in your browser automatically
- Press `q + Enter` to stop the server (or `Ctrl + C`)

---

## File structure

```
frontend/
├── package.json              # Lists all dependencies (libraries this app uses)
├── vite.config.ts            # Build tool config — rarely needs to be touched
├── src/
│   ├── main.tsx              # Entry point — bootstraps React, don't edit this
│   ├── App.tsx               # Root component — sets up routing between pages
│   ├── pages/
│   │   └── landing.tsx       # The landing/marketing page (composes all sections)
│   ├── components/           # Reusable UI sections used by pages
│   │   ├── nav.tsx           # Top navigation bar
│   │   ├── hero.tsx          # Hero section (headline, subtitle, platform chips)
│   │   ├── hero-form.tsx     # The sign-up form in the hero (3-step flow)
│   │   ├── scan-preview.tsx  # Animated scan widget shown inside the form
│   │   ├── ticker.tsx        # Scrolling social proof bar
│   │   ├── how-it-works.tsx  # "How it works" section
│   │   ├── report-preview.tsx# Sample report with plan tab switcher
│   │   ├── pricing.tsx       # Pricing cards
│   │   ├── cta-section.tsx   # Bottom call-to-action
│   │   └── footer.tsx        # Page footer
│   ├── hooks/
│   │   └── use-scroll-reveal.ts  # Animates elements into view as you scroll
│   └── styles/
│       └── globals.css       # All CSS — color variables, animations, base styles
```

### How pages and components relate

A **page** is a full screen (e.g. the landing page, or eventually a dashboard page). A **component** is a section or widget used inside a page. The landing page (`pages/landing.tsx`) simply imports and stacks all the components in order.

---

## Adding a new page

When new pages are needed (e.g. dashboard, login):
1. Create the file in `src/pages/`
2. Install `react-router-dom` (`npm install react-router-dom`)
3. Add a route in `App.tsx`

---

## Styling

Styles live in `src/styles/globals.css`. The existing CSS is intentionally kept as-is — it's well-crafted and powers the dark-mode design. Tailwind CSS v4 is also available for new code.

### Color variables (use these instead of hardcoded colors)

| Variable | Value | Use |
|----------|-------|-----|
| `--bg` | `#07090d` | Page background |
| `--surface` | `#0e1218` | Card backgrounds |
| `--accent` | `#f0a500` | Gold accent color |
| `--green` | `#22c55e` | Success / positive |
| `--red` | `#ef4444` | Error / negative |
| `--text` | `#dde5ef` | Primary text |
| `--text-muted` | `#5e7590` | Secondary text |

### Fonts
- **Instrument Serif** — headings
- **Outfit** — body text
- **JetBrains Mono** — numbers and code

---

## State (how the UI remembers things)

"State" is just data that can change — like which step of a form you're on, or whether a dropdown is open. In React, state lives inside components using `useState`.

| What | Where | Values |
|------|-------|--------|
| Form step | `hero-form.tsx` | `'input'`, `'queries'`, `'success'` |
| Query list | `hero-form.tsx` | Array of strings |
| Plan tab | `report-preview.tsx` | Plan name |
| Scan animation | `scan-preview.tsx` | Cycling index |
| Scroll reveal | `hooks/use-scroll-reveal.ts` | Observed elements |

---

## Conventions

- File names: `kebab-case.tsx` (e.g. `hero-form.tsx`)
- Components use named exports: `export function Hero() {}`
- Only `App.tsx` uses a default export
- Functional components only — no class components
- Keep components under ~150 lines — split into smaller pieces if larger
