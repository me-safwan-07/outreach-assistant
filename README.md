# Outreach Assistant

An AI-powered job-seeker outreach tool. Paste a LinkedIn company URL → get a ranked list of contacts → find their emails → generate personalized cold emails with Gemini AI.

> **⚠️ Legal Notice**: Scraping LinkedIn data may conflict with LinkedIn's Terms of Service. This tool is intended for personal, low-volume job search use only. Always comply with anti-spam laws (CAN-SPAM, GDPR, India's IT Act) and privacy regulations when emailing people. Never use this tool for bulk commercial outreach.

---

## Features

- 🔍 Scrapes company info and up to 50 employees via **Apify** (harvestapi/linkedin-company + linkedin-company-employees)
- 📊 Scores and ranks the **top 10 most relevant contacts** (HR, founders, eng leads, engineers)
- 📧 Finds work emails via **Hunter.io** (free tier: 25 searches/month)
- 🤖 Generates personalized cold emails via **Gemini AI** (gemini-2.5-flash)
- 💾 Caches everything in **PostgreSQL** — never re-calls APIs for the same person
- 🔧 **Mock Mode by default** — works with zero API keys out of the box
- 📋 Copy, mailto, and edit drafts in an in-app drawer

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd outreach-assistant
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys (see below). `MOCK_MODE=true` by default — you can use the app without any keys.

### 3. Database setup

**Option A — Docker (recommended for local dev):**
```bash
docker-compose up -d
```

**Option B — Neon or Supabase (free cloud Postgres):**
- [Neon](https://neon.tech): Create project → copy connection string → paste in `DATABASE_URL`
- [Supabase](https://supabase.com): Create project → Settings → Database → paste URI in `DATABASE_URL`

### 4. Run migrations and seed

```bash
pnpm db:push     # creates schema (no migration history needed for dev)
pnpm db:seed     # inserts sample data so the app is usable without API keys
```

### 5. Start the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Getting API Keys (all free)

### Apify
1. Sign up at [apify.com](https://apify.com)
2. Go to **Settings → Integrations → API Tokens**
3. Copy your token → set `APIFY_TOKEN=...`
4. **Cost**: harvestapi/linkedin-company costs ~$3/1k companies; employees costs ~$1.5/1k basic or $8/1k full profiles. Apify gives $5 free credit on signup.
5. Actor IDs are configurable: `APIFY_COMPANY_ACTOR_ID` and `APIFY_EMPLOYEES_ACTOR_ID`

### Gemini (Google AI Studio)
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create an API key → set `GEMINI_API_KEY=...`
3. **Free tier**: 1,500 requests/day, 1M tokens/minute for `gemini-2.5-flash`
4. Change model via `GEMINI_MODEL=gemini-2.5-flash`

### Hunter.io
1. Sign up at [hunter.io](https://hunter.io)
2. Go to **API → API key** → set `HUNTER_API_KEY=...`
3. **Free tier**: 25 email-finder searches per month

### Neon (free cloud Postgres)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a project → copy the connection string (postgres://...)
3. Set `DATABASE_URL=postgres://...`
4. **Free tier**: 0.5 GB storage, 1 compute unit, always-on

---

## Switching Off Mock Mode

Edit `.env`:
```
MOCK_MODE=false
```

Then restart the dev server. The app will now make real API calls to Apify, Hunter.io, and Gemini.

**Free-tier API call budget per company run:**
- 1 Apify company call (~$0.003)
- 1 Apify employees call for 50 profiles (~$0.075 for full mode)
- Up to 10 Hunter.io searches (10 of your 25/month free)
- Up to 10 Gemini calls (minimal against 1,500/day free)

---

## Running Tests

```bash
pnpm test
```

Tests cover: scoring classification, score calculation, diversity selection, email pattern guesser, Gemini output parser.

---

## Free-Tier Limits Summary

| Provider | Free Limit | Usage per run |
|---|---|---|
| Apify | $5 credit (~1,600 companies) | 1 company + 50 employees |
| Hunter.io | 25 searches/month | Up to 10/run |
| Gemini | 1,500 req/day | Up to 10/run |
| Neon DB | 0.5 GB | Negligible |

---

## Architecture

```
/ (home) → POST /api/pipeline/start → runPipeline() (background)
                                           ↓
                    COMPANY (Apify or mock)
                           ↓
                    EMPLOYEES (Apify or fixture)
                           ↓
                    SCORING (pure TS, no API)
                           ↓
                    EMAILS (Hunter.io or mock)
                           ↓
                    DRAFTS (Gemini or mock)
                           ↓
                         DONE
                           
UI polls GET /api/pipeline/[id]/status every 3s
```

---

## Database Models

- **Company** — LinkedIn company data
- **Employee** — scored and ranked employees
- **EmailLookup** — Hunter.io results (FOUND / NOT_FOUND / GUESSED_UNVERIFIED / ERROR)
- **EmailDraft** — Gemini-generated emails (DRAFT / COPIED / SENT / REPLIED)
- **PipelineRun** — stage tracking per company
- **ApiUsage** — daily usage counters per provider
- **Settings** — your profile (name, role, stack, etc.) and API limits
