/**
 * A pragmatic FHIR R4 subset — only the fields the claim pipeline needs, modeled
 * after US Core. A real EHR (Epic, athenahealth, the Jan-2027 CMS mandate) exposes
 * these same resources; this is the shape our adapter normalizes into the canonical
 * model. Not a full FHIR implementation — just the billing-relevant slice.
 */

export interface FhirCoding {
  system?: string
  code: string
  display?: string
}
export interface FhirReference {
  /** e.g. "Patient/p1". */
  reference: string
}
export interface FhirMoney {
  /** Decimal dollars (FHIR convention); the adapter converts to integer cents. */
  value: number
  currency?: string
}
export interface FhirHumanName {
  family: string
  given: string[]
}
export interface FhirAddress {
  line?: string[]
  city?: string
  state?: string
  postalCode?: string
}
export interface FhirIdentifier {
  /** e.g. "http://hl7.org/fhir/sid/us-npi" or ".../tax". */
  system?: string
  value: string
}

export interface FhirPatient {
  resourceType: 'Patient'
  id: string
  name: FhirHumanName[]
  birthDate?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: FhirAddress[]
}

export interface FhirOrganization {
  resourceType: 'Organization'
  id: string
  name: string
  identifier?: FhirIdentifier[]
  address?: FhirAddress[]
  telecom?: { system: string; value: string }[]
  /** Taxonomy code, when this org is a billing provider. */
  taxonomy?: string
}

export interface FhirPractitioner {
  resourceType: 'Practitioner'
  id: string
  name: FhirHumanName[]
  identifier?: FhirIdentifier[]
}

export interface FhirCoverage {
  resourceType: 'Coverage'
  id: string
  beneficiary: FhirReference
  /** The member id. */
  subscriberId: string
  /** The payer organization(s). */
  payor: FhirReference[]
  /** Filing indicator hint: coding.code carries MB/MC/CI. */
  type?: { coding: FhirCoding[] }
}

export interface FhirEncounter {
  resourceType: 'Encounter'
  id: string
  subject: FhirReference
  period: { start: string }
  /** Place of service: coding.code carries the POS code (e.g. '11'). */
  class?: FhirCoding
  /** Rendering provider(s). */
  participant?: { individual: FhirReference }[]
  /** Billing organization. */
  serviceProvider?: FhirReference
}

export interface FhirCondition {
  resourceType: 'Condition'
  id: string
  subject: FhirReference
  encounter?: FhirReference
  /** ICD-10-CM coding. */
  code: { coding: FhirCoding[] }
}

export interface FhirChargeItem {
  resourceType: 'ChargeItem'
  id: string
  subject: FhirReference
  /** The encounter this charge belongs to. */
  context?: FhirReference
  /** CPT/HCPCS coding. */
  code: { coding: FhirCoding[] }
  quantity?: { value: number }
  priceOverride?: FhirMoney
  /** CPT modifiers. */
  modifier?: FhirCoding[]
  /** Conditions this line addresses (→ diagnosis pointers). */
  supportingInformation?: FhirReference[]
}

export type FhirResource =
  | FhirPatient
  | FhirOrganization
  | FhirPractitioner
  | FhirCoverage
  | FhirEncounter
  | FhirCondition
  | FhirChargeItem

export interface FhirBundleEntry {
  resource: FhirResource
}
export interface FhirBundle {
  resourceType: 'Bundle'
  type: string
  entry: FhirBundleEntry[]
}
