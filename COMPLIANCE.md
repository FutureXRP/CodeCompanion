# COMPLIANCE.md — HIPAA Posture & PHI Gate

This platform handles protected health information. Compliance here is **architecture, not a checklist bolted on at the end.** Read this before writing anything that could touch PHI.

---

## The hard gate: no real PHI until the BAA path is closed

The platform must not process real patient data until all of the following are true:

1. **BAAs signed** with every vendor in the PHI path — hosting (Google Cloud), the database (Neon), the model provider (Anthropic, only if appeal drafting runs on real data), the practice-management vendor (Tebra), and any subprocessor that could see PHI.
2. **A HIPAA security risk assessment** of the deployment, by someone qualified.
3. **Audit logging** live on every PHI access.
4. **Row-level security** load-bearing on every tenant-scoped table (below).
5. **De-id gate tests** passing for the corpus transform.

Until then, **everything runs on synthetic or de-identified test data.** The posture is the default across all adapters:

- `ATHENA_USE_MOCK=true`, `TEBRA_USE_MOCK=true`, `EDI_USE_SAMPLE_FILES=true`
- `ALLOW_REAL_PHI=false` ← the master switch; stays false until the gate above is closed.

Claude Code: if a task implies flowing real patient data while `ALLOW_REAL_PHI=false`, stop and flag it rather than wiring it.

### The gate is code, not a convention (`lib/compliance/gate.ts`)

`ALLOW_REAL_PHI=true` is honored only on a deployment real data may live on. `realPhiRefusal()` returns the exact reason otherwise, and every real-data path asks it first: the live Tebra and athena clients (`tebraConfigFromEnv` / `athenaConfigFromEnv`), the real 837/835 loaders, the appeal drafter before any claim detail reaches the model, and so the sync. It refuses when:

- the process runs on **Vercel** (`VERCEL` is set) — the public demo host has no BAA; real PHI runs on Cloud Run + Neon only;
- `BAA_SIGNED` or `HIPAA_SECURITY_REVIEW` is not `true` — the human gates, acknowledged by a person once they are true;
- `DATABASE_URL` does not carry `sslmode=require` (localhost excepted), or `PG_SSL_STRICT=false` turns certificate verification off;
- the staff-login gate is off (unreachable: `ALLOW_REAL_PHI=true` forces it on — `isLoginRequired` in `lib/db/config.ts`).

`npm run readiness` reports the same facts (`phi_hosting`, `db_tls`); with real PHI allowed they are hard blockers.

---

## Database isolation — row-level security that actually bites

Postgres exempts a table's **owner** from row-level security unless the table is `FORCE`d, and a `SUPERUSER` / `BYPASSRLS` role skips it entirely — so policies alone prove nothing. Since migration `014_rls_force.sql`:

- every RLS table is **forced**; a query outside a tenant or service context sees nothing and writes nothing, owner included;
- `withTenant(id)` runs a transaction with `app.current_tenant` set (the tenant policies apply); `withService()` runs one with `app.role = 'service'` (the `<table>_service` policies apply — tenant bootstrap, the sync's tenant lookup, the de-id corpus). Both are transaction-scoped, so nothing leaks across a pooled connection;
- the app connects as a **member of `codecompanion_app`** — data access only, no DDL, no RLS bypass — and migrations run as the owner through `MIGRATE_DATABASE_URL`;
- with `ALLOW_REAL_PHI=true`, the first transaction in a process runs `assertIsolationEnforced()` (`lib/db/isolation.ts`) and **refuses to touch data** until the role is not the owner, has no bypass, every RLS table is forced, every one has a policy, and the service context exists. `npm run db:check` prints the same report.

New tables repeat the pattern — enable + force RLS, a tenant policy, a `_service` policy — and the static guard test (`tests/db-operational.test.ts`) fails otherwise.

**Operator steps (DEPLOY.md §1):** create a login role in the Neon console, `grant codecompanion_app to <that role>;` as the owner, put its connection string in `DATABASE_URL` and the owner's in `MIGRATE_DATABASE_URL`, run `npm run db:migrate`, then `npm run db:check` until it is clean.

---

## PHI minimization

- Collect the minimum necessary. The `patients` table stays as thin as possible (see DATA-MODEL).
- Avoid storing SSN/MRN in cleartext where an opaque `external_ref` will do.
- **The model never sees a patient.** The appeal drafter sends a finding — claim number, codes, payer, dates, the engine's dollar figures — never a name, member id or date of birth; it falls back to a deterministic template until the gate is open, and rejects any letter that invents a dollar figure.
- **Job logs carry counts.** The nightly sync returns totals to Inngest (rows, findings, cents), never a row; audit `detail` is counts and ids; the Follow-up Queue stores claim numbers, not names.
- **Server logs are not a PHI sink.** Nothing in `lib/`, `app/api/` or the sync logs claim or patient data; the only `console.log` calls are the mock clients'.
- The **behavioral corpus never sees a patient.** A patient identifier reaching a corpus table is a breach-class bug — refuse to write that path.

---

## The de-identification boundary (restated, because it matters most)

- Individual claims: tenant-isolated, PHI, RLS-locked.
- Corpus: de-identified aggregates only — payer behavior, not people.
- The transform is one-way and tested. Small-cell suppression (`sample_n` floor) prevents re-identification by inference.

Properly de-identified aggregate statistics can be shared across tenants without violating HIPAA — that is the legal basis for the network effect. The whole moat depends on this line being clean.

---

## Audit & access

- Immutable audit log on every read/write of PHI: who, what, when. `audit_log` is append-only (a trigger rejects UPDATE/DELETE; the runtime role has no UPDATE/DELETE on it); `writeAudit()` is wired into persisted runs, payments, eligibility, enrollment, live Tebra pulls and Tebra writes.
- Least-privilege roles: `codecompanion_app` for the app, the owner for migrations only. The prediction service reads only aggregate corpus columns, never raw claims.
- Reference views use `security_invoker = true` so they respect the caller's RLS rather than the definer's.
- **Staff login** is off while the data is synthetic (`REQUIRE_LOGIN`), forced on with real PHI. Two-factor authentication arrives with the replacement login provider (DEPLOY.md §2) and is required before real PHI.

---

## Hardened edges

- **Security headers** on every response (`next.config.ts`): HSTS with preload, `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, a strict referrer policy, a locked-down permissions policy, same-origin opener policy; no `X-Powered-By`.
- **TLS to the database**, certificate verified by default (`lib/db/sql.ts`); `PG_SSL_STRICT=false` exists for a local endpoint and is refused with real PHI.
- **Cookies**: the module-flag cookie is `httpOnly`, `sameSite=lax`, `secure` in production; sessions are the login provider's.
- Dynamic pages go out `no-store`; nothing PHI-bearing is statically cached.
- Secrets live in the host's secret manager (Cloud Run `--set-secrets`), never in the image or the repo; `.env.local` is git-ignored.

---

## What remains human (and is not in code)

- Signing the BAAs and acknowledging them (`BAA_SIGNED=true`); the risk assessment (`HIPAA_SECURITY_REVIEW=true`).
- Choosing and wiring the login provider with TFA; workforce accounts, offboarding, password policy.
- Workforce HIPAA training; device encryption and screen locks on the practice's computers; the practice's own policies (sanctions, incident response, breach notification, retention).
- Backups and restore drills on Neon (point-in-time recovery is on the Scale plan); verifying them is a person's job.
- Vendor review of anything new that could see PHI (an email provider, a logging service, a scheduler) before it is connected.

This is engineering guidance to keep the build compliant-by-construction. It is **not** legal advice and not a substitute for a HIPAA compliance review, a security risk assessment, or counsel. Before real PHI flows, get a qualified HIPAA/security review and proper legal sign-off on BAAs.

---

## Practical sequencing

The CMS FHIR mandate (Jan 2027) reduces payer data fragmentation right as the platform would be scaling — design the `fhir` adapter slot now, build it then. Use the runway before real-PHI scale to get the compliance gate genuinely closed, not improvised under load.
