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
6. In the app: **EHR Pull** page → *Tebra — charges + ERA pull* → the blue button. Same loop as the athena one: pull → diff → save → Found Money / Claims.

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
