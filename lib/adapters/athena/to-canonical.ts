import { dollarsToCents } from '../../canonical'
import type { EhrEncounter, EhrServiceLine } from '../ehr'
import type { AthenaChargeRaw, AthenaEncounterBundle } from './types'

/**
 * Athena → canonical. Maps a joined Athena encounter bundle into the EHR-agnostic
 * EhrEncounter, which lib/adapters/ehr's encounterToClaim turns into a canonical
 * Claim. Pure + unit-tested. Money via dollarsToCents (integer cents). No Athena
 * type escapes upward.
 */

/** athena dates are MM/DD/YYYY; the canonical model wants YYYY-MM-DD. */
export function athenaDate(d: string | undefined): string {
  if (!d) return ''
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim())
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return d.slice(0, 10) // already ISO-ish
}

function gender(sex: string | undefined): 'M' | 'F' | 'U' {
  const s = (sex ?? '').trim().toUpperCase()
  return s === 'M' || s === 'F' ? s : 'U'
}

/** ICD-10 codes a charge points at, across the shapes athena returns. */
function chargeDiagnoses(c: AthenaChargeRaw): string[] {
  if (c.diagnoses && c.diagnoses.length) return c.diagnoses.map((d) => d.diagnosiscode ?? '').filter(Boolean)
  if (c.diagnosiscodes && c.diagnosiscodes.length) return c.diagnosiscodes.filter(Boolean)
  return c.icd10code ? [c.icd10code] : []
}

function modifiers(c: AthenaChargeRaw): string[] {
  if (c.modifiers && c.modifiers.length) return c.modifiers.filter(Boolean)
  return c.modifier ? [c.modifier] : []
}

export function athenaBundleToEhrEncounter(b: AthenaEncounterBundle): EhrEncounter {
  // Build the encounter-level diagnosis list (ordered, de-duped) + a code→pointer map.
  const diagnoses: string[] = []
  const pointerOf = new Map<string, number>()
  for (const charge of b.charges) {
    for (const dx of chargeDiagnoses(charge)) {
      if (!pointerOf.has(dx)) {
        diagnoses.push(dx)
        pointerOf.set(dx, diagnoses.length) // 1-based
      }
    }
  }

  const lines: EhrServiceLine[] = b.charges
    .filter((c) => c.procedurecode)
    .map((c) => ({
      cptHcpcs: c.procedurecode!,
      modifiers: modifiers(c),
      units: Number(c.unitcount) || 1,
      chargeCents: dollarsToCents(c.amount ?? 0),
      diagnosisPointers: chargeDiagnoses(c).map((dx) => pointerOf.get(dx) ?? 1),
    }))

  const p = b.patient
  const prov = b.provider

  return {
    patientControlNumber: b.patientControlNumber,
    payer: {
      // NOTE: athena's insurancepackageid is athena-internal — resolve it to the
      // clearinghouse/EDI payer id via the PayerDirectory at the submission edge.
      externalId: String(b.insurance.insurancepackageid ?? ''),
      name: b.insurance.insuranceplanname ?? '',
    },
    subscriber: {
      memberId: b.insurance.insuranceidnumber ?? '',
      firstName: p.firstname ?? '',
      lastName: p.lastname ?? '',
      dateOfBirth: athenaDate(p.dob) || undefined,
      gender: gender(p.sex),
      ...(p.address1 && p.zip
        ? { address: { line1: p.address1, city: p.city ?? '', state: p.state ?? '', postalCode: p.zip } }
        : {}),
    },
    billingProvider: {
      npi: prov.npi ?? '',
      organizationName: prov.billingname ?? '',
      ...(prov.federaltaxid ? { taxId: prov.federaltaxid } : {}),
    },
    renderingProvider: prov.npi
      ? { npi: prov.npi, firstName: prov.firstname, lastName: prov.lastname }
      : undefined,
    dateOfService: b.dateOfService,
    placeOfServiceCode: b.placeOfService,
    claimFilingCode: b.claimFilingCode ?? b.insurance.insurancetype,
    diagnoses,
    lines,
  }
}
