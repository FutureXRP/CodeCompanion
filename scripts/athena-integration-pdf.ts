/* eslint-disable @typescript-eslint/no-explicit-any */
// Generates "Integrating CodeCompanion with athenahealth" as a branded PDF.
// Run: npx tsx scripts/athena-integration-pdf.ts  (pdfkit is the only extra dep)
// Content is grounded in lib/adapters/athena, COMPLIANCE.md, and the EHR research.
import PDFDocument from 'pdfkit'
import { createWriteStream } from 'node:fs'
import path from 'node:path'

// ---- Sage brand palette -----------------------------------------------------
const SAGE = '#3f7d6a', SAGE_D = '#34685a', INK = '#1f2d27', SUB = '#586860'
const FAINT = '#9aa69f', GOLD = '#b8862a', CLAY = '#c1633f', LINE = '#e7e1d6'
const WARMCELL = '#faf8f3', SLATE = '#33403a'

const LEFT = 58, WIDTH = 496, RIGHT = LEFT + WIDTH, PAGE_H = 792, BOTTOM = PAGE_H - 58

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 64, bottom: 58, left: LEFT, right: LEFT },
  bufferPages: true,
  info: {
    Title: 'Integrating CodeCompanion with athenahealth',
    Author: 'CodeCompanion',
    Subject: 'HIPAA-aware setup guide — BAA/PHI compliance + API integration steps',
  },
})
const out = path.join(process.cwd(), 'Athena-Integration-Guide.pdf')
doc.pipe(createWriteStream(out))

// ---- primitives -------------------------------------------------------------
function ensure(h: number) { if (doc.y + h > BOTTOM) doc.addPage() }
function gap(h: number) { doc.y += h }

function h1(text: string) {
  ensure(58)
  gap(8)
  doc.font('Helvetica-Bold').fontSize(14.5).fillColor(SAGE).text(text, LEFT, doc.y, { width: WIDTH })
  const ly = doc.y + 4
  doc.moveTo(LEFT, ly).lineTo(RIGHT, ly).lineWidth(1).strokeColor(LINE).stroke()
  doc.y = ly + 11
}
function h2(text: string) {
  ensure(28)
  gap(5)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(text, LEFT, doc.y, { width: WIDTH })
  doc.y += 3
}
function para(text: string, color = INK, size = 9.8) {
  doc.font('Helvetica').fontSize(size)
  const h = doc.heightOfString(text, { width: WIDTH, lineGap: 2.4 })
  ensure(h + 7)
  doc.fillColor(color).text(text, LEFT, doc.y, { width: WIDTH, lineGap: 2.4 })
  doc.y += 6
}
function bullets(items: Array<string | [string, string]>, color = INK) {
  for (const it of items) {
    const lead = Array.isArray(it) ? it[0] : ''
    const body = Array.isArray(it) ? it[1] : it
    doc.font('Helvetica').fontSize(9.6)
    const indent = 15
    // measure with the bold lead prefixed so wrapping height is right
    const measure = (lead ? lead + '  ' : '') + body
    const h = doc.heightOfString(measure, { width: WIDTH - indent, lineGap: 2.2 })
    ensure(h + 5)
    const y = doc.y
    doc.fillColor(SAGE).font('Helvetica-Bold').fontSize(9.6).text('›', LEFT + 1, y)
    if (lead) {
      doc.fillColor(INK).font('Helvetica-Bold').text(lead + '  ', LEFT + indent, y, { width: WIDTH - indent, continued: true })
      doc.fillColor(color).font('Helvetica').text(body, { width: WIDTH - indent, lineGap: 2.2 })
    } else {
      doc.fillColor(color).font('Helvetica').text(body, LEFT + indent, y, { width: WIDTH - indent, lineGap: 2.2 })
    }
    doc.y += 4
  }
}
function callout(title: string, body: string, variant: 'warn' | 'info' | 'gold' = 'info') {
  const v = {
    warn: { bg: '#fbeee8', border: '#f0d6c8', accent: CLAY, title: '#9d4a28' },
    info: { bg: '#eaf2ee', border: '#d4e6dd', accent: SAGE, title: SAGE_D },
    gold: { bg: '#f8f1dd', border: '#ecdbb2', accent: GOLD, title: '#7a5a18' },
  }[variant]
  const padX = 13, padY = 11, innerW = WIDTH - padX * 2 - 4
  doc.font('Helvetica-Bold').fontSize(9.8)
  const tH = doc.heightOfString(title, { width: innerW })
  doc.font('Helvetica').fontSize(9.4)
  const bH = doc.heightOfString(body, { width: innerW, lineGap: 2.2 })
  const boxH = padY * 2 + tH + 4 + bH
  ensure(boxH + 8)
  const y = doc.y
  doc.roundedRect(LEFT, y, WIDTH, boxH, 7).fillAndStroke(v.bg, v.border)
  doc.roundedRect(LEFT, y, 4.5, boxH, 2).fill(v.accent)
  doc.fillColor(v.title).font('Helvetica-Bold').fontSize(9.8).text(title, LEFT + padX + 4, y + padY, { width: innerW })
  doc.fillColor(SLATE).font('Helvetica').fontSize(9.4).text(body, LEFT + padX + 4, y + padY + tH + 4, { width: innerW, lineGap: 2.2 })
  doc.y = y + boxH + 8
}
function codeBox(lines: string[]) {
  const padX = 12, padY = 10, lineH = 12.4
  const boxH = padY * 2 + lines.length * lineH
  ensure(boxH + 8)
  const y = doc.y
  doc.roundedRect(LEFT, y, WIDTH, boxH, 6).fillAndStroke('#f3f1ea', '#e2ddd0')
  doc.font('Courier').fontSize(8.4).fillColor(SLATE)
  lines.forEach((ln, i) => {
    const isComment = ln.trimStart().startsWith('#')
    doc.fillColor(isComment ? FAINT : SLATE).text(ln, LEFT + padX, y + padY + i * lineH, { width: WIDTH - padX * 2, lineBreak: false })
  })
  doc.y = y + boxH + 8
}
function table(cols: Array<{ label: string; w: number }>, rows: string[][]) {
  const padX = 7, padY = 5.5
  const xs: number[] = []
  let cx = LEFT
  for (const c of cols) { xs.push(cx); cx += c.w }
  const drawHeader = () => {
    const hH = 19
    const hy = doc.y
    doc.rect(LEFT, hy, WIDTH, hH).fill(SAGE)
    doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#ffffff')
    cols.forEach((c, i) => doc.text(c.label, xs[i] + padX, hy + 5.5, { width: c.w - padX * 2, lineBreak: false }))
    doc.y = hy + hH
  }
  ensure(40)
  drawHeader()
  let zebra = false
  for (const row of rows) {
    doc.font('Helvetica').fontSize(8.4)
    let rowH = 0
    row.forEach((cell, i) => { rowH = Math.max(rowH, doc.heightOfString(cell, { width: cols[i].w - padX * 2, lineGap: 1.5 })) })
    rowH += padY * 2
    if (doc.y + rowH > BOTTOM) { doc.addPage(); drawHeader(); zebra = false }
    const y = doc.y
    if (zebra) doc.rect(LEFT, y, WIDTH, rowH).fill(WARMCELL)
    doc.font('Helvetica').fontSize(8.4).fillColor(INK)
    row.forEach((cell, i) => {
      const bold = i === 0
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? INK : SUB)
      doc.text(cell, xs[i] + padX, y + padY, { width: cols[i].w - padX * 2, lineGap: 1.5 })
    })
    doc.moveTo(LEFT, y + rowH).lineTo(RIGHT, y + rowH).lineWidth(0.6).strokeColor(LINE).stroke()
    doc.y = y + rowH
    zebra = !zebra
  }
  doc.y += 8
}

// ---- COVER ------------------------------------------------------------------
doc.rect(0, 0, doc.page.width, 132).fill(SAGE)
doc.rect(0, 132, doc.page.width, 4).fill(GOLD)
doc.font('Helvetica-Bold').fontSize(9).fillColor('#cfe3d9').text('CODECOMPANION  ·  EHR INTEGRATION GUIDE', LEFT, 40, { characterSpacing: 1.2 })
doc.font('Helvetica-Bold').fontSize(25).fillColor('#ffffff').text('Integrating with athenahealth', LEFT, 60, { width: WIDTH })
doc.y = 156
doc.font('Helvetica').fontSize(11.5).fillColor(INK).text('A HIPAA-aware setup guide — run it for your own practice, alongside athena.', LEFT, doc.y, { width: WIDTH, lineGap: 2 })
doc.y += 4
doc.font('Helvetica').fontSize(9).fillColor(FAINT).text('Prepared for Matt  ·  June 20, 2026  ·  Internal / Confidential  ·  Engineering guidance, not legal advice', LEFT, doc.y, { width: WIDTH })
doc.y += 14

para(
  'Scope: a single practice — your own. This guide assumes you run CodeCompanion for your own clinic, not for sale to ' +
  'other practices; that removes the heavy vendor obligations (Marketplace certification, HITRUST, cross-tenant data ' +
  'questions), which live in Appendix A. It covers the compliance posture (PHI, BAAs, the ALLOW_REAL_PHI gate), then ' +
  'the concrete API steps, on a low-cost HIPAA stack — Cloud Run + Neon + Supabase Auth, roughly $50–100/month versus ' +
  'the ~$950/month of the Vercel + Supabase HIPAA tiers.',
  SUB)

// compact contents
gap(2)
doc.font('Helvetica-Bold').fontSize(8.6).fillColor(SAGE).text('IN THIS GUIDE', LEFT, doc.y, { characterSpacing: 0.8 })
doc.y += 3
const toc = [
  '1.  The integration model — and why billing stays off',
  '2.  HIPAA, PHI & BAAs (read before any real data)',
  '3.  Prerequisites (athena-specific)',
  '4.  API integration steps',
  '5.  Reference — OAuth, endpoints, environment variables',
  '6.  What’s built vs. what’s next (honest scope)',
  '7.  Recommended sequence (checklist)',
  'Appendix A.  If you sell it later (multi-tenant)',
]
doc.font('Helvetica').fontSize(9.4).fillColor(INK)
for (const t of toc) { doc.text(t, LEFT + 4, doc.y, { width: WIDTH - 4 }); doc.y += 2 }

// ---- 1. MODEL ---------------------------------------------------------------
h1('1.  The integration model — and why billing stays off')
para(
  'athenahealth stays your system of record and your biller. CodeCompanion sits beside it as the office-manager ' +
  'intelligence layer, with its own billing rails switched OFF. CodeCompanion pulls clinical encounters and charges ' +
  'from athena into its canonical model and runs its cockpit, clinical intelligence, and eligibility on top — it never ' +
  'submits a claim for an athena practice and never writes back to athena billing.')
callout(
  'Why billing is off — this is by design, not a limitation',
  'athenahealth locks claim submission to its own clearinghouse (athenaEDI / ECR). Third-party billing through any ' +
  'other clearinghouse is not permitted — it is how athena monetizes the platform. So CodeCompanion runs in ' +
  '“Clinical only (EHR billing)” mode: one click in Admin -> Module control turns the whole Billing & RCM group off. ' +
  'That control shipped in this build precisely for this scenario.',
  'warn')
h2('What you gain right now')
bullets([
  ['The cockpit.', 'Command Center, Follow-up Queue, and Dashboard — the office-manager command center over athena’s day.'],
  ['Clinical intelligence on athena encounters.', 'Coding suggestions, Care Gaps, Audit Shield, Practice Pulse, Schedule Risk, and Revenue Analytics.'],
  ['Real-time eligibility.', '270/271 verification via Stedi — read-only, no clearinghouse enrollment, and it does not conflict with athena’s billing.'],
  ['Found-money analytics (Phase 2).', 'Diff athena’s submitted-vs-paid to surface underpayments, denials, and undercoding — read-only; it never re-submits a claim.'],
])
h2('Data flow (one-way pull)')
codeBox([
  'athena API                          CodeCompanion',
  '  /claims, /patients,     -->  canonical model  -->  modules',
  '  /insurances, /providers      (EhrEncounter -> Claim)   (cockpit,',
  '                                                          intelligence,',
  '  (encounters + charges)                                  eligibility)',
  '',
  '  # PHI is pulled IN and normalized. Nothing is written back to athena.',
])

// ---- 2. COMPLIANCE ----------------------------------------------------------
h1('2.  HIPAA, PHI & BAAs (read before any real data)')
para(
  'You are still handling your patients’ PHI, so HIPAA fully applies even for a single practice. CodeCompanion treats ' +
  'compliance as architecture, not a checklist: the platform must not process real patient data until the gate below ' +
  'is closed. Until then everything runs on synthetic data (ATHENA_USE_MOCK=true, ALLOW_REAL_PHI=false).')
h2('The hard gate (from COMPLIANCE.md)')
bullets([
  ['BAAs signed', 'with every vendor in the PHI path (the table below).'],
  ['Audit logging live', 'on every PHI access (already built: an immutable, append-only audit log).'],
  ['Encryption + access control', 'on the data plane — Postgres RLS is already built and CI-guarded.'],
  ['ALLOW_REAL_PHI stays false', 'until the above is true; it gates every real-PHI rail, including the live athena client.'],
])
callout(
  'The master switch: ALLOW_REAL_PHI',
  'ALLOW_REAL_PHI stays false until the gate above is closed. It gates every real-PHI rail, including the live athena ' +
  'client — createAthenaSource throws unless it is set. The app runs mock-first (ATHENA_USE_MOCK=true) until you ' +
  'deliberately flip it. Each cloud vendor in the PHI path needs its own BAA.',
  'info')
h2('Business Associate Agreements you need (low-cost stack)')
table(
  [{ label: 'Vendor', w: 112 }, { label: 'Role in the PHI path', w: 212 }, { label: 'BAA?', w: 74 }, { label: 'Cost', w: 98 }],
  [
    ['athenahealth', 'Source of clinical encounters + charges (PHI in)', 'Yes', 'via athenaOne'],
    ['Google Cloud (Cloud Run)', 'Hosts / serves the app (renders PHI)', 'Yes — free', '~$0–40/mo'],
    ['Neon', 'Postgres database storing PHI at rest', 'Yes — included', '~$20–70/mo'],
    ['Anthropic', 'Language tasks only (appeals/narratives)', 'Yes', 'usage'],
    ['Stedi', 'Clearinghouse 270/271 eligibility (PHI to payers)', 'Yes', 'usage'],
    ['Supabase (Auth only)', 'Staff logins — no patient PHI', 'No — no PHI', '~$25/mo'],
    ['Stripe', 'Card payments (only if tied to PHI)', 'If applicable', 'usage'],
  ])
para('Supabase holds only staff logins (no patient PHI), so it needs no HIPAA tier/BAA. Total ~$50–100/mo vs. ~$950/mo for the Vercel + Supabase HIPAA tiers.', FAINT, 8.6)
callout(
  'One structural question for counsel',
  'Is CodeCompanion internal to the practice (same legal entity -> no extra BAA between it and the practice), or a ' +
  'separate tool/company serving the practice (-> a BAA between CodeCompanion and the practice)? Either way the cloud ' +
  'vendors above still need BAAs. A five-minute check, but worth doing.',
  'info')
h2('athena-specific compliance notes')
bullets([
  ['Minimum necessary.', 'The adapter requests only the MDP (“More Disruption Please”) service scope (athena/service/Athenanet.MDP.*) and pulls only the encounter, charge, insurance, and provider fields needed to build a claim — nothing more.'],
  ['The adapter boundary contains PHI.', 'athena field names never leave lib/adapters/athena; everything normalizes into the canonical model, tenant-isolated under RLS.'],
  ['Key security (athena ToS §2).', 'Keep client_id / client_secret server-side only (env vars, never shipped to the client); restrict access to employees who need them; never share or transfer keys; and notify MDPDev@athenahealth.com on any compromise.'],
  ['Read the agreements before signing.', 'Review athena’s data terms, the Master Services Agreement Third-Party Terms, and your athenaOne agreement alongside the BAA. Note athena exposes structured charge/payment objects, not raw X12 837/835 files.'],
])
callout(
  'Not legal advice',
  'This is engineering guidance to keep the build compliant-by-construction. It is not a substitute for a HIPAA ' +
  'security risk assessment or counsel. Get a qualified review and proper BAA sign-off before any real PHI flows.',
  'gold')

// ---- 3. PREREQUISITES -------------------------------------------------------
h1('3.  Prerequisites (athena-specific)')
para('Supabase Auth, Google Cloud, Neon, and GitHub are assumed set up (see section 5 / the repo for the stack). What is specific to athena:')
bullets([
  ['Developer account.', 'Register at developer.athenahealth.com.'],
  ['A registered application.', 'Create an app to obtain a client_id and client_secret. Start in Preview (sandbox).'],
  ['Your practice + department.', 'The athenaNet practiceid (the Preview sandbox practice is 195900) and at least one departmentid.'],
  ['The MDP scope.', 'Request the athena/service/Athenanet.MDP.* scope on the app.'],
])
callout(
  'Your access path (own practice)',
  'Preview/sandbox is instant and free (practice 195900, dummy data). For your real data, athena issues production ' +
  'credentials for your practice — a light step, with no Marketplace listing or certification, since you are not ' +
  'distributing to other practices. (If that ever changes, see Appendix A.)',
  'info')
para('You will set the athena environment variables (section 5) plus the stack’s DATABASE_URL (Neon).', SUB)

// ---- 4. STEPS ---------------------------------------------------------------
h1('4.  API integration steps')

h2('Step 1 — Register the app in Preview')
para('At developer.athenahealth.com, open the Developer Console -> Create New Application, then record the client_id and client_secret. Preview data is synthetic, so connecting is safe before any BAA. The form has three choices that decide whether the app can even reach billing data — set them like this:')
callout(
  'Create-Application choices that match this build',
  'API Access — choose “1+ non-Certified APIs.” The billing/charge/claim data lives in athena’s non-Certified proprietary REST (athenaCollector); the Certified (g)(8)–(g)(10) FHIR APIs are clinical-only and will NOT carry it, so “Certified APIs only” locks you out of the data you need.\n' +
  'App Category — choose “2-Legged OAuth” (service-to-service / client_credentials), exactly what the adapter uses. (3-legged is for SMART-on-FHIR provider/patient login, which we do not use.)\n' +
  'Authentication — choose “Secret” (a client_secret), matching the adapter’s Basic base64(client_id:client_secret). JWK / private_key_jwt is a more secure future swap (section 6), but Secret is the right call to connect.\n' +
  'Do NOT check “I am building a CAPI app” — that is for ONC-Certified API apps, not a non-certified service app. On App Details, request the athena/service/Athenanet.MDP.* scope.',
  'info')

h2('Step 2 — Identify practice + department')
para('Use Preview practiceid 195900 to start. For production, use your real practiceid and department id(s).')

h2('Step 3 — Configure the environment')
para('Set these in your staging deployment first (see the full table in section 5):')
codeBox([
  'ATHENA_CLIENT_ID=...                       # from the Preview app',
  'ATHENA_CLIENT_SECRET=...',
  'ATHENA_PRACTICE_ID=195900                  # Preview sandbox practice',
  'ATHENA_BASE_URL=https://api.preview.platform.athenahealth.com',
  'ATHENA_USE_MOCK=false                      # use the real client (against Preview)',
])
callout(
  'Sandbox vs. PHI — flip ALLOW_REAL_PHI in staging only',
  'The live athena client is gated behind ALLOW_REAL_PHI. athena Preview is synthetic, so to exercise the live client ' +
  'against Preview you set ALLOW_REAL_PHI=true in a NON-production staging deploy only — and keep every other real rail ' +
  'mock (CLEARINGHOUSE=mock or STEDI_SANDBOX=true, no live Stripe key). Never set ALLOW_REAL_PHI=true in production until ' +
  'the BAA gate in section 2 is fully closed.',
  'warn')

h2('Step 4 — Validate OAuth + the encounter pull')
para('The adapter performs an OAuth2 client-credentials exchange (token cached until ~60s before expiry), then pulls a day of claims and joins each to its patient, insurance, and provider. In staging, confirm the token issues and a pull returns joined bundles:')
codeBox([
  "import { createAthenaSource, athenaConfigFromEnv,",
  "         pullAthenaEncounters } from '@/lib/adapters/athena'",
  '',
  'const source = createAthenaSource(athenaConfigFromEnv())',
  "const encounters = await pullAthenaEncounters(source,",
  "  { serviceDateFrom: '2026-06-01', serviceDateTo: '2026-06-01' })",
])

h2('Step 5 — Verify the canonical mapping')
para('pullAthenaEncounters yields canonical EhrEncounters; encounterToClaim(e, “athena”) turns each into a canonical Claim. Confirm CPT/HCPCS, ICD-10 pointers, charge cents, subscriber, and payer populate correctly.')
callout(
  'One crosswalk to wire: athena payer id -> EDI payer id',
  'athena’s insurancepackageid is athena-internal. For real-time eligibility through Stedi, resolve it to the ' +
  'clearinghouse/EDI payer id via the PayerDirectory at the submission edge. This is the one remaining adapter task — see section 6.',
  'info')

h2('Step 6 — Turn billing off, then choose your modules')
para('In Admin -> Module control, click “Clinical only (EHR billing)” to turn the entire Billing & RCM group off. Then re-enable the read-only analytics you want running alongside athena. Recommended configuration:')
table(
  [{ label: 'Modules', w: 188 }, { label: 'State', w: 56 }, { label: 'Why', w: 252 }],
  [
    ['Command Center, Follow-up Queue, Dashboard', 'On', 'The cockpit — your daily drivers over athena’s day.'],
    ['Coding, Care Gaps, Audit Shield, Practice Pulse, Schedule, Analytics', 'On', 'Clinical intelligence on athena encounters. Read-only.'],
    ['EHR Pull', 'On', 'Pulls encounters from athena into the canonical model.'],
    ['Eligibility', 'On', 'Real-time 270/271 via Stedi. Read-only; no enrollment.'],
    ['Found Money, A/R & Denials', 'On (Phase 2)', 'Analytics on athena’s submitted-vs-paid. Turn on once payments are wired (section 6).'],
    ['Claims (RCM), Clearinghouse, Enrollments, Scrubber, Patient Billing, Patient Balances', 'Off', 'athena owns billing and the clearinghouse. Do not run these.'],
  ])

h2('Step 7 — Go to production')
para('When the BAA gate is closed: sign the BAAs (section 2), deploy the app to Cloud Run pointed at your Neon database, set the real athena values, flip the gate, and run the readiness check until green.')
para('Production access is not just a URL swap: athena issues separate production credentials — distinct from your Preview keys — through its partner / MDP process. Request them early; that approval is the long pole on the timeline.', SUB)
codeBox([
  'ATHENA_BASE_URL=https://api.platform.athenahealth.com   # production',
  'ATHENA_PRACTICE_ID=<your real practiceid>',
  'ATHENA_USE_MOCK=false',
  'ALLOW_REAL_PHI=true                  # only after BAAs + security review',
  'DATABASE_URL=postgres://...neon...   # HIPAA Neon (Scale tier)',
  '',
  '# then:  npm run readiness           # env-aware go/no-go check',
])

// ---- 5. REFERENCE -----------------------------------------------------------
h1('5.  Reference — OAuth, endpoints, environment variables')
h2('What the adapter calls')
codeBox([
  'POST {base}/oauth2/v1/token',
  '   Authorization: Basic base64(client_id:client_secret)',
  '   grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*',
  '',
  'GET  {base}/v1/{practiceid}/claims?servicedatefrom=MM/DD/YYYY&servicedateto=..',
  'GET  {base}/v1/{practiceid}/patients/{patientid}',
  'GET  {base}/v1/{practiceid}/patients/{patientid}/insurances',
  'GET  {base}/v1/{practiceid}/providers/{providerid}',
  '',
  '# base = Preview  https://api.preview.platform.athenahealth.com',
  '#        Prod     https://api.platform.athenahealth.com',
])
h2('Environment variables')
table(
  [{ label: 'Variable', w: 150 }, { label: 'Staging / Preview', w: 168 }, { label: 'Notes', w: 178 }],
  [
    ['ATHENA_USE_MOCK', 'false', 'true = synthetic mock (default). false = real client.'],
    ['ALLOW_REAL_PHI', 'true (staging only)', 'Master gate. Production: only after BAAs + review.'],
    ['ATHENA_CLIENT_ID', '<preview app id>', 'OAuth client id from developer.athenahealth.com.'],
    ['ATHENA_CLIENT_SECRET', '<preview secret>', 'OAuth client secret. Server-side only.'],
    ['ATHENA_PRACTICE_ID', '195900', 'Preview practice; your real practiceid in prod.'],
    ['ATHENA_BASE_URL', 'preview URL', 'Preview vs. production base (see above).'],
    ['DATABASE_URL', '<neon staging>', 'Postgres (Neon). PHI at rest — HIPAA Scale tier in prod.'],
  ])

// ---- 6. SCOPE ---------------------------------------------------------------
h1('6.  What’s built vs. what’s next (honest scope)')
h2('Built in this repo')
bullets([
  ['OAuth2 client.', 'Client-credentials token exchange with caching; injectable transport (unit-tested without a network).'],
  ['Encounter + charge pull.', 'getEncounterBundles joins claims to patient, insurance, and provider for a service-date range.'],
  ['athena -> canonical mapping.', 'athenaBundleToEhrEncounter -> EhrEncounter -> encounterToClaim. Money as integer cents; no athena type escapes the adapter.'],
  ['Mock source + tests.', 'A synthetic MockAthenaSource and six passing tests covering OAuth, the join, and the mapping.'],
  ['The billing-off control.', 'Admin module control + the “Clinical only (EHR billing)” preset, built for exactly this integration.'],
])
h2('Next, to complete the athena value loop')
bullets([
  ['Wire EHR Pull to a sync.', 'Connect pullAthenaEncounters to the EHR Pull screen and/or a scheduled job (Inngest) so encounters land daily.'],
  ['Payer-id crosswalk.', 'Resolve athena insurancepackageid -> EDI payer id at the eligibility edge so one-click eligibility works on athena patients.'],
  ['Phase 2 — pull payments.', 'Pull athena payment/remittance objects and map them to the canonical remittance to power the Found-Money diff (submitted vs. paid vs. contracted) on athena’s own data. This is the high-ROI “found money” proof, and it is read-only.'],
  ['Add 429 backoff to the sync.', 'athena’s production rate limits are not published numerically (HTTP 429 on throttle), so the daily pull should retry with exponential backoff. The token is already cached for its one-hour life.'],
])
para('Effort is small-to-medium and stays entirely behind the mock + ALLOW_REAL_PHI gates.', SUB)

// ---- 7. CHECKLIST -----------------------------------------------------------
h1('7.  Recommended sequence (checklist)')
const steps = [
  'Register an athena Preview app (API Access = non-Certified, Category = 2-Legged, Auth = Secret); capture client_id / client_secret; note practiceid 195900.',
  'Set the env vars in a staging deploy: ATHENA_USE_MOCK=false, ALLOW_REAL_PHI=true (staging only, every other rail mock).',
  'Validate OAuth + the encounter pull + the canonical mapping against Preview (synthetic data).',
  'In Admin, apply “Clinical only (EHR billing)”; confirm the sidebar reflects athena-mode.',
  'Wire the EHR Pull sync and the payer-id crosswalk (section 6).',
  'In parallel (business / legal): confirm/sign the athenahealth BAA + the cloud BAAs (Google Cloud, Neon, Anthropic, Stedi); book a HIPAA security review.',
  'Provision production: real practiceid, prod base URL, deploy to Cloud Run + Neon, ALLOW_REAL_PHI=true, run npm run readiness until green.',
  'Phase 2: wire athena payments -> Found-Money to prove recovered revenue on athena’s data.',
]
steps.forEach((s, i) => {
  doc.font('Helvetica').fontSize(9.6)
  const h = doc.heightOfString(s, { width: WIDTH - 26, lineGap: 2.2 })
  ensure(h + 9)
  const y = doc.y
  doc.circle(LEFT + 8, y + 6, 8.5).fill(SAGE)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.6).text(String(i + 1), LEFT + 4.5, y + 2.4, { width: 8, align: 'center' })
  doc.fillColor(INK).font('Helvetica').fontSize(9.6).text(s, LEFT + 26, y, { width: WIDTH - 26, lineGap: 2.2 })
  doc.y = Math.max(doc.y, y + 17) + 5
})

// ---- APPENDIX A -------------------------------------------------------------
h1('Appendix A.  If you sell it later (multi-tenant)')
para(
  'You are building for your own practice. If that ever changes and you distribute CodeCompanion to other athena ' +
  'practices, a different set of obligations switches on. None of this is needed now — but here is what comes back, ' +
  'and the architecture is already built for it.')
bullets([
  ['athena Marketplace path (ToS §1(f)).', 'Distributing access to other practices needs athena’s prior written approval via the Marketplace program: API certification + a data-security review + a workflow assessment (~6–12 weeks), a HITRUST self-assessment within 90 days of going live, and a 15–30% revenue share on Marketplace-channeled revenue (no setup or interface fees).'],
  ['Confidentiality vs. the corpus (ToS §7).', 'Data from the API is athena Confidential Information, usable “only as necessary” and not disclosable to third parties without consent. Building the cross-tenant de-identified corpus (Rung 2 moat) from athena-sourced data needs counsel to clear it — the PHI->corpus gate is clean in code, but this is a contractual layer on top.'],
  ['Fraud & abuse (ToS §8).', 'A third-party billing arrangement with contingency / percentage pricing, plus AI coding suggestions, carries Anti-Kickback / Stark / False-Claims exposure -> get healthcare-regulatory counsel on the pricing model. For your own practice there is no outside biller taking a cut, so this does not apply today.'],
  ['Already built for multi-tenant.', 'Postgres RLS, tenant_id isolation, and the de-id corpus gate (lib/corpus) are in the repo, running as a single tenant today. Cloud Run + Neon scale to many tenants without a re-platform.'],
])

// ---- footers ----------------------------------------------------------------
const range = doc.bufferedPageRange()
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i)
  doc.page.margins.bottom = 0 // writing in the footer band must not trigger auto page-breaks
  const fy = PAGE_H - 40
  doc.moveTo(LEFT, fy).lineTo(RIGHT, fy).lineWidth(0.6).strokeColor(LINE).stroke()
  doc.font('Helvetica').fontSize(7.6).fillColor(FAINT)
  doc.text('CodeCompanion  ·  athenahealth integration guide  ·  Confidential — not legal advice', LEFT, fy + 6, { width: WIDTH * 0.75, lineBreak: false })
  doc.text(`Page ${i + 1} of ${range.count}`, LEFT, fy + 6, { width: WIDTH, align: 'right', lineBreak: false })
}

doc.end()
console.log('Wrote', out)
