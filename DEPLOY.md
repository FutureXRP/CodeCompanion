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
- **Env template** — `.env.local.example` documents `DATABASE_URL` (Neon) + Supabase-Auth-only.
- **Polite API client** — the athena adapter backs off on 429/503 (rate-limit safe).

**Pending — Phase 2b (the data-layer port)**
The `lib/db/` repositories still use the **Supabase JS query builder** (`.from(...)`),
which is Supabase-platform-specific. To store PHI in **Neon**, those ~32 calls move to
SQL over a Postgres driver, and RLS switches from the Supabase JWT to a per-request
tenant GUC (`SET LOCAL app.current_tenant = …`). Until that lands, persistence still
targets Supabase; auth and the app shell already run anywhere. This is a contained,
tested change — see the bottom of this file.

---

## 1. Neon (database)

1. Create a Neon project on the **Scale** plan; enable **HIPAA** and sign the BAA.
2. Copy the pooled connection string into `DATABASE_URL`
   (`postgres://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
3. Apply the schema + RLS: run `supabase/migrations/*.sql` against `DATABASE_URL`
   (a `db:migrate` runner ships with Phase 2b).

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

- [ ] Add a Postgres driver + `lib/db/sql.ts` (lazy pool from `DATABASE_URL`, `withTenant()` GUC helper).
- [ ] Port `lib/db/repository.ts`, `operational-repo.ts`, `tenant.ts`, `flags-repo.ts`, `audit.ts` from `.from(...)` to SQL.
- [ ] Switch RLS policies' `current_tenant_id()` to read the request GUC; keep the de-id corpus on the service path.
- [ ] `scripts/db-migrate.ts` + `npm run db:migrate` to apply `supabase/migrations/*.sql` to Neon.
- [ ] Tests for the SQL repos against a disposable Postgres; keep `db-operational.test.ts` green.
