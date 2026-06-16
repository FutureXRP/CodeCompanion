# CLAUDE.md — PracticeCompanion

Read this file first, every session. Then read `ARCHITECTURE.md` and `DATA-MODEL.md` before writing any code that touches data flow. Read `COMPLIANCE.md` before anything that could touch PHI.

---

## What this is

PracticeCompanion is a multi-tenant SaaS platform for primary-care practices that finds and recovers revenue the rest of the billing industry leaves on the table, then expands into full revenue-cycle management and, eventually, instant claim settlement.

It is **EHR-agnostic**. It currently has an Athena integration, but Athena is just one *adapter* — the platform core never depends on any specific EHR.

## The long arc (the "ladder")

Build in this order. Each rung produces the data and trust the next rung needs.

- **Rung 0 — Found money.** Diff what was submitted vs. what was paid vs. what was contracted. Surface underpayments, un-appealed denials, and undercoding. Contingency-priced. This is the current focus.
- **Rung 1 — Full RCM** at flat, transparent pricing. Displaces the incumbent billing company.
- **Rung 2 — Predictive adjudication.** Pre-submission scrubber + point-of-care payment prediction, trained on the behavioral corpus.
- **Rung 3 — Settlement.** Advance the practice cash on day one against predicted adjudication. Fintech, not software. Far future. Do not build until Rung 2 is empirically calibrated.

Do not skip rungs. Do not build Rung 2/3 scaffolding speculatively unless a task explicitly says so.

## Current repo state

- **Stack:** Next.js 16, Supabase (Postgres + RLS), Anthropic Claude API, Stripe.
- **Existing modules** (currently bound to an Athena mock): Dashboard, Coding, Care Gaps, Audit Shield, Practice Pulse, Schedule Risk, Revenue Analytics, Settings.
- **Mock-first:** Athena runs against a mock (`ATHENA_USE_MOCK=true`). No real patient data flows yet. No BAAs signed yet. See `COMPLIANCE.md` — this is a hard gate, not a preference.
- The refactor goal is to lift Athena out of the modules into `lib/adapters/athena`, introduce the canonical model, add the EDI adapter, and re-point modules at the canonical model.

---

## SACRED BOUNDARIES — do not violate these

These two design lines are the entire moat. Breaking either is a stop-the-line event.

### 1. The adapter boundary
Nothing above `lib/adapters/` may import an Athena type, an Epic type, an X12 segment name, or any vendor specific. All sources normalize *into* the canonical model (`lib/canonical/`). If module code references a vendor field directly, the abstraction has leaked — fix the adapter, don't pierce it.

### 2. The de-identification gate
- **Individual claims** are tenant-isolated, PHI-bearing, behind row-level security. A tenant sees only its own data, always.
- **The behavioral corpus** (`lib/corpus/`) stores only de-identified aggregate payer-behavior statistics. It must be *structurally impossible* for a patient identifier or `tenant_id` to reach a corpus table.
- The de-id transform is a **one-way gate** with its own tests. Treat any path that could carry PHI into the corpus as a breach, and refuse to write it.

---

## Engineering discipline

### Deterministic vs. LLM — never confuse them
- **Deterministic code** produces every dollar figure and every financial decision: the diff, underpayment math, denial classification, underwriting. Must be auditable and reproducible. No LLM in this path.
- **Claude API** handles language and judgment only: appeal-letter drafting, prior-auth narratives, denial-reason explanation, coding *suggestions*, plain-English summaries of the diff report. It never invents a number.

### Conventions
- TypeScript, strict mode. No `any` in canonical or diff code.
- Money as integer cents, never floats.
- All tenant-scoped tables carry `tenant_id` and an RLS policy. New table without RLS = incomplete.
- EDI parsing uses a maintained X12 library. Do not hand-roll the 837/835 grammar.
- `safeStr()` style guards stay — never render raw nested objects into React.

---

## Working style (how Matt likes to build)

- **One batch commit per session** with complete file replacements. Prefer whole-file rewrites over surgical patches.
- Matt edits via the GitHub pencil (Option A) and runs npm/git in Codespaces.
- When a session is done, summarize what changed and what's next in the commit message.
- If a task is ambiguous, state the assumption inline and proceed; don't stall.

---

## Proposed repo structure

```
/app                     Next.js routes — existing module UIs
/lib
  /adapters
    /athena              Athena adapter (refactor target — lift existing code here)
    /edi                 837/835 file ingestion (universal, build first)
    /fhir                placeholder for CMS Jan-2027 FHIR mandate
  /canonical             canonical model types (the spine)
  /diff                  Rung 0 deterministic engine
  /corpus                de-id transform + behavioral corpus access
  /predict               Rung 2 (later)
  /ledger                Rung 3 (later)
  /ai                    Claude API tasks (appeals, narratives, coding suggestions)
/db
  /migrations            Supabase SQL: schema + RLS policies
CLAUDE.md                this file
ARCHITECTURE.md          system design + the ladder
DATA-MODEL.md            canonical schema, RLS, PHI/de-id rules
ROADMAP.md               phased build plan with concrete deliverables
COMPLIANCE.md            HIPAA posture + mock-mode gate
```

---

## What to build now

See `ROADMAP.md` → **Phase 0**. The first deliverable is the thinnest possible vertical slice: parse an 837 + 835, load a fee schedule, diff them, emit a found-money report — single-tenant, no model, no rail. It runs against Matt's own clinic's data. The dollar figure it produces is the proof of the whole thesis. Build that and nothing more until it works.
