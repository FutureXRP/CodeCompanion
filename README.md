# CodeCompanion

AI-powered coding and revenue intelligence for independent primary care practices.

## What it does

- **Coding suggester** — reads your encounter note, suggests E&M + ICD-10 + CPT, you approve, pushes to Athena
- **Coding audit** — flags undercoding and upcoding risk
- **Care gap scanner** — surfaces AWV, CCM, HCC recapture, quality measures
- **Audit shield** — RAC/OIG risk scoring and documentation gap detection
- **No-show predictor** — scores your morning schedule before your first patient

## Stack

Next.js 14 · Supabase · Clerk · Inngest · Claude API · Stripe · Athena EHR

## Setup

```bash
cp .env.local.example .env.local
# Fill in your Supabase keys
npm install
npm run dev
```

Run the migration in Supabase SQL editor:
`supabase/migrations/001_initial_schema.sql`

See `CLAUDE.md` for full build roadmap.
