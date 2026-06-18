# PracticeCompanion

EHR-agnostic revenue recovery and RCM for independent primary care. Diffs what
you billed (837) against what was paid (835) against your contracted rate, and
surfaces the money the rest of the industry leaves on the table.

See `CLAUDE.md`, `ARCHITECTURE.md`, and `ROADMAP.md` for the full design + the
"ladder" (found money → full RCM → predictive adjudication → settlement).

## Quick start (zero config)

The app runs the full synthetic-data demo with **no environment variables** —
auth and persistence degrade gracefully until you wire Supabase.

```bash
npm install
npm run dev          # http://localhost:3000  (landing) · /dashboard (app)
npm test             # deterministic engine + adapter + mapper tests
npm run found-money  # prints the found-money report to the terminal
npm run rcm-demo     # in-house RCM cycle (mock clearinghouse)
```

## Deploy to Vercel

1. Import the repo in Vercel — it auto-detects Next.js (`next build`).
2. Deploy. With no env vars, you get the public **synthetic-data demo** (zero
   compliance risk — no real data, no login).
3. Add environment variables (below) to switch on accounts, persistence, etc.

## Environment variables

| Variable | Enables |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Accounts/auth** — login + per-tenant route protection |
| `SUPABASE_SERVICE_ROLE_KEY` | **Persistence** — server-side writes (`/api/persist`, `/api/findings`) |
| `ANTHROPIC_API_KEY` | Appeal-letter drafting |
| `STEDI_API_KEY`, `STEDI_SANDBOX=true` | Sandbox clearinghouse submission |
| `ALLOW_REAL_PHI` | Keep `false` until a BAA is signed (COMPLIANCE.md) |

When Supabase is configured, the dashboard requires a login; without it, the
demo stays open. Real patient data must never flow until `ALLOW_REAL_PHI=true`
**and** auth is enabled.

## Supabase setup (accounts + persistence)

1. **Schema:** open the Supabase SQL editor and run **`supabase/schema.sql`**
   (idempotent; sets up tenants, `tenant_users`, `current_tenant_id()`, every
   table, and RLS). Equivalent to migrations `005` + `006`.
2. **Auth:** Authentication → Providers → enable **Email**. For a fast start,
   turn **off** "Confirm email" (or wire the confirmation flow — `/auth/callback`
   is already implemented). Set the **Site URL** to your deployment and add
   `<your-site>/auth/callback` to the redirect allow-list.
3. **Verify persistence** (after signing in):
   ```bash
   curl -X POST  https://<site>/api/persist     # → { ok, claims, findings, ... }
   curl          https://<site>/api/findings    # → your persisted findings
   ```
   Data is written to the signed-in user's tenant; RLS keeps tenants isolated.

## Stack

Next.js 16 · Supabase (Postgres + Auth + RLS) · Anthropic Claude (language only)
· EDI X12 837/835 + Stedi clearinghouse adapter · Stripe.

Money is integer cents and every dollar figure is deterministic — no LLM ever
touches the math (CLAUDE.md).
