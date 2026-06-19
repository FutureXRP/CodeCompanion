# GO-LIVE.md — production readiness

Run `npm run readiness` for the live, env-aware status. This document is the
honest map of what is **code-complete** versus what still requires **human /
infra / legal** action. Code cannot certify a PHI system as live; this is the
checklist a person drives to the finish.

---

## What is code-complete (engineering done)

- **Canonical model + RLS** — every tenant-scoped table enables row-level security
  in the migration that creates it (`005`, `007`, `009`), isolated by
  `current_tenant_id()`. A static guard test (`tests/db-operational.test.ts`)
  fails CI if a future tenant table ships without RLS.
- **Operational persistence** (`009_operational.sql`) — `eligibility_checks`,
  `transaction_enrollments`, `payment_transactions`, `tasks`, and `audit_log`,
  each tenant-scoped + RLS. Repositories in `lib/db/` write/read them.
- **Immutable audit log** — append-only `audit_log` (a DB trigger rejects
  UPDATE/DELETE for everyone, including the service role). `writeAudit()` is wired
  into the PHI write paths (`persistRun`, `recordPayment`, eligibility, enrollment).
- **De-identification gate** — `assertDeidentified()` runs at the corpus write
  boundary; the corpus table has no `tenant_id` and a `sample_n >= 11` CHECK.
  Tests in `tests/corpus.test.ts`.
- **Production switches** — `ALLOW_REAL_PHI` gates every real-PHI rail
  (clearinghouse, eligibility); `ALLOW_REAL_CHARGES` gates real card charges.
  Both default OFF; the app runs mock-first until they are flipped.
- **The suite** — Command Center, Follow-up Queue, Eligibility (+ schedule sweep),
  Patient Billing, A/R & Denials, and the full RCM cycle, all on the deterministic
  engine. Test suite green; `next build` clean.

## What only a human / infra / legal can close (the blockers)

1. **Sign the BAAs** — Supabase, Anthropic, Stedi, Stripe (every vendor in the PHI
   path). Then set `BAA_SIGNED=true`. *(Deferred by request.)*
2. **HIPAA security risk assessment** — a qualified review of the deployment.
   Then set `HIPAA_SECURITY_REVIEW=true`.
3. **Provision production infra** — a real Supabase project, plus Stedi production
   credentials and (optional at launch) Stripe live keys. Set the env vars.
4. **Apply the schema** — run `supabase/migrations/*` against the production DB and
   confirm `supabase/tests/rls_isolation_test.sql` passes there.
5. **Bootstrap a tenant** — first sign-in creates the tenant + membership
   (`ensureTenantForUser`); verify `current_tenant_id()` resolves.
6. **Flip the switches** — `ALLOW_REAL_PHI=true` (and `ALLOW_REAL_CHARGES=true`
   once Stripe reconciliation is verified) **only after** 1–5 are done.

## The go / no-go rule

`npm run readiness` exits non-zero while any required check is unmet, so it can
gate the deploy. It will report **NOT READY** until the BAAs, the security
review, and the production switches are in place — which is correct: this build
is engineered for go-live, but going live is a human decision on top of it.
