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
  /** Contract-expected allowed for this charge (Settings > Contracts and Fees > Contract Rates). */
  AllowedAmount?: string
  ExpectedAmount?: string
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

/** What to pull — a service-date window (the API needs both ends when dates are used). */
export interface TebraChargeQuery {
  serviceDateFrom: string // YYYY-MM-DD
  serviceDateTo?: string // default = serviceDateFrom
  /** Also return charges on Draft/Review encounters (IncludeUnapprovedCharges=T). Default false. */
  includeUnapproved?: boolean
}

/** The intake boundary: a source of charge records (real SOAP client or mock). */
export interface TebraSource {
  getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]>
  getPractices(): Promise<TebraPracticeRaw[]>
}
