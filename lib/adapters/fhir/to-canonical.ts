import { dollarsToCents } from '../../canonical'
import type { Address } from '../../canonical'
import type { EhrEncounter, EhrServiceLine } from '../ehr'
import type {
  FhirAddress,
  FhirBundle,
  FhirChargeItem,
  FhirCondition,
  FhirCoverage,
  FhirEncounter,
  FhirOrganization,
  FhirPatient,
  FhirPractitioner,
  FhirReference,
  FhirResource,
} from './types'

/**
 * FHIR R4 → canonical EHR ingestion. This is the adapter boundary: it reads FHIR
 * resources (a real EHR's native shape) and emits `EhrEncounter`s, which
 * `encounterToClaim` then turns into canonical claims. Nothing above this file
 * knows FHIR exists. Money crosses the integer-cents chokepoint here.
 */

const NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi'

type ByRef = Map<string, FhirResource>

const refKey = (r: FhirReference | undefined): string | undefined => r?.reference
const idKey = (r: FhirResource & { id: string }): string => `${r.resourceType}/${r.id}`

function index(bundle: FhirBundle): ByRef {
  const map: ByRef = new Map()
  for (const e of bundle.entry) {
    const r = e.resource as FhirResource & { id?: string }
    if (r.id) map.set(idKey(r as FhirResource & { id: string }), r)
  }
  return map
}

function resolve<T extends FhirResource>(map: ByRef, ref: FhirReference | undefined): T | undefined {
  const key = refKey(ref)
  return key ? (map.get(key) as T | undefined) : undefined
}

function npiOf(identifiers?: { system?: string; value: string }[]): string | undefined {
  return identifiers?.find((i) => i.system === NPI_SYSTEM)?.value ?? identifiers?.[0]?.value
}
function taxIdOf(identifiers?: { system?: string; value: string }[]): string | undefined {
  return identifiers?.find((i) => i.system?.includes('tax'))?.value
}

function toAddress(a?: FhirAddress): Address | undefined {
  if (!a || !a.city || !a.state) return undefined
  return { line1: a.line?.[0] ?? '', city: a.city, state: a.state, postalCode: a.postalCode ?? '' }
}

const dotless = (icd: string): string => icd.replace('.', '')
const codeOf = (c: { coding: { code: string }[] }): string => c.coding[0]?.code ?? ''

export function fhirBundleToEncounters(bundle: FhirBundle): EhrEncounter[] {
  const byRef = index(bundle)
  const all = bundle.entry.map((e) => e.resource)
  const encounters = all.filter((r): r is FhirEncounter => r.resourceType === 'Encounter')
  const conditions = all.filter((r): r is FhirCondition => r.resourceType === 'Condition')
  const charges = all.filter((r): r is FhirChargeItem => r.resourceType === 'ChargeItem')
  const coverages = all.filter((r): r is FhirCoverage => r.resourceType === 'Coverage')

  const out: EhrEncounter[] = []

  for (const enc of encounters) {
    const patient = resolve<FhirPatient>(byRef, enc.subject)
    if (!patient) continue
    const patientRef = enc.subject.reference
    const encRef = idKey(enc)

    const coverage = coverages.find((c) => c.beneficiary.reference === patientRef)
    const payerOrg = coverage ? resolve<FhirOrganization>(byRef, coverage.payor[0]) : undefined
    const billingOrg = resolve<FhirOrganization>(byRef, enc.serviceProvider)
    const practitioner = resolve<FhirPractitioner>(byRef, enc.participant?.[0]?.individual)

    // Diagnoses addressed AT this encounter (encounter-linked), in bundle order →
    // 1-based pointers. Unlinked problem-list conditions stay chart context, unbilled.
    const encConditions = conditions.filter((c) => c.encounter?.reference === encRef)
    const diagnoses = encConditions.map((c) => dotless(codeOf(c.code)))
    const dxPointer = new Map<string, number>()
    encConditions.forEach((c, i) => dxPointer.set(idKey(c), i + 1))

    const encCharges = charges.filter((ch) => (ch.context ? ch.context.reference === encRef : ch.subject.reference === patientRef))
    const lines: EhrServiceLine[] = encCharges.map((ch) => {
      const pointers = (ch.supportingInformation ?? [])
        .map((ref) => dxPointer.get(refKey(ref) ?? ''))
        .filter((n): n is number => n !== undefined)
      return {
        cptHcpcs: codeOf(ch.code),
        modifiers: ch.modifier?.map((m) => m.code) ?? [],
        units: ch.quantity?.value ?? 1,
        chargeCents: dollarsToCents(ch.priceOverride?.value ?? 0),
        diagnosisPointers: pointers.length ? pointers : [1],
      }
    })

    const billingNpi = npiOf(billingOrg?.identifier)
    out.push({
      patientControlNumber: patient.id,
      payer: { externalId: payerNpi(payerOrg, coverage), name: payerOrg?.name ?? 'Unknown Payer' },
      subscriber: {
        memberId: coverage?.subscriberId ?? '',
        firstName: patient.name[0]?.given[0] ?? '',
        lastName: patient.name[0]?.family ?? '',
        dateOfBirth: patient.birthDate,
        gender: patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'U',
        address: toAddress(patient.address?.[0]),
      },
      billingProvider: {
        npi: billingNpi ?? '',
        organizationName: billingOrg?.name ?? '',
        taxId: taxIdOf(billingOrg?.identifier),
        taxonomyCode: billingOrg?.taxonomy,
        address: toAddress(billingOrg?.address?.[0]),
        phone: billingOrg?.telecom?.find((t) => t.system === 'phone')?.value,
      },
      renderingProvider: practitioner
        ? { npi: npiOf(practitioner.identifier) ?? '', firstName: practitioner.name[0]?.given[0], lastName: practitioner.name[0]?.family }
        : undefined,
      dateOfService: enc.period.start.slice(0, 10),
      placeOfServiceCode: enc.class?.code ?? '11',
      claimFilingCode: coverage?.type?.coding[0]?.code,
      diagnoses,
      lines,
    })
  }

  return out
}

/** The payer's EDI id lives on the payer Organization's identifier (system .../payer-id). */
function payerNpi(org: FhirOrganization | undefined, coverage: FhirCoverage | undefined): string {
  const fromOrg = org?.identifier?.find((i) => i.system?.includes('payer'))?.value ?? org?.identifier?.[0]?.value
  return fromOrg ?? coverage?.type?.coding[0]?.display ?? ''
}
