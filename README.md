# Roam — Event Discovery for Rome

**[roamfinder.it](https://roamfinder.it)** | [GitHub Repo](https://github.com/Clash8/roam)

Roam automatically discovers events in Rome by scraping Instagram profiles of venues and organizers, parsing event details with AI, and displaying them on a modern web app.

## How It Works

```
Instagram profiles → Apify scraper → OpenAI GPT-4o-mini → Supabase DB → Next.js frontend
```

1. **Scrape** — A daily GitHub Actions workflow runs `instagram_scraper.py`, which reads venue and organizer Instagram URLs from Supabase, fetches their recent posts via the Apify API, and sends captions + images to OpenAI's GPT-4o-mini to extract structured event data (date, time, location, categories, price, etc.).
2. **Enrich** — `profile_enricher.py` pulls additional metadata from Instagram profiles (bios, profile pictures, follower counts) via Apify and standardizes it with OpenAI before updating venue/organizer records.
3. **Display** — A Next.js web app queries Supabase and renders events with a glassmorphism UI. Users can register, submit new venue/organizer requests, and track them from a personal dashboard. Admins manage events, venues, organizers, and user requests from dedicated panels.

## Project Structure

```
roam/
├── python/                     # Data pipeline
│   ├── instagram_scraper.py    # Daily scraper (Apify + OpenAI → Supabase)
│   ├── profile_enricher.py     # Instagram profile metadata enricher
│   └── requirements.txt
├── web/                        # Next.js frontend
│   └── src/
│       └── app/
│           ├── page.tsx        # Landing page — event discovery grid
│           ├── login/          # Auth — login
│           ├── register/       # Auth — registration
│           ├── dashboard/      # User dashboard & request submission
│           ├── profile/        # User profile
│           └── admin/          # Admin panels (events, venues, organizers, requests)
├── db/                         # SQL schema & migrations
└── .github/workflows/          # GitHub Actions (daily scraper cron)
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Scraping** | [Apify](https://apify.com) (Instagram post & profile scrapers) — [Actor Runs](https://console.apify.com/actors/runs) |
| **AI Parsing** | [OpenAI GPT-4o-mini](https://openai.com) (vision + text → structured JSON) — [Usage Dashboard](https://platform.openai.com/settings/organization/usage) |
| **Database** | [Supabase](https://supabase.com) (PostgreSQL + Row Level Security + Auth) — [Project Dashboard](https://supabase.com/dashboard/project/hkbjhnjmwcrjuhtlfmcj) |
| **Frontend** | [Next.js 16](https://nextjs.org) (App Router, React 19, Server Components) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) + custom glassmorphism design system |
| **Icons** | [Lucide React](https://lucide.dev) |
| **Hosting** | [Vercel](https://vercel.com) — [Deployment & Stores](https://vercel.com/matteocastaldi02-2324s-projects/~/stores) |
| **Automation** | [GitHub Actions](https://github.com/Clash8/roam/actions) (daily cron at 03:00 UTC) |
| **Language** | TypeScript (web), Python (pipeline) |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.x
- Accounts: Apify, OpenAI, Supabase

### Setup

```bash
# Clone the repo
git clone https://github.com/Clash8/roam.git
cd roam

# Web app
cd web
cp .env.example .env.local   # Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                   # http://localhost:3000

# Python pipeline
cd ../python
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env    # Add APIFY_TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY
python instagram_scraper.py
```

### Vercel Environment Variables

In your [Vercel project settings](https://vercel.com/matteocastaldi02-2324s-projects/~/stores), add these environment variables for **all environments** (Production, Preview, Development):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for admin operations) |

### GitHub Actions Secrets

In [repo settings → Secrets](https://github.com/Clash8/roam/settings/secrets/actions), add these secrets for the daily scraper workflow:

| Secret | Description |
|---|---|
| `APIFY_TOKEN` | Apify API token |
| `OPENAI_API_KEY` | OpenAI API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |

## Database Schema

Three core tables in Supabase (PostgreSQL):

- **`venues`** — Locations (name, address, coordinates, Instagram URL, metadata)
- **`organizers`** — Event organizers (name, Instagram URL, metadata)
- **`events`** — Events with foreign keys to venues and organizers, plus categories, price, confidence score, and raw source text

RLS policies enable public read access. Auth-based policies protect writes.

## Costs Overview

Running Roam is essentially free. Here's the breakdown for a typical daily run (~50 Instagram posts):

| Service | Usage | Cost |
|---|---|---|
| **Apify** (Instagram scraper) | ~52 posts scraped | ~$0.14 / run |
| **OpenAI GPT-4o-mini** (image → JSON) | ~300 image parses | ~$0.04 / run |
| **Supabase** (database + auth) | Free tier | $0 |
| **Vercel** (hosting) | Hobby plan | $0 |
| **GitHub Actions** (CI/CD) | Unlimited minutes (open-source) | $0 |

**Total: ~$0.18 / day** — under $6 / month for a fully automated event discovery pipeline.

## Roadmap

- [ ] **Map view** — Interactive map showing events pinned to their venue locations
- [ ] **Event detail pages** — Dedicated page for each event with full info, images, and links
- [ ] **Filtering & search** — Filter events by category, date range, neighborhood, and price
- [ ] **Favorites & notifications** — Let users save events and get notified about updates
- [ ] **Multi-city expansion** — Extend the pipeline to support cities beyond Rome
- [ ] **Organizer/venue public profiles** — Public-facing pages for each venue and organizer with upcoming events
- [ ] **Social sharing** — Share event cards to Instagram Stories, WhatsApp, etc.
- [ ] **Recommendation engine** — Personalized event suggestions based on user preferences and history
- [ ] **Native mobile app** — React Native or Flutter app for iOS and Android
- [ ] **Community contributions** — Let users submit events manually with AI-assisted form filling
- [ ] **Analytics dashboard** — Insights for venues/organizers on event reach and engagement

## License

Private — All rights reserved.
