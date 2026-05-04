#!/bin/bash
# PracticeCompanion — Rename script
# Updates all references from CodeCompanion to PracticeCompanion
# Run from repo root: bash rename-to-practicecompanion.sh

set -e
echo "🔄 Renaming CodeCompanion → PracticeCompanion..."

# ── package.json ─────────────────────────────────────────────
sed -i 's/"name": "codecompanion"/"name": "practicecompanion"/g' package.json
echo "✓ package.json"

# ── README.md ────────────────────────────────────────────────
cat > README.md << 'EOF'
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
EOF
echo "✓ README.md"

# ── app/layout.tsx ───────────────────────────────────────────
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PracticeCompanion — Revenue Intelligence',
  description: 'AI-powered revenue intelligence and practice management for independent primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
EOF
echo "✓ app/layout.tsx"

# ── Sidebar — update logo name ────────────────────────────────
sed -i "s/>CodeCompanion</>PracticeCompanion</g" components/layout/Sidebar.tsx
echo "✓ components/layout/Sidebar.tsx"

# ── CLAUDE.md — full rewrite with correct name + current state ─
cat > CLAUDE.md << 'EOF'
# PracticeCompanion — Project Memory

## What this is
A multi-tenant SaaS AI revenue intelligence and practice management platform for primary
care practices on Athena EHR. The owner (Matt, Dr. Blair) is a solo primary care physician
using this for his own practice first, then selling it to other practices. Matt uses it free
as Practice #1.

## Product name
PracticeCompanion

## Tagline
"AI-powered revenue intelligence for independent primary care."

## Current build status
All 8 modules are built as polished UI with mock data. The path to live requires:
1. Clerk auth (Phase 8)
2. Supabase persistence — buttons that actually save (Phase 9)
3. Inngest background jobs — nightly sync, morning score (Phase 10)
4. Stripe billing (Phase 11)
5. Real Athena API swap-in (Phase 12)
6. Vercel deploy (Phase 13)

## Eight modules
1. **Dashboard** — morning summary: coding flags, care gaps, schedule risk, audit alert
2. **Coding** — AI reads encounter note, suggests E&M + ICD-10 + CPT, provider approves, pushes to Athena
3. **Care Gaps** — AWV, CCM enrollment, HCC recapture, overdue labs, quality measures
4. **Audit Shield** — RAC/OIG risk scoring, documentation gap detection, denial pattern analysis
5. **Practice Pulse** — AI office manager: billing issues, unreviewed labs, patient balances, recalls, portal messages, unconfirmed appointments
6. **Schedule** — no-show prediction with risk factors and recommendations
7. **Analytics** — revenue projections, DAR by payer, operational metrics, YoY comparisons, payer mix
8. **Settings** — Athena connection, subscription, HIPAA/BAA status, AI configuration

## Tech stack
- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL via Supabase (Matt has project: CodeCompanion on Supabase)
- **Auth**: Clerk (multi-tenant, practice-level isolation) — NOT YET WIRED
- **Background jobs**: Inngest — NOT YET WIRED
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514) for coding suggestions
- **Payments**: Stripe — NOT YET WIRED
- **Hosting**: Vercel — NOT YET CONNECTED (dev in GitHub Codespaces)
- **EHR**: Athena REST API + FHIR R4 — MOCKED (ATHENA_USE_MOCK=true)

## Pricing tiers
- Starter: $299/mo — all modules, 1 provider
- Professional: $599/mo — everything + audit shield + peer benchmarks (MOST POPULAR)
- Group: $999/mo — multi-provider + priority support

## Financial model
- Claude API cost per practice: ~$8/mo (< $0.01/encounter)
- Replaces outsourced coding: saves practice $30–40K/yr
- At 10 paying practices @ Pro: $71,880/yr revenue, ~$600/yr Claude costs
- Gross margin: ~98%

## HIPAA approach
- We store ZERO raw PHI — no patient names, DOBs, note text
- Patient references use Athena's opaque patient ID only
- Note text flows transiently through Claude API — never stored in our DB
- Supabase BAA required before production
- Anthropic BAA required before production coding suggester use

## Coding suggester workflow
1. Provider locks encounter note in Athena → webhook fires
2. App fetches note via GET /encounters/{id}/notes
3. Note sent to Claude with 2021 AMA E&M guidelines system prompt
4. Claude returns JSON: { emLevel, icd10Codes[], cptCodes[], modifiers[], confidence, reasoning }
5. Suggestion stored in coding_suggestions table (codes + reasoning only, NO note text)
6. Provider reviews in dashboard → approves or edits
7. App pushes approved codes to Athena via POST endpoints
8. Claim goes out correctly coded

## Database schema
### Core tables (001_initial_schema.sql)
- practices, practice_users, athena_connections, subscriptions, sync_jobs
- coding_suggestions, encounter_flags, care_gaps, audit_risks, schedule_risks, billing_patterns

### Practice Pulse (002_practice_pulse.sql)
- practice_pulse_issues

### Office Manager (003_office_manager.sql)
- office_manager_items

## Athena API — CURRENTLY MOCKED
- ATHENA_USE_MOCK=true in .env.local
- lib/athena/mock-client.ts — realistic synthetic data
- lib/athena/client.ts — real client stub (TODO comments)
- lib/athena/index.ts — exports correct client based on env var
- Real API credentials: register at docs.athenahealth.com

## Key decisions
- No raw PHI stored ever — note text transient only
- Anthropic BAA required before production
- Inngest over BullMQ (serverless, no Redis)
- Supabase RLS for tenant isolation
- Mock-first Athena development
- Build in GitHub Codespaces, Vercel last
- Name: PracticeCompanion (trademark search clean May 2026)
- GitHub repo: FutureXRP/CodeCompanion (repo name not yet updated)

## Build phases
- [x] Phase 1: Project scaffold + foundation files
- [x] Phase 2: Supabase schema + RLS (3 migrations run)
- [x] Phase 3: Next.js app shell + design system
- [x] Phase 4: All module UIs — coding, gaps, audit, schedule, settings
- [x] Phase 5: Practice Pulse — billing issues, AI denial translation
- [x] Phase 6: Practice Pulse expanded — labs, balances, recalls, messages, confirmations
- [x] Phase 7: Revenue Analytics — projections, DAR, benchmarks, YoY trends
- [ ] Phase 8: Clerk auth + practice onboarding
- [ ] Phase 9: Supabase persistence — buttons save to DB
- [ ] Phase 10: Inngest jobs — nightly sync, morning score, coding trigger
- [ ] Phase 11: Stripe billing
- [ ] Phase 12: Real Athena API swap-in
- [ ] Phase 13: Vercel deploy + Athena Marketplace listing

## File structure
```
practicecompanion/
├── CLAUDE.md
├── README.md
├── .env.local.example
├── package.json
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              ← morning dashboard
│   │   ├── coding/page.tsx       ← coding suggester
│   │   ├── gaps/page.tsx         ← care gap scanner
│   │   ├── audit/page.tsx        ← audit shield
│   │   ├── pulse/page.tsx        ← practice pulse (6 tabs)
│   │   ├── analytics/page.tsx    ← revenue analytics
│   │   ├── schedule/page.tsx     ← no-show predictor
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── inngest/route.ts
│   │   ├── athena/webhook/route.ts
│   │   └── stripe/webhook/route.ts
│   └── layout.tsx
├── lib/
│   ├── athena/ (types, mock-client, client, index)
│   ├── intelligence/ (coding-suggester, coding-audit, care-gaps, audit-shield, no-show)
│   └── supabase/ (client, server)
├── inngest/ (client, functions/)
├── supabase/migrations/ (001, 002, 003)
└── components/
    ├── layout/Sidebar.tsx
    └── ui/ (Badge, Card, StatCard)
```

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
ATHENA_CLIENT_ID=
ATHENA_CLIENT_SECRET=
ATHENA_BASE_URL=https://api.preview.platform.athenahealth.com
ATHENA_USE_MOCK=true
```
EOF
echo "✓ CLAUDE.md"

# ── .env.local.example ───────────────────────────────────────
sed -i 's/CodeCompanion/PracticeCompanion/g' .env.local.example
echo "✓ .env.local.example"

echo ""
echo "✅ Rename complete — CodeCompanion → PracticeCompanion"
echo ""
echo "What was updated:"
echo "  ✓ package.json — app name"
echo "  ✓ README.md — full rewrite"
echo "  ✓ app/layout.tsx — page title and description"
echo "  ✓ components/layout/Sidebar.tsx — logo name"
echo "  ✓ CLAUDE.md — full rewrite with current state"
echo "  ✓ .env.local.example — comments"
echo ""
echo "Note: Your GitHub repo is still named CodeCompanion."
echo "You can rename it in GitHub Settings → General → Repository name"
echo "if you want the repo to match. Not required — just cosmetic."
echo ""
echo "git add . && git commit -m 'Rename: CodeCompanion → PracticeCompanion'"