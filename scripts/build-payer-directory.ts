import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

/**
 * Builds the bundled Stedi payer directory from a Stedi payer-list CSV export.
 *
 *   npx tsx scripts/build-payer-directory.ts <path-to-stedi-payers.csv>
 *
 * Emits lib/rcm/payers/stedi-payers.json (the runtime artifact). Re-run whenever
 * Stedi publishes a fresh export. Keeps only the fields the app needs.
 */

const src = process.argv[2]
if (!src) {
  console.error('usage: tsx scripts/build-payer-directory.ts <stedi-payers.csv>')
  process.exit(1)
}

const rows = parseCsv(readFileSync(src, 'utf8'))
const header = rows[0]
const col = (name: string) => header.indexOf(name)

const idx = {
  stediId: col('StediId'),
  payerId: col('PrimaryPayerId'),
  name: col('DisplayName'),
  states: col('OperatingStates'),
  prof: col('ProfessionalClaim'),
  profEnr: col('ProfessionalClaimEnrollmentRequired'),
  era: col('ClaimPaymentAdvice'),
  eraEnr: col('ClaimPaymentAdviceEnrollmentRequired'),
  elig: col('EligibilityInquiry'),
  eligEnr: col('EligibilityInquiryEnrollmentRequired'),
  status: col('ClaimStatusInquiry'),
}

const bool = (v: string | undefined) => (v ?? '').trim().toLowerCase() === 'true'
const text = (v: string | undefined) => (v ?? '').trim()

const payers = []
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (!r || r.length < 5) continue
  const payerId = text(r[idx.payerId])
  const name = text(r[idx.name])
  if (!payerId || !name) continue
  payers.push({
    stediId: text(r[idx.stediId]),
    payerId,
    name,
    states: text(r[idx.states]) ? text(r[idx.states]).split('|') : [],
    professionalClaim: bool(r[idx.prof]),
    professionalClaimEnrollmentRequired: bool(r[idx.profEnr]),
    era: bool(r[idx.era]),
    eraEnrollmentRequired: bool(r[idx.eraEnr]),
    eligibility: bool(r[idx.elig]),
    eligibilityEnrollmentRequired: bool(r[idx.eligEnr]),
    claimStatus: bool(r[idx.status]),
  })
}

payers.sort((a, b) => a.name.localeCompare(b.name))

const out = join(process.cwd(), 'lib/rcm/payers/stedi-payers.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(payers))
console.log(`wrote ${payers.length} payers -> ${out}`)

/** Quote-aware CSV parser (handles commas + quotes + CRLF inside the file). */
function parseCsv(s: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); cur = ''; rows.push(row); row = [] }
    else if (c !== '\r') cur += c
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}
