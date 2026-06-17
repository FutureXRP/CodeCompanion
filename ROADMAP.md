# ROADMAP.md — Build Plan

Phases map to the ladder in `ARCHITECTURE.md`. Ship each phase fully before starting the next. Every phase has a concrete "done" definition.

---

## Phase 0 — The found-money slice (current focus)

**Goal:** Prove the entire thesis with one real dollar figure from Matt's own clinic. Single-tenant, no auth, no model, no rail.

Deliverables:
1. `lib/canonical/` — the core model types (claims, lines, remittances, adjustments, fee schedule). Types only, no vendor specifics.
2. `lib/adapters/edi/` — parse a real **837** (claim) and **835** (remittance) file into the canonical model, using a maintained X12 library.
3. Fee-schedule loader — ingest the practice's contracted rates (start from Athena export or CSV for the first clinic).
4. `lib/diff/` — deterministic engine joining 837 ↔ 835 ↔ contracted rate. Emits `findings`: underpayments, un-appealed denials (classified by CARC/RARC), undercoding flags.
5. A found-money report view — ranked by recoverable dollars.

**Done when:** you upload your clinic's last 12 months of 837/835 files and get a credible, line-item recovery total. No multi-tenancy required to call this done.

---

## Phase 1 — Multi-tenant + productized Rung 0

**Goal:** Other practices can onboard and see their own found money. Contingency-priced.

Deliverables:
1. **Auth decision — settled: Supabase Auth** (Clerk is unwired; Supabase binds natively to RLS).
2. ✅ Full schema + RLS migrations per `DATA-MODEL.md` — `supabase/migrations/005_canonical_model.sql`; all tenant-scoped tables RLS-locked and verified with a two-tenant isolation test (`supabase/tests/`).
3. Onboarding: a tenant connects a source — EDI file drop first, Athena adapter second.
4. Refactor existing PracticeCompanion modules off the Athena mock onto the canonical model:
   - Coding → undercoding detector + (later) scrubber feed
   - Revenue Analytics, Audit Shield, Practice Pulse → read-views over canonical model
   - Dashboard → composition surface
5. `lib/ai/` — Claude API for appeal-letter drafting and denial-reason explanation (language tasks only).
6. Stripe wired for SaaS + contingency billing.

**Done when:** a second practice (not Matt's) onboards via EDI, sees its findings, and an appeal letter can be generated.

**Compliance gate:** real PHI for any practice requires the BAA path in `COMPLIANCE.md` to be closed first. Until then, onboarding runs on de-identified or synthetic test data only.

---

## Phase 2 — Predictive adjudication

**Goal:** Stop leakage before it happens; lay the groundwork for settlement.

Deliverables:
1. `lib/corpus/` — the de-id transform + `payer_behavior_corpus`, with gate tests (see DATA-MODEL). Build this carefully; it's the moat and the riskiest table.
2. `lib/predict/` — model returning `{predicted_allowed, predicted_paid, denial_risk, expected_days_to_pay, confidence}` for a proposed coded encounter.
3. Pre-submission scrubber — flag deny-likely claims before they're sent.
4. Point-of-care estimate surface.

**Done when:** the scrubber measurably reduces first-pass denials on real (BAA-covered) data and predictions are calibrated against actual adjudications.

---

## Phase 3 — Settlement (far future, do not pre-build)

**Goal:** Advance practices cash on day one against predicted adjudication.

Gated entirely on Phase 2 being empirically calibrated. Requires a double-entry ledger (`lib/ledger/`), a capital source, and a separate compliance and lending review. Do not scaffold speculatively.

---

## Cross-cutting, every phase

- No new table without RLS (except `[CORPUS]`, which has no tenant column by design).
- No LLM in any path that produces a dollar figure.
- No real PHI before the BAA gate closes.
- One batch commit per session; complete file replacements; summarize changes in the commit message.
