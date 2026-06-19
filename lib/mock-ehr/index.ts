import type { Claim, Remittance, RemittanceLine } from '../canonical'
import type { RateLookup } from '../diff'
import { encounterToClaim, type EhrEncounter } from '../adapters/ehr'
import { ingestFhirBundle, type FhirBundle, type FhirResource } from '../adapters/fhir'
import { CLINIC, PATIENTS, PAYERS, PROVIDERS, type RosterPatient } from './roster'

/**
 * The mock EHR + mock payer — a self-contained integration-test environment.
 * `mockEhrDay()` renders the synthetic clinic-day as a FHIR bundle (what a real
 * EHR API returns); the FHIR adapter normalizes it to canonical claims. `adjudicate()`
 * plays the payers' side, returning realistic 835s (contractual write-offs, copays/
 * coinsurance, a denial) so the whole pipeline — scrub, submit, ledger, statements,
 * diff, worklist, corpus — runs end to end on synthetic data, no network, no PHI.
 */

/** A realistic recent service date — always in the past, so the clearinghouse
 *  never rejects it for predating its own transaction (clock/timezone safe). */
export function defaultServiceDate(daysAgo = 7): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
export const DEFAULT_DATE = defaultServiceDate()
export const MOCK_EHR_REGION = 'OK'
export const MOCK_EHR_SPECIALTY = 'family_medicine'

const ICD10 = 'http://hl7.org/fhir/sid/icd-10-cm'
const CPT = 'http://www.ama-assn.org/go/cpt'
const NPI = 'http://hl7.org/fhir/sid/us-npi'
const PAYER_ID = 'http://codecompanion.dev/payer-id'
const TAX = 'http://terminology.hl7.org/CodeSystem/v2-0203/tax'

// ZIP by city, so every patient gets a complete (clearinghouse-valid) address.
const CITY_ZIP: Record<string, string> = {
  Tulsa: '74135', 'Broken Arrow': '74012', Owasso: '74055', Jenks: '74037',
  'Sand Springs': '74063', Bixby: '74008', Glenpool: '74033',
}

// ── FHIR bundle (the EHR's native output) ────────────────────────────────────
export function mockEhrDay(date: string = defaultServiceDate()): FhirBundle {
  const resources: FhirResource[] = []

  resources.push({
    resourceType: 'Organization',
    id: 'clinic',
    name: CLINIC.name,
    identifier: [
      { system: NPI, value: CLINIC.npi },
      { system: TAX, value: CLINIC.taxId },
    ],
    taxonomy: CLINIC.taxonomy,
    address: [{ line: [CLINIC.address.line], city: CLINIC.address.city, state: CLINIC.address.state, postalCode: CLINIC.address.postalCode }],
    telecom: [{ system: 'phone', value: CLINIC.phone }],
  })

  for (const [key, payer] of Object.entries(PAYERS)) {
    resources.push({ resourceType: 'Organization', id: `payer-${key}`, name: payer.name, identifier: [{ system: PAYER_ID, value: payer.id }] })
  }
  for (const [key, p] of Object.entries(PROVIDERS)) {
    resources.push({ resourceType: 'Practitioner', id: key, name: [{ family: p.last, given: [p.first] }], identifier: [{ system: NPI, value: p.npi }] })
  }

  PATIENTS.forEach((pt, ptIndex) => {
    resources.push({
      resourceType: 'Patient',
      id: pt.id,
      name: [{ family: pt.last, given: [pt.first] }],
      birthDate: pt.dob,
      gender: pt.gender,
      address: [{ line: [`${(ptIndex + 1) * 100} S Main St`], city: pt.city, state: 'OK', postalCode: CITY_ZIP[pt.city] ?? '74101' }],
    })
    resources.push({
      resourceType: 'Coverage',
      id: `cov-${pt.id}`,
      beneficiary: { reference: `Patient/${pt.id}` },
      subscriberId: pt.memberId,
      payor: [{ reference: `Organization/payer-${pt.payer}` }],
      type: { coding: [{ code: PAYERS[pt.payer].filing }] },
    })
    resources.push({
      resourceType: 'Encounter',
      id: `enc-${pt.id}`,
      subject: { reference: `Patient/${pt.id}` },
      period: { start: `${date}T09:00:00-05:00` },
      class: { code: pt.pos ?? '11' },
      participant: [{ individual: { reference: `Practitioner/${pt.provider}` } }],
      serviceProvider: { reference: 'Organization/clinic' },
    })

    // Visit diagnoses (encounter-linked → billable) + a code→reference map.
    const dxRef = new Map<string, string>()
    pt.visitDx.forEach((code, i) => {
      const id = `cond-${pt.id}-v${i}`
      dxRef.set(code, `Condition/${id}`)
      resources.push({ resourceType: 'Condition', id, subject: { reference: `Patient/${pt.id}` }, encounter: { reference: `Encounter/enc-${pt.id}` }, code: { coding: [{ system: ICD10, code }] } })
    })
    // Problem list (no encounter link → chart context, not billed).
    pt.problems.forEach((code, i) => {
      resources.push({ resourceType: 'Condition', id: `cond-${pt.id}-p${i}`, subject: { reference: `Patient/${pt.id}` }, code: { coding: [{ system: ICD10, code }] } })
    })

    pt.services.forEach((svc, i) => {
      resources.push({
        resourceType: 'ChargeItem',
        id: `chg-${pt.id}-${i}`,
        subject: { reference: `Patient/${pt.id}` },
        context: { reference: `Encounter/enc-${pt.id}` },
        code: { coding: [{ system: CPT, code: svc.cpt }] },
        quantity: { value: svc.units ?? 1 },
        priceOverride: { value: svc.charge, currency: 'USD' },
        modifier: svc.modifiers?.map((m) => ({ code: m })),
        supportingInformation: svc.dx.map((code) => ({ reference: dxRef.get(code) ?? '' })).filter((r) => r.reference),
      })
    })
  })

  return { resourceType: 'Bundle', type: 'collection', entry: resources.map((resource) => ({ resource })) }
}

/** Pull the day from the (mock) EHR as canonical encounters. */
export function pullDay(date: string = defaultServiceDate()): EhrEncounter[] {
  return ingestFhirBundle(mockEhrDay(date))
}

/** Pull the day as canonical, submittable claims. */
export function pullClaims(date: string = defaultServiceDate()): Claim[] {
  return pullDay(date).map((e) => encounterToClaim(e, 'fhir'))
}

/** Look up a roster patient (for chart context like the problem list). */
export function rosterPatient(controlNumber: string): RosterPatient | undefined {
  return PATIENTS.find((p) => p.id === controlNumber)
}

// ── Payer contracts (the practice's fee schedule) ────────────────────────────
const CONTRACTS: Record<string, Record<string, number>> = {
  '00123': { '99213': 95, '99214': 115, '99215': 160, '36415': 14, '93000': 20, G0439: 118, '94760': 5, '81002': 4 },
  '00840': { '99213': 90, '99214': 140, '99215': 210, '36415': 12, '81002': 6, '99396': 180 },
  '60054': { '99213': 88, '99214': 135, '36415': 11, '99396': 175 },
  SKOK0: { '99213': 70, '99214': 95 },
}

export function mockEhrRates(): RateLookup {
  return {
    rate(payerExternalId: string, cptHcpcs: string): number | undefined {
      const dollars = CONTRACTS[payerExternalId]?.[cptHcpcs]
      return dollars === undefined ? undefined : Math.round(dollars * 100)
    },
  }
}

// ── Mock payer adjudication (the 835 side) ───────────────────────────────────
function contractClassFor(filingCode?: string): 'medicare' | 'medicaid' | 'commercial' | 'other' {
  if (filingCode === 'MB') return 'medicare'
  if (filingCode === 'MC') return 'medicaid'
  if (filingCode === 'CI') return 'commercial'
  return 'other'
}

const isEM = (cpt: string): boolean => /^992\d\d$/.test(cpt)
const isPreventive = (cpt: string): boolean => cpt.startsWith('G04') || /^9939\d$/.test(cpt)

/** Patient responsibility for a line (cents) + its CARC. Deterministic. */
function patientShare(cc: string, cpt: string, allowedCents: number): { prCents: number; carc: string } {
  if (cc === 'medicaid' || isPreventive(cpt)) return { prCents: 0, carc: '2' }
  if (cc === 'medicare') return { prCents: Math.round(allowedCents * 0.2), carc: '2' } // 20% coinsurance
  if (isEM(cpt)) return { prCents: 3000, carc: '3' } // commercial office-visit copay
  return { prCents: Math.round(allowedCents * 0.2), carc: '2' } // commercial coinsurance
}

const DENY_CPT = new Set(['99215']) // simulate a prior-auth denial

export function adjudicate(claims: Claim[], rates: RateLookup = mockEhrRates()): Remittance[] {
  return claims.map((claim) => {
    const cc = contractClassFor(claim.claimFilingCode)
    const lines: RemittanceLine[] = claim.lines.map((line) => {
      const allowed = rates.rate(claim.payer.externalId, line.cptHcpcs, line.modifiers[0]) ?? line.billedCents
      if (DENY_CPT.has(line.cptHcpcs)) {
        return { cptHcpcs: line.cptHcpcs, modifiers: line.modifiers, units: line.units, billedCents: line.billedCents, paidCents: 0, allowedCents: 0, patientRespCents: 0, adjustments: [{ groupCode: 'CO', carcCode: '197', amountCents: line.billedCents }] }
      }
      const co = Math.max(0, line.billedCents - allowed)
      const { prCents, carc } = patientShare(cc, line.cptHcpcs, allowed)
      const adjustments = []
      if (co > 0) adjustments.push({ groupCode: 'CO', carcCode: '45', amountCents: co })
      if (prCents > 0) adjustments.push({ groupCode: 'PR', carcCode: carc, amountCents: prCents })
      return { cptHcpcs: line.cptHcpcs, modifiers: line.modifiers, units: line.units, billedCents: line.billedCents, paidCents: allowed - prCents, allowedCents: allowed, patientRespCents: prCents, adjustments }
    })
    return {
      claimControlNumber: claim.controlNumber,
      payerClaimControlNumber: `ICN-${claim.controlNumber}`,
      payer: claim.payer,
      claimStatusCode: lines.some((l) => l.paidCents > 0) ? '1' : '4',
      totalBilledCents: lines.reduce((s, l) => s + l.billedCents, 0),
      totalPaidCents: lines.reduce((s, l) => s + l.paidCents, 0),
      patientRespCents: lines.reduce((s, l) => s + l.patientRespCents, 0),
      lines,
    }
  })
}
