# Platform Architecture — Working Blueprint

*The broader RCM platform. PracticeCompanion becomes Rung 0 inside it.*

**Thesis:** The whole industry is the destination. The architecture wins by getting two boundaries right on day one — (1) a hard line between an EHR-agnostic core and per-EHR adapters, and (2) a hard line between tenant-isolated claims and a de-identified, cross-tenant behavioral corpus. Everything else can be refactored later. These two cannot.

---

## Core principle: the canonical model owns the truth

The core never knows what EHR it is talking to. Every source — Athena, an Epic feed, a raw EDI file drop — normalizes into one canonical internal representation derived from X12 837/835 semantics. Adapters translate *into* the canonical model and never leak vendor specifics past their own boundary.

This single decision is what turns "broader scope" from a rewrite into a configuration. Athena stops being the foundation and becomes one adapter among many.

```
                        ┌─────────────────────────────────────────┐
   SOURCES              │            ADAPTER LAYER                  │
                        │  (the ONLY place vendor specifics live)   │
  Athena API  ───────► │  • athena-adapter                         │
  Raw EDI drop ──────► │  • edi-837-835-adapter  (universal)       │
  Epic / eCW  ───────► │  • epic-adapter, ecw-adapter (later)      │
  FHIR (2027) ───────► │  • fhir-adapter (CMS mandate path)        │
                        └───────────────────┬───────────────────────┘
                                            │ normalizes to
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │          CANONICAL DATA MODEL             │
                        │  Claim · ClaimLine · Encounter ·          │
                        │  Remittance · RemittanceLine · Adjustment │
                        │  PayerContract · FeeScheduleLine          │
                        └───────────────────┬───────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
   ┌──────────────────┐        ┌────────────────────┐        ┌────────────────────┐
   │  DIFF ENGINE      │        │ BEHAVIORAL CORPUS   │        │  AI SERVICES        │
   │  (Rung 0)         │───────►│ (the moat)          │◄──────│  (Claude API)       │
   │  deterministic    │ feeds  │ de-identified,      │        │  appeals, narratives│
   │  money math       │        │ append-only,        │        │  coding suggestions │
   └──────────────────┘        │ cross-tenant aggreg.│        └────────────────────┘
                                └─────────┬───────────┘
                                          │ trains / serves
                                          ▼
                                ┌────────────────────┐
                                │ PREDICTIVE          │
                                │ ADJUDICATION (R2)   │
                                │ point-of-care +     │
                                │ pre-submit scrubber │
                                └─────────┬───────────┘
                                          │ underwrites
                                          ▼
                                ┌────────────────────┐
                                │ SETTLEMENT LEDGER   │
                                │ (Rung 3 — fintech)  │
                                │ advance · repay ·   │
                                │ spread · reconcile  │
                                └────────────────────┘
```

---

## Layer 1 — Adapter layer (ingestion)

The boundary that makes the platform EHR-agnostic. One interface, many implementations:

```
interface SourceAdapter {
  pullClaims(window): CanonicalClaim[]        // 837-equivalent (what we sent)
  pullRemittances(window): CanonicalRemit[]   // 835-equivalent (what they paid + why)
  pullContracts(): PayerContract[]            // fee schedules, where available
}
```

- **edi-837-835-adapter** is the universal path and your first build. X12 837 (claim) and 835 (remittance advice) are the HIPAA-mandated transaction standards — *every* payer exchange produces them. Parse them and you ingest any practice on any EHR. Use a maintained X12 parser; do not hand-roll the segment grammar.
- **athena-adapter** = refactor of PracticeCompanion's existing Athena code, lifted out of the modules and quarantined here. This is the single largest piece of the refactor.
- **fhir-adapter** = design the interface so the Jan 2027 CMS FHIR mandate is just another implementation, not a re-architecture. You want to be ready, not surprised.

**Rule:** nothing above this layer ever imports an Athena type, an Epic type, or an X12 segment name. If it does, the abstraction has leaked.

---

## Layer 2 — Canonical data model

The normalized spine. Minimum viable entities:

- **Encounter** — date of service, rendering provider, place of service, patient (tenant-scoped, PHI).
- **Claim** / **ClaimLine** — CPT/HCPCS, modifiers, units, diagnosis pointers, billed amount.
- **Remittance** / **RemittanceLine** — allowed amount, paid amount, patient responsibility, **Adjustment** records carrying **CARC/RARC** codes (the standardized claim-adjustment-reason and remittance-advice-remark codes — these *are* the machine-readable "why" behind every denial and reduction).
- **PayerContract** / **FeeScheduleLine** — the contracted rate per code per payer. The hardest data to source cleanly; treat acquisition as a first-class problem, not an afterthought.

Everything downstream reads this model and nothing else.

---

## Layer 3 — Diff engine (Rung 0, the wedge)

Deterministic. **Not an LLM.** Money math must be auditable, reproducible, and defensible to a practice's accountant — that means code, not a model that might hallucinate a dollar figure.

It joins three things per line: **837 sent ↔ 835 paid ↔ contracted rate**, and emits:

1. **Underpayment delta** — paid vs. contracted. The jaw-dropper number.
2. **Denial classification** — grouped by CARC/RARC, split into *appealable* vs. *terminal*, ranked by expected recovery value.
3. **Undercoding flags** — patterns where documentation supports a higher-value code than was billed (this is where PracticeCompanion's Coding module is reborn).

Output is the found-money report. This is your entire go-to-market artifact and your data-acquisition engine in one.

---

## Layer 4 — Behavioral corpus (the moat) + the de-identification boundary

**This is the most important and most easily botched part of the whole system.**

The corpus is an append-only event store: every adjudicated line becomes a record of
`(payer, region, specialty, CPT/HCPCS, modifier, contract class) → (allowed, paid, days-to-pay, denial probability, adjustment reasons)`.

The network effect lives here: the more practices and specialties you ingest, the sharper your model of how each payer *actually behaves* versus how it is *contractually obligated* to behave. No incumbent has this cross-practice view.

**The compliance boundary that makes it legal:**
- **Individual claims** stay tenant-isolated, PHI-bearing, locked behind row-level security. A tenant sees only its own claims, ever.
- **The corpus** stores *de-identified aggregate statistics* — payer behavior, not patients. Properly de-identified, aggregate behavioral data can be shared across tenants without violating HIPAA. That is the legal basis for the network effect.
- This separation is **designed in from the first commit**, not bolted on. A patient identifier must be structurally incapable of reaching the corpus. Treat the de-id transform as a one-way gate with its own tests.

Get this right and the moat compounds. Get it wrong and you have a breach, not a business.

---

## Layer 5 — Predictive adjudication service (Rung 2)

Reads the corpus. Given a proposed coded encounter + payer + contract, returns:
`{ predicted_allowed, predicted_paid, denial_risk, expected_days_to_pay, confidence }`.

Two uses from one model:
- **Pre-submission scrubber** — flag claims likely to deny *before* they go out. Pure prevention.
- **Point-of-care estimate** — the foundation Rung 3 underwrites against.

This can be a conventional ML model over the corpus; the LLM's role is explaining *why* a prediction looks the way it does, not generating the number.

---

## Layer 6 — Settlement ledger (Rung 3, where it stops being software)

A proper double-entry ledger, plus a capital source. Using the Rung-2 prediction + confidence, it decides the advance amount and spread, then tracks: **advance → repayment-on-adjudication → reconciliation → spread capture.** This is the Stripe-for-claims layer. It is uninsurable without the corpus, which is the whole point — it's structurally uncopyable by anyone who didn't climb rungs 0–2.

Do not build this until the prediction model is empirically calibrated on real adjudications. Underwriting on a guess is how fintech lending blows up.

---

## Layer 7 — AI services (where the Claude API actually fits)

Strict discipline on LLM vs. deterministic:
- **LLM (Claude API):** appeal-letter drafting, prior-auth narratives, denial-reason interpretation, coding *suggestions*, plain-English explanations of the diff report. Language and judgment tasks.
- **Deterministic code:** all money math, the diff, the underwriting decision. Anything that produces a dollar figure or a financial decision.

Mixing these up is the most common way healthtech AI products lose trust.

---

## Layer 8 — Compliance & multi-tenancy spine (non-negotiable gate)

- Supabase Postgres + **row-level security** for hard tenant isolation (you already run this pattern).
- **BAA-covered infrastructure end to end** — every vendor touching PHI, including the model provider, under a signed BAA. This is the gate that must close before a single real claim flows.
- Immutable audit logging on every PHI access.
- PHI minimization: the corpus never sees a patient.

HIPAA here is architecture, not a checklist item bolted on at the end.

---

## PracticeCompanion refactor map

The eight existing modules sit on the Athena mock today. Where each goes:

| Module | Destination |
|---|---|
| Coding | Undercoding detector (Layer 3) + scrubber feed (Layer 5) |
| Revenue Analytics | Read-view over canonical model + corpus (Layer 2/4) |
| Audit Shield | Read-view over canonical model; denial/risk surfacing |
| Practice Pulse | Read-view over canonical model |
| Care Gaps | Adjacent; stays EHR-fed, re-pointed at adapter layer |
| Schedule Risk | Adjacent; lower priority for this platform |
| Dashboard | Composition surface over the above |
| Settings | Tenant + adapter + contract configuration |

**The refactor itself, in order:** (1) extract every Athena dependency into `athena-adapter`; (2) define the canonical model; (3) re-point each module at the canonical model instead of Athena; (4) add `edi-837-835-adapter` so a non-Athena practice can onboard. After step 4 you are no longer an Athena product.

---

## Tech stack (keep what works)

- **Frontend / app:** Next.js + Supabase (your existing stack — no reason to change).
- **AI:** Anthropic Claude API for the Layer 7 language tasks.
- **Payments:** Stripe for SaaS subscription billing now; the settlement ledger (Rung 3) is a separate, purpose-built ledger, *not* Stripe.
- **EDI:** a maintained X12 837/835 parser library. Do not write the grammar yourself.

---

## Build first — the thinnest vertical slice

Single-tenant, no model, no rail, no multi-tenancy. Just:

```
EDI file upload  →  parse 837 + 835  →  load your fee schedule  →  diff  →  found-money report
```

Run it on **your own clinic's last 12 months of 835s.** The dollar figure that falls out is the proof of the entire thesis and your first sales asset. Everything else on this page is earned by that number being real.

---

## Open decisions to make next

1. Fee-schedule acquisition — how do you get contracted rates cleanly per payer? (Hardest data problem on the page.)
2. Contingency pricing mechanics for Rung 0 — % of recovered, floor, clawback terms.
3. Capital source for Rung 3 — own balance sheet vs. a lending partner.
4. Platform naming — does this stay "PracticeCompanion" expanded, or does the broader platform get its own name with PC as the Rung-0 product inside it?
