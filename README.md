# PracticeCompanion

AI-powered revenue intelligence and practice management for independent primary care.

## What it does

- **Coding suggester** — reads your encounter note, suggests E&M + ICD-10 + CPT, you approve, pushes to Athena
- **Coding audit** — flags undercoding and upcoding risk across your claims
- **Care gap scanner** — surfaces AWV, CCM, HCC recapture, quality measures
- **Audit shield** — RAC/OIG risk scoring and documentation gap detection
- **Practice Pulse** — AI office manager: billing issues, unreviewed labs, patient balances, recalls, portal messages
- **Schedule risk** — no-show prediction for your morning schedule
- **Revenue analytics** — projections, DAR, benchmarks, year-over-year trends

## Stack

Next.js 16 · Supabase · Clerk · Inngest · Claude API · Stripe · Athena EHR

## Setup

```bash
cp .env.local.example .env.local
# Fill in your Supabase keys
npm install
npm run dev
```

Run migrations in Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_practice_pulse.sql`
3. `supabase/migrations/003_office_manager.sql`

See `CLAUDE.md` for full build roadmap.
