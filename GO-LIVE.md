# GO-LIVE.md — production readiness

Run `npm run readiness` for the live, env-aware status. This document is the
honest map of what is **code-complete** versus what still requires **human /
infra / legal** action. Code cannot certify a PHI system as live; this is the
checklist a person drives to the finish.

The stack: **Google Cloud Run** hosts the app, **Neon** Postgres holds PHI,
**Supabase** is auth only, the practice-management system (**Tebra**, or
athena) runs claims / eligibility / ERA, and CodeCompanion reads what it posted.
Stedi is used only if CodeCompanion submits claims itself.

---

## What is code-complete (engineering done)

- **Canonical model + RLS** — every tenant-scoped table enables row-level security
  in the migration that creates it (`005`–`011`), isolated by `current_tenant_id()`
  (on Neon, a per-request GUC). A static guard test fails CI if a tenant table
  ships without RLS.
- **Immutable audit log** — append-only `audit_log`; `writeAudit()` is wired into
  every PHI path: persisted runs, payments, eligibility, enrollment, **live Tebra
  pulls** (`tebra_charges`) and **Tebra writes** (`tebra_encounter_status`).
- **De-identification gate** — `assertDeidentified()` at the corpus write
  boundary; the corpus table has no `tenant_id` and a `sample_n >= 11` CHECK.
- **Production switches** — `ALLOW_REAL_PHI` gates every real-PHI rail (the
  Tebra and athena live clients, the clearinghouse, eligibility);
  `ALLOW_REAL_CHARGES` gates real card charges; `TEBRA_ALLOW_WRITES` gates writes
  back to Tebra. All default OFF.
- **The Tebra loop, end to end on synthetic data** — adapter (SOAP, paced,
  windowed, validated request shape), Found Money straight off a pull, the
  Posting Workbench (appeals, resubmits, status checks, secondaries, statements,
  takebacks), the Pre-approval Review (scrubber + capture rules with contracted
  dollars), idempotent sync + backfill, the nightly job, the day-one validator,
  the contract-export and NCCI-table loaders. `TEBRA-INTEGRATION.md` is the
  runbook.
- **The suite** — 200+ deterministic tests green; `next build` clean.

## What only a human / infra / legal can close (the blockers)

1. **Sign the BAAs** — Google Cloud and Neon (self-serve), Anthropic (by request;
   only if appeal drafting runs on real PHI). Tebra's comes with its contract.
   Stedi / Stripe only if used. Then set `BAA_SIGNED=true`.
2. **HIPAA security risk assessment** — a qualified review of the deployment.
   Then set `HIPAA_SECURITY_REVIEW=true`.
3. **Provision production infra** — Cloud Run + the Neon Scale tier (DEPLOY.md);
   `DATABASE_URL`; `npm run db:migrate` (then `-- --only=011` for any later
   migration); a Supabase project for staff logins.
4. **Tebra account** — the Customer Key (a System Administrator's Customer Care
   case), a dedicated API user with the System Admin role, the practice's contract
   rates loaded into *Contracts and Fees* (and exported to
   `TEBRA_CONTRACT_EXPORT_PATH`), ERA enrollment through TriZetto for every payer.
5. **Validate before trusting** — `npm run tebra-validate` clean on a real window;
   then `npm run tebra-backfill` for history; then `TEBRA_SYNC_ENABLED=true`.
6. **Bootstrap a tenant** — first sign-in creates the practice
   (`ensureTenantForUser`); set `SYNC_TENANT_ID` if more than one exists.
7. **Flip the switches** — `ALLOW_REAL_PHI=true` on the Cloud Run environment
   only, never on Vercel; `TEBRA_ALLOW_WRITES=true` once the biller has run a week
   of reviews read-only; `ALLOW_REAL_CHARGES=true` only if Stripe is used.

## The go / no-go rule

`npm run readiness` exits non-zero while any required check is unmet, so it can
gate the deploy. It reports **NOT READY** until the BAAs, the security review,
and the production switches are in place — which is correct: this build is
engineered for go-live, but going live is a human decision on top of it.
