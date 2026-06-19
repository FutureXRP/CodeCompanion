# EHR / PM / Billing Integration Research — for CodeCompanion

*Prepared 2026-06-19. Method: 5 parallel research agents, multi-source web search with inline citations and per-claim confidence. Scope: can CodeCompanion get the 837 (submitted claims) + 835 (remittances) data its found-money diff needs, can a third party bill, and what does access cost.*

---

## The one finding that governs everything (High confidence, universal)

**A certified *clinical* FHIR API (ONC §170.315(g)(10) / US Core) does NOT carry 837/835 claims+remittance data.** That mandated endpoint is clinical-only (problems, meds, labs, vitals, encounters; sometimes `Coverage`). The submitted-vs-paid-vs-contracted data lives in either:

1. the EHR's **proprietary practice-management (PM) / billing API** — and even then as *structured charge/payment objects*, almost never a raw X12 835/837 file; or
2. the **EDI clearinghouse** the practice already submits through.

So "does it have an API?" is almost always **yes** (regulation forces it) — but the question that decides whether CodeCompanion works is **"does it have an API that reaches the billing data?"** Often no. This is why the **clearinghouse/EDI route is the correct primary path**, and the per-EHR PM API is a secondary, deeper integration.

> **"RNXT" disambiguation:** RNXT (NASDAQ: RNXT) is **RenovoRx**, an oncology pharma/device company — no relation to health IT ([ir.renovorx.com](https://ir.renovorx.com/company-information)). The partner you're talking to is **RXNT** (rxnt.com). RXNT deep dive is in §4.

---

## 1. Master chart — EHR / PM vendors

Columns: **API?** · **Billing data (837/835 or charges) reachable by a 3rd party?** · **3rd-party billing allowed?** · **Cost of API/integration** · **Confidence**. Grouped by fit for CodeCompanion.

### Tier A — API-first & billing-friendly (best structural fit)

| Vendor | API | Billing data reachable? | 3rd-party billing? | Cost | Conf |
|---|---|---|---|---|---|
| **Canvas Medical** | API-first: proprietary FHIR + Python SDK, sandbox ✅ | **Yes** — SDK `ClaimSubmission` model explicitly identifies claims from an **external 835**; shared remittance-advice models; `PostClaimPayment` | **Open** — integrates Claim.MD clearinghouse, no captive RCM | Not public / negotiated (part of platform contract) | High (open) / Low (price) |
| **Healthie** | API-first: single **GraphQL** API, public sandbox ✅ | **Yes** — `CMS1500` objects + superbills; ERA via Claim.MD | **Open** — explicitly "export to any external RCM (API access required)" | API = **paid add-on**, Group plan **$149.99/mo**+; add-on price not public | High (claims) / Med (ERA) |
| **Elation Health** | Proprietary REST + FHIR clinical, free PHI-free sandbox ✅ | **Yes** — REST Billing API `bill` resource built "to integrate with a 3rd-party PMS/billing vendor for claim submission"; 835 read-back depth = verify | **Friendliest by design** | Sandbox free; production/partner pricing not public | Med-High |
| **Medplum** | **Open-source** FHIR REST + GraphQL, self-hostable, free managed cloud ✅ | **Yes (data-model)** — first-class FHIR `Claim`, `ClaimResponse`, `ExplanationOfBenefit`; but it's substrate you populate (ingest 835→EOB yourself) | **Fully open** — your infra, any clearinghouse | **Public:** Free / $2,000/mo / $6,000/mo / Ent.; AWS $24k/yr | High |
| **Veradigm / Allscripts** | **Veradigm Connect**; Unity API (SOAP/REST incl. PM) + FHIR; free Open tier + sandbox ✅ | **Yes** — Unity reads/writes financial data (charges/payments); structured, not raw 835 | **Most explicitly open** — publishes a dedicated **"Professional Billing Service Provider (BSP)"** contract | Unity licensed per-practice/yr; Open tier free to start; $ not public | High |

### Tier B — Real billing endpoints, but gated / paid

| Vendor | API | Billing data reachable? | 3rd-party billing? | Cost | Conf |
|---|---|---|---|---|---|
| **athenahealth** | Proprietary REST (800+ endpoints) over **athenaCollector** PM/RCM + FHIR; Marketplace; self-serve sandbox ✅ | **Yes — the differentiator.** Structured claims/charges/payments/eligibility/claim-status via API (raw X12 file access undocumented) | Augment yes; **but billing locked to athena's own clearinghouse** (athenaEDI/ECR) — can't displace it | **Free to list, no setup fee**; partner rev-share % non-public (historical norm ~30%) | High (structured) / Low (raw EDI) |
| **AdvancedMD** | XML-RPC + REST over full PM/EHR + FHIR; public sandbox ✅; signed Cert API Dev Agreement + NDA | **Yes (strong)** — charges, **claims/ERAs**, eligibility, remittance reconciliation; clearinghouse = Optum | **Yes, explicitly** — **AdvancedBiller** program, 800+ independent RCM/billing cos | Paid (license + support + listing); not public | Med-High |
| **Greenway Health** | Greenway Developer Platform: FHIR + proprietary **GAPI** (Intergy/Prime Suite); sandbox ✅ | **Strongest financial exposure** — documented `PatientUnpaidChargeListGet`, `AccountUnpaidChargeListGet`, post-payment | **Relatively open** — Marketplace admits 3rd-party RCM despite selling PrimeRCM | Not public / negotiated | High (endpoints) / High (price non-public) |
| **Tebra (Kareo/PatientPop)** | Proprietary **SOAP** API (legacy Kareo) + FHIR clinical; Partner Connect, invite-gated | **Yes** — `GetPayments`, `GetTransactions` (~1/sec); charges/claims via PM API | **Yes** — dedicated Billing Company Partner track (competes w/ Tebra Managed Billing) | **Metered API calls + ~20% revenue share**; biller API fees custom | Med-High |
| **NextGen** | Enterprise REST (**400+ routes incl. PM**) + FHIR + Bulk; tiered dev program (free Open Access / Distributor) | **Yes (PM API)** — billing/charges/payments; ERA via NextGen Pay/InstaMed; Patient-Access FHIR is clinical-only | Yes — sells own Rev Mgmt Services but PM API + marketplace support external | Patient-Access app dev free; Distributor program may carry data-scope fees; enterprise $ not public | Med-High |
| **eClinicalWorks** | Certified FHIR + bulk via App Orchard; sandbox ✅ | **Yes (out-of-band)** — charge/claim export via **HL7 DFT or 837**, and **835/EOB import** to 3rd-party billers (not via the FHIR API) | Yes — external billers via HL7/837/835; clearinghouse TriZetto/Waystar | FHIR free; RCM = % of collections; PM/integration fees not public | Med-High |

### Tier C — Capable but RCM-protective / partly closed

| Vendor | API | Billing data reachable? | 3rd-party billing? | Cost | Conf |
|---|---|---|---|---|---|
| **DrChrono / EverHealth** | Mature proprietary REST API v4, OAuth2, SDKs, bulk; self-register | **Yes** — `/api/line_items` (insurance transactions) + `/api/line_item_transactions` = charges+payments; no clean raw-835 object | **RCM-leaning** — pushes own billing + full-service RCM (Apollo) | Apollo ~$499–599/provider/mo; RCM = % collections; API fee not public | Med |
| **ModMed** | synapSYS/synAPPS: FHIR (read/search/bulk) + proprietary REST + HL7; sandbox app-gated | Billing via proprietary **synapSYS PM API** — **only for ModMed PM clients**; FHIR has `Coverage`, no Claim/EOB | **Most restrictive** — BOOST RCM **requires ModMed PM** | Not public / negotiated | High (split) / Med (granularity) |
| **Oracle Health (Cerner)** | FHIR R4 "Ignite APIs" + proprietary Millennium REST/SOAP; sandbox ✅ | **Mixed** — FHIR `Account`/`ChargeItem`/`Coverage` reachable; true 837/835 in proprietary Revenue Cycle / RevElate APIs (under-documented, deprecation risk) | Possible via Millennium Rev Cycle; proprietary, implementation-heavy, not self-serve | Sandbox free; cert APIs reportedly ~**$15k/$25k yr** (secondary source); proprietary RCM cost non-public | Med (cert) / Low (RCM) |

### Tier D — Clinical-only / closed / unconfirmed for billing data

| Vendor | API | Billing data reachable? | 3rd-party billing? | Cost | Conf |
|---|---|---|---|---|---|
| **Epic** | Rich clinical FHIR R4 + Bulk + SMART; open.epic sandbox ✅; Showroom (ex-App Orchard) | **No via FHIR** — 837 intake & 835 remittance are **Tapestry X12 batch interfaces**, health-system-configured; FHIR EOB is **payer-side**, not "billed vs paid" | Possible but **provider-org-gated** X12 connections (not self-serve) | Listing ~$100 (Nursery)–$500/yr (Connection Hub); Vendor Services/Workshop non-public | High |
| **Practice Fusion** | Certified FHIR R4 clinical only; rigorous app approval; sandbox ✅ | **No** — no Claim/EOB/835/financial resources; billing via clearinghouse/HL7 out-of-band | Via clearinghouse/HL7 only | **Developer pays $0**; practice pays transaction fees | High |
| **CareCloud** | REST + FHIR; public dev portal | **Unconfirmed** — does full RCM but no public confirmation claims/835 are 3rd-party-readable | **Unclear** — aggressively sells own RCM | Not public | Low |
| **Nextech** | Select API (FHIR STU3) + Practice+ API | FHIR `PaymentReconciliation` exists but **write-leaning** (POST a payment); no 837/835 export | Offers own Payments/RCM; external integration unconfirmed | Not public | Low |
| **Akute Health** | Markets "API-first"; dev portal | **Unconfirmed** — automates "membership billing"; no confirmation 837/835 are API-exposed | Unconfirmed | Not public | Low |
| **Praxis EMR** | HL7/standards interfacing; not a public FHIR dev program | EHR clinical-only **by design** | **Best posture** — *refuses* to do billing, **integrates any 3rd-party biller** ("bring your own billing") | ~$219/provider/mo + support; interface fees | High (posture) / Med (price) |
| **Office Practicum** (peds) | Interop/FHIR + named integrations | Likely clinical FHIR only; billing not via public API | Sells own pediatric RCM; leans in-house | Quote-based; API not public | Med / Low |
| **MEDENT** | Public FHIR API + docs; built-in PM/billing | FHIR clinical; billing is a built-in module, not exposed as 837/835 over the API | All-in-one native billing; 3rd-party access not advertised | Quote-based; API not public | Med |
| **Compulink** | Cloud EHR+PM+RCM; no public API/dev program found | **AdvantageRCM is a billing service** — not a published API | **Locked-ish** toward own RCM | Quote-based | Med / Low |
| **ChartLogic** (Medsphere) | Ambulatory suite; no public API/dev program found | **RCM is a full billing service** ("coding to collections") | **Locked** toward own RCM | Quote-based | Med / Low |
| **CGM Aprima / eMDs** | Public FHIR API + dev accounts + API ToU; 3rd-party marketplace | FHIR/USCDI clinical; 837/835 over public API not confirmed | Mixed — has ARIA RCM service **and** a marketplace | Not public / negotiated | Med |
| **Amazing Charts / Harris** | Public §170.315(g)(10) FHIR API; practice-granted (not self-serve); Picasso PM has an API | EHR APIs clinical; **Picasso PM** is the likelier billing path (verify scope) | Allows 3rd-party integration (practice-gated, fee-based) | Software ~$249/mo; API fees not public | Med / Low |

---

## 2. Clearinghouses — the actual viable path for 837/835

This is where the data CodeCompanion needs actually flows. Ranked by fit.

| Clearinghouse | API | 837/835 + other EDI | 3rd-party / multi-tenant | Pricing | Conf |
|---|---|---|---|---|---|
| **Stedi** ⭐ | **API-first** modern REST/JSON + raw X12 + SFTP; full docs, test mode, self-serve | 837P/I/D, **835 ERA**, 270/271, 276/277, 275, 277CA — all via API | **Built for it** — **Transaction Enrollment API** for "RCM cos doing thousands of enrollments on behalf of many providers" | **Pay-as-you-go, no minimum/setup; 837+835 free**; fund from $100; add-ons (275 $0.75, eligibility PDF $0.05) | High (eligibility per-check rate: Low) |
| **Claim.MD** | REST API + SFTP; dev docs; JSON ERA | 837P/I, **835** (835/PDF/XML/JSON), 270/271, 276/277 | Explicit **"for Software Vendors"** program | **Published:** ~$120/mo unlimited; ~$0.50/claim overage; no per-provider fee | High (list) / Med (vendor terms) |
| **Optum (ex–Change Healthcare)** | Real REST/JSON, OAuth2, sandbox | 270/271, 837P/I, **835** download, 276/277, 275, FHIR | Supported but **enterprise-gated**; payer-list scoped; post-breach onboarding heavier | **Not public / negotiated** | Med |
| **Availity** | API marketplace (REST) + EDI batch | **835**, 837 I/P/D, 276, 278, 270/271 | Serves HITs/vendors/clearinghouses; access via **Contact Sales** | Not public (largely payer-funded) | Med |
| **Waystar** | Platform API v2 (REST + JWT) + SFTP | 270/271, 837P/I/D, 276/277, **835/ERA**, prior auth | "Subject to licensing & entitlements" — partner-gated | Not public / negotiated | Med |
| **Office Ally** | Portal + EDI; legacy SOAP/MIME + REST; SFTP batch | 837P/I/D, **835 ERA** | Common for small billers | **Par claims free**; non-par **$44.95/mo** per Tax ID+NPI | Med-High |
| **TriZetto (Cognizant)** | Mostly SFTP/EDI; new "Unify" headless API + MCP (nascent) | 270/271, 837P/I/D, 276/277, **835** | Established for billers; enrollment-gated, enterprise | Not public / negotiated | Med |

**⚠️ Design caveat (all of them):** these are **forward-flow** — you receive 835s into a mailbox going forward. None cleanly exposes a *historical* claims+remits pull via API. To seed the initial found-money diff, plan for **forward 835 capture + a one-time historical extract** (from the practice's PM/EHR or a clearinghouse data request).

---

## 3. Integration aggregators / data networks — mostly NOT the path

The clinical data networks are built for **Treatment** exchange and **do not carry 837/835**. Flagged by relevance:

| Entity | What it carries | Touches claims/EDI? | Pricing | Relevance |
|---|---|---|---|---|
| **Flexpa** | Member-consented **FHIR** over payer Patient-Access APIs → **CARIN `ExplanationOfBenefit`** | **Adjudicated EOB (payer-side), not 837/835**; read-only | **Published:** from **$10,000** | 🟢 the "paid" leg only |
| **1upHealth** | FHIR platform; CMS Patient/Provider/Payer APIs; **ingests X12 837** | Payer claims + 837 ingest (compliance-oriented, not a clearinghouse) | Not public (custom) | 🟢 payer-side claims |
| **Redox** | Integration engine: HL7v2/C-CDA/**X12**/FHIR across 100+ EHRs | **Can move X12** ("claims & admin integration for clearinghouses/RCM") — a pipe, not a source | Not public (platform fee + per-transaction) | 🟢 infrastructure |
| **Rhapsody / Lyniate** | Integration engine, native **X12** (837 intake, 835 posting) | Routes/transforms 837/835 — overlaps your own `lib/adapters/edi` | Not public (enterprise license) | 🟢 X12 plumbing |
| **Zus Health** | Aggregated FHIR profile from CommonWell/Carequality | FHIR `Claim`/`EOB` **read-only** (risk-adjustment use) — not raw 837/835 | Not public | 🟡 light claims-FHIR |
| **Smile Digital Health** | FHIR CDR / "health data fabric" (payer-side, CMS-0057) | Ingests claims into a CDR you populate | Not public | 🟡 future/FHIR |
| **Datavant** | De-identified record **linkage** (clinical + claims) for RWD | Links, doesn't transport live 837/835 | Not public | 🟡 *precedent for your de-id corpus gate* |
| **Particle / Metriport / Health Gorilla / Kno2** | Clinical query (C-CDA/FHIR) over Carequality/CommonWell/TEFCA | **No** — clinical-only | Not public (Metriport open-source) | 🔴 not for the dollar diff |

---

## 4. RXNT — deep dive (your partnership target)

RXNT (Annapolis, MD; founded 1999) is a cloud, fully-integrated **EHR + Practice Management + Medical Billing/RCM + E-Prescribing + clearinghouse** suite for small/independent practices, billers, and CBOs ([rxnt.com](https://www.rxnt.com/), [Wikipedia](https://en.wikipedia.org/wiki/RXNT)).

| # | Column | Finding | Conf |
|---|---|---|---|
| 1 | **API** | ONC-certified **SMART-on-FHIR R4 / US Core 3.1.1** at `fhir.rxnt.com` + legacy CCDS Clinical Data API ([GitHub repo](https://github.com/RXNT/RxNTClinicalDataAPI), verified clinical-only). **No general partner/dev program, no public sandbox, manual email registration.** | High |
| 2 | **Billing data** | **No** — public API is **clinical-only** (USCDI). No 837/835/PM/financial. Billing lives in RXNT's PM module + the bundled clearinghouse; surfaced only via in-app RCM reporting (RCM Insights) | High (API) / Med (no billing API = negative finding) |
| 3 | **3rd-party billing** | **Yes — favorable.** Explicitly courts external **billers/CBOs** who "manage practices from the same account doctors work in." Clearinghouse **bundled** = Optum/Change family (**Relay Exchange + Connect Center**). Not a locked captive-RCM model | High |
| 4 | **Cost** | API/integration: **not public / negotiated.** Software per provider/mo ≈ **EHR $126 · PM $213 · Full suite $335** (no setup/training/clearinghouse fees) | Med |

**What this means:** RXNT's *public* surface won't deliver 837/835. The real integration paths are **(a)** a negotiated partnership/data feed (presumably the point of the talks), **(b)** pull **835 ERAs from the bundled Optum/Change clearinghouse**, or **(c)** operate as a **third-party biller inside RXNT**. The genuine strategic asset here is RXNT's **external-biller-friendly posture**, not its API.

**⚠️ Diligence flag:** RXNT disclosed a **March 2026 data breach** (unauthorized access Mar 1–3, 2026; PHI of tens of thousands) ([HIPAA Journal](https://www.hipaajournal.com/rxnt-data-breach/)). Relevant to `COMPLIANCE.md` and BAA diligence given no BAAs are signed yet.

---

## 5. Regulatory backdrop (why FHIR ≠ billing data)

- **ONC Cures Act / HTI-1:** certified health IT must expose a FHIR API under **§170.315(g)(10)** (delivered by Dec 31 2022; USCDI v3 baseline from Jan 1 2026). This is **clinical** data — **not** X12 837/835. So "has an API?" ≈ yes everywhere, but it's the wrong data.
- **CMS Interoperability (Patient Access API, enforceable since Jul 2021):** payers expose patients' **claims/EOB via FHIR** (CARIN Blue Button `ExplanationOfBenefit`) — adjudicated, patient-authorized, payer-side. Close to remittance content but per-patient consent, not the 835.
- **CMS-0057-F (finalized Jan 2024):** four payer FHIR APIs; operational PA Jan 1 2026, **FHIR APIs Jan 1 2027**. The **Provider Access API** lets in-network providers retrieve claims/encounters/USCDI **individually or in bulk** — the most relevant **future** EHR-agnostic channel, aligning with your `lib/adapters/fhir` placeholder.

---

## 6. Bottom line for CodeCompanion

**Ranked integration paths that actually deliver 837/835 + claim submission:**

1. **Clearinghouse-direct (Stedi → then Claim.MD).** The primary Rung-0 path: EHR-agnostic, gets real 837/835, multi-tenant enrollment built-in. **You're already on Stedi**, and the enrollment gate we built maps onto its Transaction Enrollment API. This is the spine.
2. **Per-EHR PM/billing API** where the EHR is open & billing-reachable — incumbents **athenahealth, Veradigm, Greenway, AdvancedMD, Tebra, eClinicalWorks**; API-first **Canvas, Healthie, Elation, Medplum**. Use for deeper integration or where you can't reach the practice's clearinghouse.
3. **Payer-side CARIN FHIR EOB (Flexpa / 1upHealth)** as a supplementary, member-consented "paid" view; and the **CMS-0057-F Provider Access API (2027)** as the EHR-agnostic future complement.
4. **Clinical data networks (Particle / Metriport / Health Gorilla):** *not* for the dollar diff — only later for clinical context (care gaps, risk adjustment).

**On RXNT specifically:** the deal's value is the **third-party-biller posture + bundled Optum/Change clearinghouse**, not their API. Get 835s via that clearinghouse (or a negotiated feed); diligence the March-2026 breach before any BAA.

**Two design caveats to bake in now:** (a) no clearinghouse exposes *historical* claims+remits via API → plan a one-time historical extract + forward 835 capture to seed the diff; (b) almost no EHR exposes a *raw* 835/837 — you reconstruct the diff from structured charge/payment objects, so keep the canonical model tolerant of both raw-X12 and structured-object sources.

---

### Confidence & sourcing caveats
- Vendor developer-doc subdomains (Epic/Oracle/athena/Healthie/Canvas/DrChrono/Elation/AdvancedMD/CareCloud/NextGen/ModMed portals) consistently **returned HTTP 403** to automated fetching. Many portal-detail and **pricing** claims rest on search-indexed excerpts + reputable secondary analyses, **not** first-party page reads. **Verify any figure directly with the vendor before commercial reliance.**
- **All API/integration pricing is non-public/negotiated** except **Medplum** (public tiers), **Practice Fusion / NextGen Patient-Access** (developer-side $0), and the published **clearinghouse** rates (Stedi, Claim.MD, Office Ally). No numbers were invented.
- Genuinely **unconfirmed** (do not rely on): CareCloud 3rd-party billing-data API access; Nextech 3rd-party RCM permission; Akute Health billing-via-API; Oracle $15k/$25k cert-API figures (secondary source); athenahealth raw-X12-file access; Rhapsody 837/835 specifics (integrator pages).
