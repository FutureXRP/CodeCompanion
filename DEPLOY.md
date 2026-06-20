# DEPLOY.md — the low-cost HIPAA stack

CodeCompanion runs for **a single practice** on a cheap, fully-managed, HIPAA-capable
stack — roughly **$50–100/month** instead of the ~$950/month of the Vercel + Supabase
HIPAA tiers.

| Layer | Service | Why | BAA |
|---|---|---|---|
| Hosting | **Google Cloud Run** | Managed, scales to zero, container-native | Free, via Google Cloud |
| Database (PHI) | **Neon** Postgres | Managed Postgres, HIPAA on the Scale tier | Included on Scale |
| Auth | **Supabase Auth** | Staff logins only — **no patient PHI** | Not needed (no PHI) |
| Language tasks | **Anthropic** | Appeals / narratives / coding suggestions | Yes |
| Eligibility | **Stedi** | 270/271 clearinghouse | Yes |

> Nothing here is needed until you put **real PHI** in the live app. Mock-first
> (`ALLOW_REAL_PHI=false`) costs nothing, and the found-money proof runs locally
> (`npm run found-money`) on your own clinic's files with no cloud at all.

---

## What's ready vs. pending

**Ready now**
- **Container build** — `output: 'standalone'` + a multi-stage `Dockerfile` (non-root, ~minimal).
- **Cloud Run** — the image runs on Cloud Run unchanged (honors the injected `PORT`).
- **Neon connection** — `lib/db/sql.ts` (lazy pool from `DATABASE_URL`, `withTenant()` GUC helper).
- **Migration tooling** — `npm run db:migrate` stands up the full schema on Neon, with a compat
  shim so the Supabase-flavored migrations apply, and `current_tenant_id()` repointed at the GUC.
- **Env template** — `.env.local.example` documents `DATABASE_URL` (Neon) + Supabase-Auth-only.
- **Polite API client** — the athena adapter backs off on 429/503 (rate-limit safe).

**Pending — Phase 2b (the repository port)**
The `lib/db/` repositories still use the **Supabase JS query builder** (`.from(...)`). The
connection layer, GUC/RLS model, and migration tooling are now in place; the remaining step is
swapping those ~32 calls to SQL over the new pool (and the callers from a Supabase data handle to
`withTenant(...)`). They move together because they share `writeAudit` + the DB handle, so it lands
as one tested commit — checklist below.

---

## 1. Neon (database)

1. Create a Neon project on the **Scale** plan; enable **HIPAA** and sign the BAA.
2. Copy the pooled connection string into `DATABASE_URL`
   (`postgres://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
3. Apply the schema + RLS: `DATABASE_URL=… npm run db:migrate` (compat shim → migrations → RLS-GUC).

## 2. Supabase (auth only)

Keep your existing Supabase project for **staff logins** on the cheap Pro tier — it holds
no patient PHI, so it needs no HIPAA add-on. Set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Cloud Run (hosting)

```bash
# Build + push (Artifact Registry)
gcloud artifacts repositories create cc --repository-format=docker --location=us-central1
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT/cc/app:latest

# Deploy
gcloud run deploy codecompanion \
  --image us-central1-docker.pkg.dev/PROJECT/cc/app:latest \
  --region us-central1 --allow-unauthenticated \
  --set-env-vars ATHENA_USE_MOCK=true,ALLOW_REAL_PHI=false
# Put real secrets (DATABASE_URL, ATHENA_*, ANTHROPIC_API_KEY, STEDI_*) in
# Secret Manager and attach with --set-secrets, not plaintext env.
```

Sign the **Google Cloud BAA** (free) before any real PHI. Keep `ALLOW_REAL_PHI=false`
until every BAA in section 2 of `ATHENA-INTEGRATION.md` is signed and the security
review is done; then flip it and run `npm run readiness`.

## 4. Local container smoke test

```bash
docker build -t codecompanion .
docker run -p 8080:8080 --env-file .env.local codecompanion
# open http://localhost:8080
```

---

## Phase 2b checklist (data-layer port — do this before PHI persistence on Neon)

- [x] Postgres driver (`pg`) + `lib/db/sql.ts` (lazy pool from `DATABASE_URL`, `withTenant()` GUC helper).
- [x] `current_tenant_id()` reads the request GUC (`db/neon/zzz_rls_guc.sql`); corpus stays on the service path.
- [x] `scripts/db-migrate.ts` + `npm run db:migrate` (a compat shim makes the Supabase migrations apply to Neon).
- [x] `pg-mem` test harness proven (`tests/db-neon.test.ts`) for the SQL repos.
- [ ] Port `repository.ts`, `operational-repo.ts`, `tenant.ts`, `flags-repo.ts`, `audit.ts` from `.from(...)` to the pool + update callers.
- [ ] Repo round-trip tests against pg-mem; keep `db-operational.test.ts` green.
