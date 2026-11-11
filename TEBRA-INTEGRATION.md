# TEBRA-INTEGRATION.md — CodeCompanion on Tebra

How CodeCompanion plugs into Tebra (formerly Kareo) if SquareOne moves off athenahealth. Written for the practice first, engineering second. Read `COMPLIANCE.md` before anything that could touch real patient data.

---

## The short version

**Tebra runs the rails. CodeCompanion finds the money.**

| Who does it | What |
|---|---|
| **Tebra** | Charge entry, claim submission (its clearinghouse, TriZetto), eligibility checks, ERA/EFT auto-posting, patient statements and card payments |
| **CodeCompanion** | The found-money diff (underpayments, un-appealed denials, unanswered claims), the denial worklist, appeal drafting, coding suggestions, the pre-submission scrubber, the command center |

So on Tebra the Stedi rails are switched **off** in Admin (Eligibility, Claims, Clearinghouse, Enrollments, Patient Billing) and Stedi drops out of the BAA list. Everything else stays.

The reason this is *easier* than athena: one Tebra API record (`GetCharges`) carries all three sides of the Rung 0 join for a service line —

- what was **billed** (`TotalCharges`, CPT, modifiers, units, diagnoses),
- what the **contract expects** (`ExpectedAmount`, from *Settings › Contracts and Fees › Contract Rates*), and
- what the **payer did** (`PrimaryInsuranceAllowed`, `PrimaryInsurancePayment`, contract adjustment + reason code, deductible / coinsurance / copay, adjudication date, claim `Status`).

A single pull therefore yields canonical claims **and** remittances **and** the fee schedule, and the diff runs on it with no 835 file in the loop. (The 835 route still exists: *Encounters › Clearinghouse Reports › Electronic Remittance › Save As* writes a raw ANSI 835 that `npm run found-money` reads — it is the fallback and the audit trail.)

---

## Where it lives

```
lib/adapters/tebra/
  types.ts         raw GetCharges / GetPractices shapes (the guide's field names) — never leave this folder
  xml.ts           tolerant extractor for the flat WCF response records
  client.ts        SOAP client: envelopes, pacing, 429 back-off, 60-day windowing, security semantics
  mock.ts          synthetic clinic day in the real API shape (TEBRA_USE_MOCK=true default)
  to-canonical.ts  charge rows → EhrEncounter / Claim, Remittance, FeeScheduleLine
  index.ts         createTebraSource (mock-first, ALLOW_REAL_PHI gate), pullTebraCanonical
lib/found-money/tebra.ts   runTebraFoundMoney: pull → diff → report
app/api/ehr/tebra/route.ts + components/ehr/TebraPullButton.tsx   the clickable loop (EHR page, Test Console)
scripts/tebra-pull.ts      npm run tebra-pull [from] [to]
supabase/migrations/011_tebra_source_adapter.sql   lets Neon store claims with source_adapter = 'tebra'
```

Nothing above `lib/adapters/tebra` knows a Tebra field name (the adapter boundary in `CLAUDE.md`).

---

## Setting it up (from Tebra's API Integration Technical Guide, April 2026)

1. **Customer Key.** A Tebra **System Administrator** opens a Customer Care case asking for API access (*Product Support › Product API › API Inquiry*). When it is processed, **My Account › Get Customer Key** shows the key. It is one key per Tebra account.
2. **API user.** Create a dedicated Tebra user for the integration (e.g. `api@…`) and give it the **System Admin** role (*Settings › User Accounts › edit user › System Admin*). The API checks the user's permissions on every call and reports what is missing.
3. **Env vars** (local `.env.local` only — never the hosted app until the compliance gate is closed):

   ```
   TEBRA_USE_MOCK=false
   ALLOW_REAL_PHI=true            # practice-controlled, encrypted machine only
   TEBRA_CUSTOMER_KEY=…
   TEBRA_USER=api@squareonemedical.example
   TEBRA_PASSWORD=…               # special characters are fine — the client escapes them
   TEBRA_PRACTICE_NAME=SquareOne Medical     # exactly as shown in Tebra
   # optional
   TEBRA_ENDPOINT=https://webservice.kareo.com/services/soap/2.1/KareoServices.svc
   TEBRA_MAX_WINDOW_DAYS=60       # service-date slice per GetCharges call
   TEBRA_REQUEST_ORDER=header-first   # verified default; 'alphabetical' only per "If the first call fails"
   ```
4. **Prove the connection:** `npm run tebra-pull -- 2026-10-01 2026-10-31`. It prints the encounters it pulled, billed vs contract vs paid per encounter, and the found-money report.
5. **Let Neon keep Tebra runs:** `npm run db:migrate -- --only=011` (one statement, no reset, nothing else re-run).
6. In the app: **EHR Pull** page → *Tebra — charges + ERA pull* → the blue button. Same loop as the athena one: pull → diff → save → Found Money / Claims / Posting Workbench.
7. **Load your contract rates into Tebra** (*Settings › Contracts and Fees › Contract Rates*, per payer, or "Base on Medicare" with a multiplier). Tebra ships that table empty, and it is where `ExpectedAmount` comes from — without it the diff still catches denials and unanswered claims, but underpayment detection is blind. Make it a gating item on the migration checklist.

Until step 3 is done the app and the script run the **synthetic mock** (`TEBRA_USE_MOCK` unset or `true`): no credentials, no network, no PHI. That is also what the hosted Vercel app runs.

### If the first live call fails

- **"not authenticated" with known-good credentials** → set `TEBRA_REQUEST_ORDER=alphabetical`. Tebra's service is WCF, which only reads request elements in its schema order. The default (RequestHeader first, then the filter) is the order independently production-tested clients send; the alternative exists in case Tebra ever regenerates its contract. The client already sorts every field *inside* each element.
- **"user not authorized — missing permissions: …"** → the API user lacks the System Admin role (step 2).
- **"429: … requested more than allowed"** → the client already waits and retries; if it keeps happening something else on the account is hammering the same endpoint (limits are per account, not per user).
- **0 charges** → nothing was *posted* on those service dates; widen the range.

---

## What the adapter reads, and how it maps

| Tebra (`GetCharges` record) | Canonical |
|---|---|
| `EncounterID` (groups the charge lines) | `Claim.controlNumber` = `Remittance.claimControlNumber` |
| `ProcedureCode`, `ProcedureModifier1–4`, `Units`, `TotalCharges`, `DiagnosisCode1–4` | `ClaimLine` (dots stripped from ICD-10 to match the EDI form) |
| `PrimaryInsuranceBilledCompanyName` | `Payer` — key is a slug of the name (no EDI payer id on the record) |
| `ExpectedAmount` (else `AllowedAmount`) | `FeeScheduleLine.contractedCents` — Tebra's contract rates **are** the fee schedule |
| `PrimaryInsurancePayment`, `PrimaryInsuranceAllowed` | `RemittanceLine.paidCents`, `allowedCents` |
| `PrimaryInsuranceContractAdjustment` + `…Reason` (e.g. `CO-45`, `45`, `197`) | `Adjustment` (group + CARC; free text → `UNKNOWN` → manual review) |
| `PrimaryInsuranceDeductible / Coinsurance / Copay` | `PR 1 / 2 / 3` adjustments + `patientRespCents` |
| `Status` = `Error – Denial` | claim status `4` (denied); a denial with no adjustment detail becomes a `CO DENIED` line so it is never mistaken for a $0 payment |
| `Status` = `Pending / Ready / Error-Rejection / Error – No Response` (no payment posted) | **no remittance line** → the diff flags it *unadjudicated* with timely-filing aging |
| `PatientName`, `PatientDateOfBirth`, `PatientID` | `Subscriber` (patient id stands in for the policy number until `GetPatient` enriches it) |
| `GetPractices` → `NPI`, `TaxID` | `BillingProvider` |

Known gaps, on purpose for now:

- **Primary payer only.** Secondary adjudication columns are carried on the raw row but not diffed (one remittance per claim, like one 835 per payer). Medicare→SoonerCare crossovers therefore show the primary's math only.
- **No payer claim number (ICN).** `GetCharges` doesn't carry it; `payerClaimControlNumber` stays empty until `GetTransactions` or the ERA fills it.
- **Encounters billed to the patient only** (no insurance company) are skipped — there is no contract to diff against.
- **Rendering NPI** isn't on the charge record; `providerNpi` falls back to the practice NPI. (`GetProviders` can enrich it when the submit path ever needs it.)

---

## Front Desk — catch it before the patient is in the room

`/frontdesk` (`lib/capture/frontdesk.ts`) is the earliest point in the visit: the day's schedule (`GetAppointments`) joined with each patient's policies and authorizations (`GetPatient`, one paced call per distinct patient), reviewed for what the desk must catch before check-in:

- **No insurance on a billable case** (blocker) · **coverage ended** before the visit (blocker) · coverage **not yet effective** (check) · policy with **no member number** (check)
- **Authorization expired** or **visits used up** (blocker) · authorization **ending within 14 days** (check) · workers-comp / auto / liability visit with **no authorization on file** (check)
- **Copay to collect** (from the policy) and **open balance** (from the account) — the amount to ask for at check-in

Real-time eligibility (270/271) is Tebra's own check against its clearinghouse; this page tells the desk when what is on file is not enough. Cancelled / rescheduled / no-show visits are shown dimmed and not reviewed. The nested `GetPatient` shape (cases › policies › authorizations) is parsed under a few candidate element names and the validator reports whether policies came through.

---

## Pre-approval Review — capture before the claim goes out

Everything above is the *after-the-visit* loop. `/review` (`lib/capture`) is the *before-it-goes-out* loop: it pulls the encounters nobody has approved yet (`GetCharges` with `IncludeUnapprovedCharges=T`, once for `EncounterStatus=Draft` and once for `Review`) and runs two deterministic layers against Tebra's own contract rates:

- **The scrubber** (`lib/scrub`) — what would reject at the clearinghouse or deny/bundle at the payer: missing diagnosis, bundled pairs (NCCI), units over the MUE, E/M without modifier 25 next to a procedure, telehealth modifiers, invalid NPI… Errors are *blockers*, warnings are *fix first*. (The subscriber-address check is skipped: Tebra holds the demographics and builds the 837 itself.)
- **Capture rules** (`lib/capture/rules.ts`) — what the record may support and what is missing: a vaccine without its administration code (90471 / G0008), an E/M whose diagnoses may support the next level (same conservative test as the diff, priced from the contract), Medicare AWV add-ons not billed (G0444, 99497), G2211 on a pure Medicare E/M, a problem visit with a preventive visit lacking modifier 25, duplicate lines, $0 charges.

Every item carries the contracted dollars **at risk** (would be lost as coded) or **available if documented** (separately payable, only when the note supports it). The page is read-only: the provider or biller edits and approves in Tebra. The write path (`UpdateEncounterStatus` → Rejected with a note back to the provider / Approved) is a later step, and only with a flag.

What it needs: the contract rates loaded (step 7 above) — for codes not on any encounter yet (the add-ons), the practice's **Export Contracts and Fees** as the fallback CSV. The mock uses `sampleTebraContractRates()` as that export.

---

## Operations — the runbook

Everything below runs on the mock today and switches to the live account by env alone.

| Step | Command | What it does |
|---|---|---|
| **Day 1 — validate the account** | `npm run tebra-validate -- 2026-10-01 2026-10-31` | Pulls a window and checks the data looks the way the guide says: keys on every line, charges, **contract rates populated**, statuses recognized, CARC codes on adjustments, bill dates, secondary coverage, the practice NPI, the unapproved queue. Exit 1 on any ✗. Do not trust a dollar before this is clean. |
| **Load history** | `npm run tebra-backfill -- 2025-11-01 2026-11-11` | Walks ≤60-day posting-date windows, syncing each one **idempotently** (re-running replaces, never duplicates). ~7 paced calls for a year; run after hours. |
| **Sync once by hand** | `npm run tebra-sync` (or `-- 2026-10-01 2026-10-31`) | The same code the nightly job runs. |
| **Nightly** | `TEBRA_SYNC_ENABLED=true` | Inngest cron (`TEBRA_SYNC_CRON`, default 07:00 UTC): everything modified in the last `TEBRA_SYNC_LOOKBACK_DAYS` (default 3) inside a 60-posting-day window, so a payment posted today on a visit from last month is picked up. |

Each sync: pull → diff → **takeback detection** (any claim whose posted payment went *down* since the last sync becomes a *Recoupment* item on the Posting Workbench) → replace the stored run → **Follow-up Queue** (every Workbench item and every fix-first Pre-approval encounter becomes a task keyed by its source, so a re-sync refreshes the dollars but keeps the owner, status and due date a human set; tasks that stop applying close themselves) → audit (`tebra_charges` read when live, `persist_run` write). Needs migration `012` (`npm run db:migrate -- --only=012`). The tenant comes from `SYNC_TENANT_ID`, or the only tenant when there is exactly one — never a guess.

**Files the practice supplies (both optional, both make the numbers real):**
- `TEBRA_CONTRACT_EXPORT_PATH` — Tebra's *Export Contracts and Fees* saved as CSV. Columns are found by meaning (insurance company, procedure code, modifier, contract rate). Supplies rates for codes not on any encounter yet — the add-ons the Pre-approval Review suggests.
- `NCCI_PTP_PATH` / `NCCI_MUE_PATH` — the CMS practitioner PTP edits and MUE values (quarterly spreadsheets, saved as CSV). Until then the scrubber runs on seed tables — enough to prove the rules, not to clear a payer.

**The write path** (`TEBRA_ALLOW_WRITES=true`): the Pre-approval Review can *Approve in Tebra* or *Send back to provider* (`UpdateEncounterStatus`, Draft/Review only). Off by default; every live write is audited. Against the mock it only changes in-memory state so the queue visibly shrinks.

**`npm run readiness`** reflects all of this: Neon required, Supabase auth required, Stedi only if `CLEARINGHOUSE_PROVIDER=stedi`, Tebra credentials required once `TEBRA_USE_MOCK=false`, and contract rates / NCCI tables / nightly sync reported as pending until configured.

---

## Tebra's RPA bots vs. the Posting Workbench

Tebra quotes two add-ons: an **ERA Processing Bot** ($125/mo + $250 setup) and an **Unapplied Payments Bot** ($125/mo + $350 setup). Each is two things glued together:

| Half | What it is | Who does it on CodeCompanion |
|---|---|---|
| **Robotic posting** — applying every ERA line into Tebra by rule, handling recoupments, matching copays to balances | Screen automation of Tebra's own desktop app. The API has no operation for it (`CreatePayments` makes an *unapplied* payment record; nothing applies a payment to a charge or posts an adjustment), which is exactly why Tebra sells it as "RPA". | **Tebra** — the base plan's *A/R: Auto-Payment Posting* posts the clean ERAs; at ~250 visits a month the exceptions are a handful, worked by a human in Tebra. We do not build screen automation against a vendor's app for money postings. |
| **The workbench** — the consolidated view of claims that need a biller's attention | A ranked queue derived from what Tebra already tracks per charge | **CodeCompanion** — `/workbench` (`lib/found-money/workbench.ts`): appeals (denials, underpayments), fix-and-resubmit (rejected), status checks (no response), secondaries never billed, statements never sent — each with the dollars on it. Deterministic, read-only, from the same pull. |

So: skip both bots at this size. If posting labor ever becomes the bottleneck (in-house billing at higher volume), buy the ERA bot then — nothing here conflicts with it. **If you do, require that posted adjustments keep the CARC/RARC codes** (CO-45, CO-197 …): the diff classifies denials from those codes; a rule that posts denials under a generic Tebra reason still gets flagged, but as "manual review" instead of "appealable — CARC 197".

Recoupments are detected by comparison — a claim whose posted payment went down since the last sync — which works on any source without knowing how it represents a takeback. Not yet built: an unapplied-patient-payment matcher (`GetPayments.Unapplied` ↔ open patient balances — a daily "apply these" list; applying still happens in Tebra).

---

## Behaving well on Tebra's API (guide §3)

- **Rate limits are per account:** `GetCharges`, `GetPayments`, `GetTransactions` 1 call/s; `GetPractices` 1 per ½ s. The client spaces calls and backs off on 429 — calls are delayed, never dropped.
- **Poll rarely, after hours.** Tebra asks for infrequent polling (every couple of hours, not minutes) and says performance is better outside business hours. The daily sync should run once, at night, over the last few days of posting dates.
- **Filters are mandatory** and date filters need both ends; `PracticeName` is the recommended filter. The client always sends it.
- **Backfill in slices.** A 12-month history is pulled as ≤ 60-day service-date windows (≈ 7 calls), de-duplicated by charge ID.
- **Fields are escaped** (`& < > " '`) — the guide warns the password in particular fails silently otherwise.

---

## Compliance posture (unchanged)

Tebra signs a BAA with the practice as its vendor. CodeCompanion's own stack is unchanged — Neon, Google Cloud, Anthropic — **minus Stedi**. The real client is gated exactly like athena's: `createTebraSource` refuses to construct it unless `ALLOW_REAL_PHI=true`, and that flag never goes into the hosted environment (`COMPLIANCE.md`). The migration path (athena history + Tebra going forward) lands in the same canonical model, so the found-money backfill does not care which EHR a claim came from.

---

## Questions to settle with Tebra before signing

1. Is API access included at the quoted tier, and will Customer Care issue the Customer Key for a practice (not a billing company)?
2. Is there a sandbox / test practice? (None is documented — we test mock-first, then read-only against the live account.)
3. How far back do ERAs stay in *Clearinghouse Reports* (the Save-As-835 fallback and the audit trail)?
4. Does the Insurance Collections report now include CARC/RARC from ERA files (promised Jan 2026, then marked pending)?
5. API Terms of Use §4.4 forbids using the API to replicate or compete with Tebra's core products — internal analytics for the practice's own data is ordinary customer use; confirm in writing if CodeCompanion is ever offered to other practices.
