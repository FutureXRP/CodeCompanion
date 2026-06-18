import type {
  Claim,
  ClaimLine,
  BillingProvider,
  RenderingProvider,
  Subscriber,
  SourceAdapter,
} from '../../canonical'

/**
 * EHR ingestion — the universal intake for clinical encounters.
 *
 * EHR-agnostic (the moat): any EHR / practice-management system normalizes its
 * export into an `EhrEncounter`, and `encounterToClaim()` turns it into an
 * enriched canonical Claim ready for the 837 / Stedi builders. Athena, a FHIR R4
 * Encounter+Coverage, or a raw 837 all funnel through this one shape — nothing
 * downstream depends on the source EHR.
 */

export interface EhrServiceLine {
  cptHcpcs: string
  modifiers?: string[]
  units?: number
  chargeCents: number
  /** 1-based pointers into the encounter's `diagnoses`. */
  diagnosisPointers: number[]
}

export interface EhrEncounter {
  patientControlNumber: string
  payer: { externalId: string; name: string }
  subscriber: Subscriber
  billingProvider: BillingProvider
  renderingProvider?: RenderingProvider
  /** YYYY-MM-DD (or YYYYMMDD). */
  dateOfService: string
  placeOfServiceCode?: string
  claimFilingCode?: string
  /** ICD-10 codes in pointer order. */
  diagnoses: string[]
  lines: EhrServiceLine[]
}

/** Map an EHR encounter into an enriched canonical Claim. */
export function encounterToClaim(e: EhrEncounter, source: SourceAdapter = 'fhir'): Claim {
  const lines: ClaimLine[] = e.lines.map((l, i) => ({
    id: `${e.patientControlNumber}:${i + 1}`,
    lineNumber: i + 1,
    cptHcpcs: l.cptHcpcs,
    modifiers: l.modifiers ?? [],
    units: l.units ?? 1,
    diagnosisPointers: l.diagnosisPointers,
    billedCents: l.chargeCents,
  }))

  return {
    controlNumber: e.patientControlNumber,
    payer: e.payer,
    providerNpi: e.renderingProvider?.npi ?? e.billingProvider.npi,
    diagnoses: e.diagnoses,
    dateOfService: e.dateOfService,
    placeOfService: e.placeOfServiceCode ?? '11',
    totalBilledCents: lines.reduce((sum, l) => sum + l.billedCents, 0),
    sourceAdapter: source,
    lines,
    subscriber: e.subscriber,
    billingProvider: e.billingProvider,
    renderingProvider: e.renderingProvider,
    claimFilingCode: e.claimFilingCode,
    claimFrequencyCode: '1',
  }
}

/** A fully-synthetic encounter (no real PHI) for sandbox trials + tests. */
export function sampleEncounter(payerExternalId = 'STEDITEST'): EhrEncounter {
  return {
    patientControlNumber: 'ENC0001',
    payer: { externalId: payerExternalId, name: 'Stedi Test Payer' },
    subscriber: {
      memberId: 'TEST123456789',
      firstName: 'JANE',
      lastName: 'DOE',
      dateOfBirth: '1990-01-01',
      gender: 'F',
      address: { line1: '123 TEST ST', city: 'AUSTIN', state: 'TX', postalCode: '78701' },
    },
    billingProvider: {
      npi: '1234567893',
      organizationName: 'CODECOMPANION TEST CLINIC',
      taxId: '742345678',
      address: { line1: '123 MAIN ST', city: 'AUSTIN', state: 'TX', postalCode: '78701' },
      phone: '5125550100',
    },
    renderingProvider: { npi: '1234567893', firstName: 'MATTHEW', lastName: 'BLAIR' },
    dateOfService: '2026-01-15',
    placeOfServiceCode: '11',
    claimFilingCode: 'MB',
    diagnoses: ['E1165', 'I10'],
    lines: [
      { cptHcpcs: '99214', units: 1, chargeCents: 15000, diagnosisPointers: [1, 2] },
      { cptHcpcs: '36415', units: 1, chargeCents: 2500, diagnosisPointers: [1] },
    ],
  }
}
