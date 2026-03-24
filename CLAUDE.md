# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roam is an event discovery app for Rome that scrapes Instagram, parses events with AI, and displays them via a Next.js frontend. The pipeline is: **Apify (Instagram scraping) → OpenAI GPT-4o-mini (vision parsing) → Supabase (PostgreSQL) → Next.js (UI)**.

## Commands

### Web (Next.js) — run from `web/`
```bash
npm run dev      # Dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

### Python — run from `python/`
```bash
source venv/bin/activate
python instagram_scraper.py    # Scrape Instagram posts and insert parsed events
python profile_enricher.py     # Enrich venue/organizer metadata via OpenAI
```

## Environment Setup

Copy `.env.example` to `.env` at the repo root for Python scripts. The web app uses `web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Required secrets: `APIFY_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.

## Architecture

### Data Pipeline (`python/`)
- `instagram_scraper.py`: Reads venues/organizers from Supabase, fetches their recent Instagram posts via Apify, sends captions + base64 images to `gpt-4o-mini`, and inserts parsed events into Supabase. Configurable via `DAYS_AGO` and `MAX_POSTS_PER_PROFILE` constants.
- `profile_enricher.py`: Uses Apify's profile scraper to fetch Instagram metadata, then calls OpenAI to standardize it and updates the venue/organizer records.

### Database (`db/schema.sql`)
Three tables: `venues`, `organizers`, `events`. The `events` table has foreign keys to both, plus rich fields: `categories` (array), `coordinates` (JSON), `confidence_score` (float), and `raw_text`. RLS is enabled with public SELECT and INSERT policies.

### Web Frontend (`web/`)
- **Next.js 16.2.1** with App Router — this version has breaking changes from older Next.js. Before writing any code, check `node_modules/next/dist/docs/` for current APIs.
- Single page (`src/app/page.tsx`) is a server component that fetches events with joined venues/organizers, renders a 2-column card grid with glassmorphism styling, and revalidates every 60 seconds (ISR).
- Supabase client at `src/lib/supabase.ts`.
- Tailwind CSS v4 (configured via `@tailwindcss/postcss`, not the old `tailwind.config.js` approach).

### Automation
GitHub Actions workflow (`.github/workflows/daily_scraper.yml`) runs `instagram_scraper.py` daily at 3 AM UTC using repository secrets.

---

## UI/UX Design System

Every component and page must stay coherent with this design system. Do not deviate without a specific user instruction.

### Stack
- **Next.js 16.2.1** App Router — Server Components by default, `'use client'` only when needed (forms, hooks, browser events)
- **Tailwind CSS v4** — no `tailwind.config.js`; utilities defined in `src/app/globals.css` via plain CSS (NOT `@apply` with state variants — they are silently dropped in Tailwind v4)
- **Lucide React v1** — icon set; `Instagram` icon does not exist, use `AtSign` instead
- **`@supabase/ssr`** for auth-aware server/client Supabase clients

### Visual Language
| Token | Value |
|---|---|
| Background | `#000` with `radial-gradient(ellipse at top, rgba(30,10,60,1) 0%, rgba(5,5,10,1) 60%)` fixed |
| Primary | Fuchsia `#d946ef` (fuchsia-500) |
| Secondary | Indigo `#6366f1` (indigo-500) |
| Accent | Purple `#9333ea` (purple-600) |
| Font | Geist Sans (variable, already loaded in layout) |
| Border radius | Cards `rounded-2xl` / `rounded-3xl`, inputs `rounded-xl`, small elements `rounded-lg` |
| Spacing unit | 4px / 8px increments |

### Custom CSS Classes (defined in `globals.css`)
Use these — do not invent new utility classes or inline equivalent styles:

| Class | Purpose |
|---|---|
| `.glass` | Standard surface — translucent panel, backdrop blur, subtle border |
| `.glass-strong` | Prominent surface — forms, modals, auth cards |
| `.glass-card` | Content cards — event cards, list items |
| `.input-glass` | All `<input>` and `<textarea>` elements; comes with `:focus` ring |
| `.btn-primary` | Primary CTA — fuchsia→indigo gradient, has `:hover`, `:active`, `:disabled` |
| `.btn-secondary` | Secondary action — ghost style |
| `.btn-danger` | Destructive action — red tint |
| `.btn-success` | Confirm / approve — green tint |
| `.badge-pending` | Status badge amber |
| `.badge-approved` | Status badge green |
| `.badge-rejected` | Status badge red |
| `.page-title` | `h1` on interior pages |
| `.section-label` | Overline label above titles (uppercase, fuchsia, tracking wide) |

### Critical Tailwind v4 Rule
**Never use `@apply hover:X`, `@apply focus:X`, `@apply active:X`, or `@apply disabled:X` inside `@layer utilities`.** State variants inside `@apply` are silently dropped by Tailwind v4. Always write them as plain CSS pseudo-class blocks:
```css
/* ✓ correct */
.my-class { background: red; }
.my-class:hover { background: darkred; }

/* ✗ broken — hover rule never generated */
.my-class { @apply bg-red-500 hover:bg-red-700; }
```

### Page Layout Pattern
- Root layout: `Navbar` (fixed top, `z-50`) + `<main className="flex-1 pt-20">`
- Max content width: `max-w-6xl` (landing) / `max-w-4xl` (dashboards) / `max-w-2xl` (single forms)
- Horizontal padding: `px-4` always
- Vertical padding: `py-8` for interior pages, `pt-12 pb-24` for landing

### Component Patterns
- **Auth pages** — centered `glass-strong` card, max-w-md, icon + title + form, link to opposite auth page
- **Forms** — `space-y-4` or `space-y-5`, label above input, `input-glass w-full`, `btn-primary w-full` at bottom
- **Empty states** — `glass rounded-2xl p-12 text-center`, relevant Lucide icon at `w-10 h-10 text-gray-600`, short message + CTA
- **Tables (admin)** — `glass-card rounded-2xl overflow-hidden`, `<table role="table">`, header row `border-b border-white/10`, body rows `hover:bg-white/5 transition-colors`
- **Status badges** — always use `.badge-pending / .badge-approved / .badge-rejected`, never custom inline colors

### Accessibility Baseline
- Every `<button>` and `<a>` without visible text label must have `aria-label`
- Form inputs always paired with `<label htmlFor="...">`
- Error messages use `role="alert" aria-live="polite"`
- Loading buttons: `disabled={pending}` + `aria-busy={pending}` + spinner

---

## Database Runbook

Project ref: `hkbjhnjmwcrjuhtlfmcj`
Credentials are in `.env` at repo root.

### How to run SQL against the remote database

Direct Postgres connections (port 5432/6543) are **blocked** by the local network. Use the **Supabase CLI via npx** with the token from `.env`:

```bash
# Step 1 — link the project (only needed once per session)
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_TOKEN .env | cut -d= -f2) \
  npx supabase link --project-ref hkbjhnjmwcrjuhtlfmcj

# Step 2 — run a SQL file
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_TOKEN .env | cut -d= -f2) \
  npx supabase db query --linked -f path/to/file.sql

# Step 3 — run an inline query
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_TOKEN .env | cut -d= -f2) \
  npx supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

Always run commands from `web/` (that's where `supabase link` stores the project ref).

### Create a table
1. Write the DDL in `db/` (e.g. `db/add-something.sql`)
2. Run it via the CLI above
3. Verify with: `npx supabase db query --linked "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='<table>'"`

### Add a column
```sql
ALTER TABLE public.<table> ADD COLUMN IF NOT EXISTS <col> <type> [DEFAULT <val>];
```

### Drop a column
```sql
ALTER TABLE public.<table> DROP COLUMN IF EXISTS <col>;
```

### Drop a table
```sql
DROP TABLE IF EXISTS public.<table> CASCADE;
```

### Add / update RLS policies
```sql
-- Enable RLS (idempotent)
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- Add a policy (check it doesn't already exist first)
CREATE POLICY "<name>" ON public.<table> FOR <SELECT|INSERT|UPDATE|DELETE>
  USING (<condition>);

-- Replace a policy
DROP POLICY IF EXISTS "<name>" ON public.<table>;
CREATE POLICY "<name>" ON public.<table> ...;
```

### Make a user admin
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
WHERE email = 'user@example.com';
```

### Verify live table list
```bash
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_TOKEN .env | cut -d= -f2) \
  npx supabase db query --linked \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```
