/**
 * Raw Tebra (Kareo) Web Services API 2.1 shapes — the SOAP field names from the
 * "API Integration Technical Guide" (April 2026). All optional strings, parsed
 * defensively: the adapter never trusts the payload shape. These types live ONLY
 * inside lib/adapters/tebra — nothing above the adapter sees a Tebra field (the
 * sacred adapter boundary). Everything normalizes into the canonical model.
 */

/**
 * One GetCharges record = one service line. Tebra tracks every charge as its own
 * "claim" (the `ID` here is the per-charge claim id in Track Claim Status); the
 * encounter is what groups lines into the canonical Claim. The record is ~150
 * columns wide — the ones the adapter reads are named, the rest stay reachable.
 */
export interface TebraChargeRaw {
  ID?: string
  EncounterID?: string
  PracticeName?: string
  PatientID?: string
  PatientName?: string // "Last, First"
  PatientDateOfBirth?: string // MM/DD/YYYY
  CaseName?: string
  CasePayerScenario?: string // Medicare | Medicaid | Commercial | Workers Comp | …
  ServiceStartDate?: string // YYYY-MM-DD
  ServiceEndDate?: string
  PostingDate?: string
  BatchNumber?: string
  RenderingProviderName?: string
  RenderingProviderID?: string
  ServiceLocationName?: string
  ServiceLocationBillingName?: string
  ServiceLocationNPI?: string
  ServiceLocationPlaceofServiceCode?: string // sic — the guide's spelling
  ProcedureCode?: string
  ProcedureModifier1?: string
  ProcedureModifier2?: string
  ProcedureModifier3?: string
  ProcedureModifier4?: string
  DiagnosisCode1?: string
  DiagnosisCode2?: string
  DiagnosisCode3?: string
  DiagnosisCode4?: string
  Units?: string
  UnitCharge?: string
  TotalCharges?: string
  AdjustedCharges?: string
  Receipts?: string
  PatientBalance?: string
  InsuranceBalance?: string
  TotalBalance?: string
  PrimaryInsuranceBilledCompanyName?: string
  PrimaryInsuranceBilledPlanName?: string
  SecondaryInsuranceBilledCompanyName?: string
  SecondaryInsuranceBilledPlanName?: string
  BilledTo?: string
  /** Completed | Pending | Ready | Error-Rejection | Error – Denial | Error – No Response | Undefined */
  Status?: string
  /**
   * Draft | Review | Approved | Rejected. Not a response column — the client echoes
   * the EncounterStatus filter it queried with, so unapproved charges stay marked.
   */
  EncounterStatus?: string
  /** Contract-expected allowed for this charge (Settings > Contracts and Fees > Contract Rates). */
  AllowedAmount?: string
  ExpectedAmount?: string
  // ── Claim tracking: when each party was billed (the guide spells the first one "FirstBilDate").
  PrimaryInsuranceFirstBillDate?: string
  PrimaryInsuranceFirstBilDate?: string
  PrimaryInsuranceLastBillDate?: string
  SecondaryInsuranceFirstBillDate?: string
  SecondaryInsuranceLastBillDate?: string
  PatientFirstBillDate?: string
  PatientLastBillDate?: string
  // ── Primary payer adjudication, as posted (ERA auto-post or manual).
  PrimaryInsurancePaymentID?: string
  PrimaryInsurancePaymentPostingDate?: string
  PrimaryInsuranceAdjudicationDate?: string
  PrimaryInsurancePaymentRef?: string
  PrimaryInsuranceAllowed?: string
  PrimaryInsuranceContractAdjustment?: string
  PrimaryInsuranceContractAdjustmentReason?: string
  PrimaryInsuranceSecondaryAdjustment?: string
  PrimaryInsuranceSecondaryAdjustmentReason?: string
  PrimaryInsurancePayment?: string
  PrimaryInsuranceDeductible?: string
  PrimaryInsuranceCoinsurance?: string
  PrimaryInsuranceCopay?: string
  // ── Secondary payer adjudication (carried, not yet diffed — see to-canonical).
  SecondaryInsurancePaymentID?: string
  SecondaryInsuranceAdjudicationDate?: string
  SecondaryInsuranceAllowed?: string
  SecondaryInsuranceContractAdjustment?: string
  SecondaryInsuranceContractAdjustmentReason?: string
  SecondaryInsurancePayment?: string
  SecondaryInsuranceDeductible?: string
  SecondaryInsuranceCoinsurance?: string
  SecondaryInsuranceCopay?: string
  PatientPaymentAmount?: string
  [extra: string]: string | undefined
}

/** GetPractices record — billing NPI / tax id for the canonical billing provider. */
export interface TebraPracticeRaw {
  ID?: string
  PracticeName?: string
  TaxID?: string
  NPI?: string
  Active?: string
  [extra: string]: string | undefined
}

/** GetAppointments record (guide §4.2.2) — flat. */
export interface TebraAppointmentRaw {
  ID?: string
  PracticeName?: string
  Type?: string // P = patient, O = other
  ConfirmationStatus?: string // Scheduled | Confirmed | Check-in | No-show | Check-out | Rescheduled | Cancelled
  ServiceLocationName?: string
  PatientID?: string
  PatientFullName?: string
  PatientCaseID?: string
  PatientCaseName?: string
  PatientCasePayerScenario?: string
  AuthorizationID?: string
  AuthorizationNumber?: string
  AuthorizationStartDate?: string
  AuthorizationEndDate?: string
  AuthorizationInsurancePlan?: string
  StartDate?: string
  EndDate?: string
  AllDay?: string
  Recurring?: string
  AppointmentReason1?: string
  ResourceName1?: string
  Notes?: string
  PracticeID?: string
  AppointmentDuration?: string
  [extra: string]: string | undefined
}

/** One insurance policy on a patient case (guide §4.6.2, Cases › InsurancePolicies). */
export interface TebraInsurancePolicyRaw {
  PatientCaseID?: string
  InsurancePolicyID?: string
  CompanyID?: string
  CompanyName?: string
  PlanID?: string
  PlanName?: string
  Number?: string // the policy / member number
  GroupNumber?: string
  Copay?: string
  Deductible?: string
  EffectiveStartDate?: string
  EffectiveEndDate?: string
  PatientRelationshipToInsured?: string
  InsuredIDNumber?: string
  InsuredFullName?: string
  Precedence?: string
  Active?: string
  [extra: string]: string | undefined
}

/** An authorization on a policy (guide §4.6.2, Authorizations). */
export interface TebraAuthorizationRaw {
  AuthorizationNumber?: string
  Number?: string
  AuthorizedNumberOfVisits?: string
  NumberOfVisits?: string
  AuthorizedNumberOfVisitsUsed?: string
  NumberOfVisitsUsed?: string
  InsurancePlanName?: string
  StartDate?: string
  EndDate?: string
  [extra: string]: string | undefined
}

/** GetPatient (guide §4.6): the flat patient fields plus the nested policies and authorizations. */
export interface TebraPatientRaw {
  fields: Record<string, string>
  policies: TebraInsurancePolicyRaw[]
  authorizations: TebraAuthorizationRaw[]
}

export interface TebraAppointmentQuery {
  from: string // YYYY-MM-DD
  to: string
}

export type TebraEncounterStatus = 'Draft' | 'Review' | 'Approved' | 'Rejected'

/**
 * What to pull. At least one date window; the API needs both ends of any
 * window it is given (a missing end defaults to the start):
 *  - service dates  — the visits in a range (backfill by date of service)
 *  - posting dates  — charges entered in a range (Tebra's own default scope is the last 7 posting days)
 *  - modified dates — anything touched in a range: new payments on old claims (the nightly sync)
 * The first pair present (service → posting → modified) is the one sliced into
 * ≤ maxWindowDays calls; the others go along unchanged.
 */
export interface TebraChargeQuery {
  serviceDateFrom?: string // YYYY-MM-DD
  serviceDateTo?: string
  postingDateFrom?: string
  postingDateTo?: string
  modifiedDateFrom?: string
  modifiedDateTo?: string
  /** Also return charges on Draft/Review encounters (IncludeUnapprovedCharges=T). Default false. */
  includeUnapproved?: boolean
  /** Only charges on encounters in this approval state (guide §4.4.1 EncounterStatus). */
  encounterStatus?: TebraEncounterStatus
}

/** The intake boundary: a source of charge records (real SOAP client or mock). */
export interface TebraSource {
  getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]>
  getPractices(): Promise<TebraPracticeRaw[]>
  /**
   * The write path (guide §4.21): move a Draft/Review encounter to Approved or
   * Rejected (back to the provider). Gated above the adapter by TEBRA_ALLOW_WRITES.
   */
  updateEncounterStatus(encounterId: string, status: TebraEncounterStatus): Promise<{ encounterId: string; status: TebraEncounterStatus }>
  /** The schedule (guide §4.2) — what the front desk works from before the patient arrives. */
  getAppointments(query: TebraAppointmentQuery): Promise<TebraAppointmentRaw[]>
  /** One patient with cases, policies and authorizations (guide §4.6). */
  getPatient(patientId: string): Promise<TebraPatientRaw | null>
}
