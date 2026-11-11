# CodeCompanion

EHR-agnostic revenue recovery and RCM for independent primary care. Diffs what
you billed (837) against what was paid (835) against your contracted rate, and
surfaces the money the rest of the industry leaves on the table — then works
the whole visit: the front desk before check-in, the encounter before it is
approved, the claim after the payer answers.

See `CLAUDE.md`, `ARCHITECTURE.md`, and `ROADMAP.md` for the design and the
"ladder" (found money → full RCM → predictive adjudication → settlement);
`TEBRA-INTEGRATION.md` for the practice-management integration and its runbook;
`GO-LIVE.md` + `DEPLOY.md` for production.

## Quick start (zero config)

The app runs the full synthetic-data demo with **no environment variables** —
every adapter is mock-first, auth and persistence degrade gracefully.

```bash
npm install
npm run dev            # http://localhost:3000  (landing) · /command (app)
npm test               # deterministic engine + adapter + repo tests
npm run found-money    # the Rung 0 report on the sample 837/835/fee schedule
npm run tebra-pull     # a Tebra pull → found money (mock)
npm run tebra-validate # the day-one account validator (mock proves the checks)
```

## The loops, in visit order

| Page | What it does | Source |
|---|---|---|
| **Front Desk** `/frontdesk` | Coverage ended / missing, authorizations expired or used up, copay + balance to collect — before the patient is in the room | schedule + patient coverage from the PM |
| **Pre-approval Review** `/review` | What would reject or deny as coded, and what is separately payable but missing, with contracted dollars — before the encounter is approved | unapproved encounters from the PM |
| **Found Money** `/found-money` | Underpayments, un-appealed denials, unanswered claims, undercoding — after the payer answers | billed vs. contract vs. paid |
| **Posting Workbench** `/workbench` | Appeals, resubmits, status checks, secondaries never billed, statements never sent, takebacks — ranked by dollars | the diff + claim tracking |
| **Follow-up Queue** `/tasks` | The above as owned, aging tasks; the nightly sync keeps them current without losing a human's edits | the sync |

Every dollar figure is deterministic — no LLM ever touches the math. Claude
drafts appeal letters and explanations only (`CLAUDE.md`).

## Adapters

- **Tebra** (`lib/adapters/tebra`, Web Services API 2.1 / SOAP) — charges with
  contract-expected and adjudicated amounts, unapproved encounters, the schedule,
  patient coverage, and the approve / send-back write path. Mock by default
  (`TEBRA_USE_MOCK=true`); the live client is gated by `ALLOW_REAL_PHI`.
- **athenahealth** (`lib/adapters/athena`) — encounter pull (REST, OAuth).
- **EDI** (`lib/adapters/edi`) — raw X12 837 / 835 files, the universal path.
- Everything normalizes into `lib/canonical`; nothing above the adapters sees a
  vendor field.

## Stack

Next.js 16 · **Neon** Postgres (PHI, RLS) · **Supabase Auth** (staff logins
only) · Anthropic Claude (language only) · Inngest (the nightly sync) · Stedi
(only if CodeCompanion submits claims itself) · Stripe (optional).

Environment variables are documented in `.env.local.example`; `npm run
readiness` reports what is configured and what still blocks go-live.
