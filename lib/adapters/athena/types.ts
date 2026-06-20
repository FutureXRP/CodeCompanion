/**
 * Raw athenahealth API shapes for billing intake (the proprietary REST API field
 * names — confirm against developer.athenahealth.com). All optional, parsed
 * defensively: the adapter never trusts the payload shape. These types live ONLY
 * inside lib/adapters/athena — nothing above the adapter sees an Athena field
 * (the sacred adapter boundary). Everything normalizes into the canonical model.
 */

export interface AthenaPatientRaw {
  patientid?: string
  firstname?: string
  lastname?: string
  dob?: string // athena: MM/DD/YYYY
  sex?: string // 'M' | 'F'
  address1?: string
  city?: string
  state?: string
  zip?: string
}

export interface AthenaInsuranceRaw {
  insurancepackageid?: string | number // athena's internal payer id (map to an EDI payer id via the payer directory)
  insuranceplanname?: string
  insuranceidnumber?: string // the member id
  insurancetype?: string // 'MB' Medicare, 'MC' Medicaid, 'CI' commercial, …
  sequencenumber?: string | number // '1' = primary
}

export interface AthenaProviderRaw {
  providerid?: string | number
  npi?: string
  firstname?: string
  lastname?: string
  billingname?: string // the billing org name
  federaltaxid?: string
}

export interface AthenaChargeRaw {
  procedurecode?: string // CPT/HCPCS
  modifiers?: string[]
  modifier?: string
  unitcount?: number | string
  amount?: number | string // dollars
  /** Diagnosis pointers for this charge — ICD-10 codes (any of these shapes seen in the wild). */
  icd10code?: string
  diagnosiscodes?: string[]
  diagnoses?: { diagnosiscode?: string }[]
}

export interface AthenaClaimRaw {
  claimid?: string
  encounterid?: string
  patientid?: string
  providerid?: string | number
  servicedate?: string // MM/DD/YYYY
  placeofservice?: string
  claimcategory?: string
  insurancepackageid?: string | number
  charges?: AthenaChargeRaw[]
}

/** What to pull. */
export interface AthenaEncounterQuery {
  serviceDateFrom: string // YYYY-MM-DD
  serviceDateTo?: string
  departmentId?: string
}

/** The intake boundary: a source of joined encounter bundles (real client or mock). */
export interface AthenaSource {
  getEncounterBundles(query: AthenaEncounterQuery): Promise<AthenaEncounterBundle[]>
}

/** A single encounter joined into everything needed to build one canonical claim. */
export interface AthenaEncounterBundle {
  encounterId: string
  /** Athena patient id — used as the claim control number until a real one is assigned. */
  patientControlNumber: string
  dateOfService: string // YYYY-MM-DD (already normalized)
  placeOfService?: string
  claimFilingCode?: string
  patient: AthenaPatientRaw
  insurance: AthenaInsuranceRaw
  provider: AthenaProviderRaw
  charges: AthenaChargeRaw[]
}
