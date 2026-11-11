import type { FeeScheduleLine } from '../../canonical'
import type { TebraChargeQuery, TebraChargeRaw, TebraEncounterStatus, TebraPracticeRaw, TebraSource } from './types'

/** In-memory approval state so the write path is visible in the mock (resets with the process). */
const approvalOverrides = new Map<string, TebraEncounterStatus>()
export function resetMockTebraState(): void {
  approvalOverrides.clear()
}

/** The date the synthetic day is pinned to — whichever window the caller used. */
function anchorDate(query: TebraChargeQuery): string {
  return query.serviceDateFrom ?? query.postingDateFrom ?? query.modifiedDateFrom ?? '2026-01-15'
}

/**
 * Mock Tebra source — synthetic GetCharges records in the real API shape (string
 * fields, the guide's column names), no network, no PHI. This is the
 * TEBRA_USE_MOCK=true default and what the unit tests exercise.
 *
 * The clinic day is built so every finding type shows up in the diff:
 *   E-2001 Medicare    paid correctly (99214 + 36415)
 *   E-2002 Aetna       99213-25 underpaid $15.00 against contract; 93000 fine
 *   E-2003 SoonerCare  99215 denied CO-197 (no prior auth) — appealable
 *   E-2004 BCBS OK     99214 no response from payer; 96372 rejected at clearinghouse
 *
 * Plus a set of NOT-YET-APPROVED encounters (Draft / Review) for the pre-approval
 * review — see samplePendingTebraCharges.
 */
export class MockTebraSource implements TebraSource {
  async getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]> {
    const date = anchorDate(query)
    const approved = sampleTebraCharges(date)
    if (!query.includeUnapproved && !query.encounterStatus) return approved
    const pending = samplePendingTebraCharges(date).map((r) => {
      const override = approvalOverrides.get(r.EncounterID ?? '')
      return override ? { ...r, EncounterStatus: override } : r
    })
    if (query.encounterStatus === 'Approved') return [...approved, ...pending.filter((r) => r.EncounterStatus === 'Approved')]
    if (query.encounterStatus) return pending.filter((r) => r.EncounterStatus === query.encounterStatus)
    return [...approved, ...pending]
  }

  async getPractices(): Promise<TebraPracticeRaw[]> {
    return [samplePractice()]
  }

  async updateEncounterStatus(encounterId: string, status: TebraEncounterStatus): Promise<{ encounterId: string; status: TebraEncounterStatus }> {
    const known = samplePendingTebraCharges().some((r) => r.EncounterID === encounterId)
    if (!known) throw new Error(`Tebra UpdateEncounterStatus error: encounter ${encounterId} is not Draft/Review (only those can be updated).`)
    approvalOverrides.set(encounterId, status)
    return { encounterId, status }
  }
}

export function samplePractice(): TebraPracticeRaw {
  return { ID: '1', PracticeName: 'SquareOne Medical', TaxID: '74-2345678', NPI: '1234567893', Active: 'True' }
}

/**
 * Stand-in for Tebra's "Export Contracts and Fees": contracted allowables per
 * payer and code, including codes not on any encounter yet (the add-ons the
 * pre-approval review can suggest). Synthetic numbers.
 */
export function sampleTebraContractRates(): FeeScheduleLine[] {
  const rate = (payerExternalId: string, cptHcpcs: string, dollars: number): FeeScheduleLine => ({ payerExternalId, cptHcpcs, contractedCents: Math.round(dollars * 100) })
  return [
    rate('MEDICARE', '99213', 92), rate('MEDICARE', '99214', 112.5), rate('MEDICARE', 'G0439', 118), rate('MEDICARE', 'G0444', 18),
    rate('MEDICARE', '99497', 86), rate('MEDICARE', 'G2211', 16), rate('MEDICARE', 'G0008', 30), rate('MEDICARE', '36415', 3),
    rate('AETNA', '99213', 95), rate('AETNA', '99214', 115), rate('AETNA', '90471', 25), rate('AETNA', '90686', 18), rate('AETNA', '93000', 20),
    rate('SOONERCARE', '99213', 72), rate('SOONERCARE', '96372', 20),
    rate('BLUECROSSBLUESHIELDOFOKLAHOMA', '99214', 110), rate('BLUECROSSBLUESHIELDOFOKLAHOMA', '36415', 3), rate('BLUECROSSBLUESHIELDOFOKLAHOMA', '80053', 14.5),
  ]
}

/**
 * Encounters the providers have documented but nobody has approved yet — what the
 * pre-approval review works from. Each one leaves something on the table:
 *   P-3001 Medicare  (Review) AWV + 99214 without modifier 25; depression screen / ACP not billed
 *   P-3002 Aetna     (Draft)  flu shot without the administration code; 4-dx 99213 may support 99214
 *   P-3003 SoonerCare(Review) injection + 99213 without modifier 25
 *   P-3004 BCBS OK   (Draft)  clean — ready to approve
 *   P-3005 Medicare  (Draft)  pure E/M for ongoing care without G2211
 *   P-3006 Aetna     (Review) EKG line with no diagnosis (will reject); pulse ox bundled; E/M without 25
 */
export function samplePendingTebraCharges(serviceDate = '2026-01-15'): TebraChargeRaw[] {
  const base = {
    PracticeName: 'SquareOne Medical',
    ServiceStartDate: serviceDate,
    ServiceEndDate: serviceDate,
    PostingDate: serviceDate,
    ServiceLocationName: 'SquareOne Medical',
    ServiceLocationBillingName: 'SquareOne Medical',
    ServiceLocationNPI: '1234567893',
    ServiceLocationPlaceofServiceCode: '11',
    Status: 'Ready',
    PatientBalance: '0.00',
    Receipts: '0.00',
  }
  const line = (
    row: Pick<TebraChargeRaw, 'ID' | 'EncounterID' | 'EncounterStatus' | 'PatientID' | 'PatientName' | 'PatientDateOfBirth' | 'CasePayerScenario' | 'PrimaryInsuranceBilledCompanyName' | 'PrimaryInsuranceBilledPlanName' | 'RenderingProviderName' | 'RenderingProviderID'>,
    cpt: string,
    charge: number,
    expected: number,
    dx: string[],
    modifier?: string,
  ): TebraChargeRaw => ({
    ...base,
    ...row,
    ProcedureCode: cpt,
    ...(modifier ? { ProcedureModifier1: modifier } : {}),
    ...(dx[0] ? { DiagnosisCode1: dx[0] } : {}),
    ...(dx[1] ? { DiagnosisCode2: dx[1] } : {}),
    ...(dx[2] ? { DiagnosisCode3: dx[2] } : {}),
    ...(dx[3] ? { DiagnosisCode4: dx[3] } : {}),
    Units: '1',
    UnitCharge: charge.toFixed(2),
    TotalCharges: charge.toFixed(2),
    AdjustedCharges: charge.toFixed(2),
    InsuranceBalance: charge.toFixed(2),
    TotalBalance: charge.toFixed(2),
    ExpectedAmount: expected.toFixed(2),
    AllowedAmount: expected.toFixed(2),
  })
  const blair = { RenderingProviderName: 'Blair, Matthew', RenderingProviderID: 'PR1' }
  const patel = { RenderingProviderName: 'Patel, Anjali', RenderingProviderID: 'PR2' }
  const p3001 = { EncounterID: 'P-3001', EncounterStatus: 'Review', PatientID: 'P1101', PatientName: 'HARPER, ELLEN', PatientDateOfBirth: '04/09/1954', CasePayerScenario: 'Medicare', PrimaryInsuranceBilledCompanyName: 'Medicare', PrimaryInsuranceBilledPlanName: 'Medicare Part B', ...blair }
  const p3002 = { EncounterID: 'P-3002', EncounterStatus: 'Draft', PatientID: 'P1102', PatientName: 'REYES, CARLOS', PatientDateOfBirth: '08/21/1981', CasePayerScenario: 'Commercial', PrimaryInsuranceBilledCompanyName: 'Aetna', PrimaryInsuranceBilledPlanName: 'Aetna Choice POS II', ...patel }
  const p3003 = { EncounterID: 'P-3003', EncounterStatus: 'Review', PatientID: 'P1103', PatientName: 'TRAN, MINH', PatientDateOfBirth: '12/02/1972', CasePayerScenario: 'Medicaid', PrimaryInsuranceBilledCompanyName: 'SoonerCare', PrimaryInsuranceBilledPlanName: 'SoonerCare Traditional', ...blair }
  const p3004 = { EncounterID: 'P-3004', EncounterStatus: 'Draft', PatientID: 'P1104', PatientName: 'OWENS, GRACE', PatientDateOfBirth: '06/30/1990', CasePayerScenario: 'Commercial', PrimaryInsuranceBilledCompanyName: 'Blue Cross Blue Shield of Oklahoma', PrimaryInsuranceBilledPlanName: 'BlueChoice PPO', ...patel }
  const p3005 = { EncounterID: 'P-3005', EncounterStatus: 'Draft', PatientID: 'P1105', PatientName: 'KOWALSKI, STAN', PatientDateOfBirth: '02/14/1949', CasePayerScenario: 'Medicare', PrimaryInsuranceBilledCompanyName: 'Medicare', PrimaryInsuranceBilledPlanName: 'Medicare Part B', ...blair }
  const p3006 = { EncounterID: 'P-3006', EncounterStatus: 'Review', PatientID: 'P1106', PatientName: 'DIALLO, AMARA', PatientDateOfBirth: '09/17/1987', CasePayerScenario: 'Commercial', PrimaryInsuranceBilledCompanyName: 'Aetna', PrimaryInsuranceBilledPlanName: 'Aetna Choice POS II', ...patel }

  return [
    line({ ID: 'C-6001', ...p3001 }, 'G0439', 180, 118, ['Z00.00']),
    line({ ID: 'C-6002', ...p3001 }, '99214', 150, 112.5, ['I10', 'E11.65']),
    line({ ID: 'C-6003', ...p3002 }, '99213', 120, 95, ['J02.90', 'R07.89', 'E78.5', 'I10']),
    line({ ID: 'C-6004', ...p3002 }, '90686', 24, 18, ['Z23']),
    line({ ID: 'C-6005', ...p3003 }, '99213', 120, 72, ['E11.65', 'I10']),
    line({ ID: 'C-6006', ...p3003 }, '96372', 40, 20, ['E11.65']),
    line({ ID: 'C-6007', ...p3004 }, '99214', 150, 110, ['K21.9', 'E78.5']),
    line({ ID: 'C-6008', ...p3004 }, '36415', 25, 3, ['E78.5']),
    line({ ID: 'C-6009', ...p3004 }, '80053', 45, 14.5, ['E78.5']),
    line({ ID: 'C-6010', ...p3005 }, '99213', 120, 92, ['E11.65', 'I10', 'N18.30']),
    line({ ID: 'C-6011', ...p3006 }, '99214', 150, 115, ['J45.20']),
    line({ ID: 'C-6012', ...p3006 }, '94760', 15, 5, ['J45.20']),
    line({ ID: 'C-6013', ...p3006 }, '93000', 45, 20, []), // no diagnosis on the line — a clearinghouse rejects it
  ]
}

export function sampleTebraCharges(serviceDate = '2026-01-15'): TebraChargeRaw[] {
  const base = {
    PracticeName: 'SquareOne Medical',
    ServiceStartDate: serviceDate,
    ServiceEndDate: serviceDate,
    PostingDate: serviceDate,
    BatchNumber: '2026-0115',
    RenderingProviderName: 'Blair, Matthew',
    RenderingProviderID: 'PR1',
    ServiceLocationName: 'SquareOne Medical',
    ServiceLocationBillingName: 'SquareOne Medical',
    ServiceLocationNPI: '1234567893',
    ServiceLocationPlaceofServiceCode: '11',
  }
  // Every line went out to the primary payer on the service date.
  const billed = { PrimaryInsuranceFirstBillDate: serviceDate, PrimaryInsuranceLastBillDate: serviceDate }
  const adjudicated = (paymentId: string, ref: string) => ({
    ...billed,
    PrimaryInsurancePaymentID: paymentId,
    PrimaryInsurancePaymentPostingDate: serviceDate,
    PrimaryInsuranceAdjudicationDate: serviceDate,
    PrimaryInsurancePaymentRef: ref,
    PrimaryInsurancePaymentMethodDesc: 'ElectronicFundsTransfer',
    PrimaryInsurancePaymentCategoryDesc: 'ERA',
  })

  return [
    // E-2001 — Medicare, paid exactly to contract (coinsurance is patient-owed, not a shortfall).
    // SoonerCare is on file as secondary and has never been billed — the crossover was missed.
    {
      ...base, ...adjudicated('PAY-9001', 'EFT-114455'),
      ID: 'C-5001', EncounterID: 'E-2001', PatientID: 'P1001', PatientName: 'DOE, JANE', PatientDateOfBirth: '01/01/1990',
      CaseName: 'Medicare', CasePayerScenario: 'Medicare',
      PrimaryInsuranceBilledCompanyName: 'Medicare', PrimaryInsuranceBilledPlanName: 'Medicare Part B', BilledTo: 'Medicare',
      SecondaryInsuranceBilledCompanyName: 'SoonerCare', SecondaryInsuranceBilledPlanName: 'SoonerCare Traditional',
      ProcedureCode: '99214', DiagnosisCode1: 'E11.65', DiagnosisCode2: 'I10', Units: '1', UnitCharge: '150.00', TotalCharges: '150.00',
      Status: 'Completed', ExpectedAmount: '112.50', AllowedAmount: '112.50',
      PrimaryInsuranceAllowed: '112.50', PrimaryInsuranceContractAdjustment: '37.50', PrimaryInsuranceContractAdjustmentReason: 'CO-45',
      PrimaryInsurancePayment: '90.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '22.50', PrimaryInsuranceCopay: '0.00',
      Receipts: '90.00', AdjustedCharges: '112.50', InsuranceBalance: '0.00', PatientBalance: '22.50', TotalBalance: '22.50',
    },
    {
      ...base, ...adjudicated('PAY-9001', 'EFT-114455'),
      ID: 'C-5002', EncounterID: 'E-2001', PatientID: 'P1001', PatientName: 'DOE, JANE', PatientDateOfBirth: '01/01/1990',
      CaseName: 'Medicare', CasePayerScenario: 'Medicare',
      PrimaryInsuranceBilledCompanyName: 'Medicare', PrimaryInsuranceBilledPlanName: 'Medicare Part B', BilledTo: 'Medicare',
      SecondaryInsuranceBilledCompanyName: 'SoonerCare', SecondaryInsuranceBilledPlanName: 'SoonerCare Traditional',
      ProcedureCode: '36415', DiagnosisCode1: 'E11.65', Units: '1', UnitCharge: '25.00', TotalCharges: '25.00',
      Status: 'Completed', ExpectedAmount: '3.00', AllowedAmount: '3.00',
      PrimaryInsuranceAllowed: '3.00', PrimaryInsuranceContractAdjustment: '22.00', PrimaryInsuranceContractAdjustmentReason: 'CO-45',
      PrimaryInsurancePayment: '3.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '0.00', PrimaryInsuranceCopay: '0.00',
      Receipts: '3.00', AdjustedCharges: '3.00', InsuranceBalance: '0.00', PatientBalance: '0.00', TotalBalance: '0.00',
    },
    // E-2002 — Aetna, 99213-25 allowed $80 against a $95 contract rate → $15 underpayment.
    // The $16 coinsurance has never been put on a statement.
    {
      ...base, ...adjudicated('PAY-9002', 'EFT-220901'),
      ID: 'C-5003', EncounterID: 'E-2002', PatientID: 'P1002', PatientName: 'CASTELLANO, MARIA', PatientDateOfBirth: '07/14/1978',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Aetna', PrimaryInsuranceBilledPlanName: 'Aetna Choice POS II', BilledTo: 'Aetna',
      ProcedureCode: '99213', ProcedureModifier1: '25', DiagnosisCode1: 'J02.90', DiagnosisCode2: 'R07.89', Units: '1', UnitCharge: '120.00', TotalCharges: '120.00',
      Status: 'Completed', ExpectedAmount: '95.00', AllowedAmount: '95.00',
      PrimaryInsuranceAllowed: '80.00', PrimaryInsuranceContractAdjustment: '40.00', PrimaryInsuranceContractAdjustmentReason: 'CO-45',
      PrimaryInsurancePayment: '64.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '16.00', PrimaryInsuranceCopay: '0.00',
      Receipts: '64.00', AdjustedCharges: '80.00', InsuranceBalance: '0.00', PatientBalance: '16.00', TotalBalance: '16.00',
    },
    {
      ...base, ...adjudicated('PAY-9002', 'EFT-220901'),
      ID: 'C-5004', EncounterID: 'E-2002', PatientID: 'P1002', PatientName: 'CASTELLANO, MARIA', PatientDateOfBirth: '07/14/1978',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Aetna', PrimaryInsuranceBilledPlanName: 'Aetna Choice POS II', BilledTo: 'Aetna',
      ProcedureCode: '93000', DiagnosisCode1: 'R07.89', Units: '1', UnitCharge: '45.00', TotalCharges: '45.00',
      Status: 'Completed', ExpectedAmount: '20.00', AllowedAmount: '20.00',
      PrimaryInsuranceAllowed: '20.00', PrimaryInsuranceContractAdjustment: '25.00', PrimaryInsuranceContractAdjustmentReason: 'CO-45',
      PrimaryInsurancePayment: '20.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '0.00', PrimaryInsuranceCopay: '0.00',
      Receipts: '20.00', AdjustedCharges: '20.00', InsuranceBalance: '0.00', PatientBalance: '0.00', TotalBalance: '0.00',
    },
    // E-2003 — SoonerCare, denied for missing prior authorization (CO-197): appealable.
    {
      ...base, ...adjudicated('PAY-9003', 'EFT-330117'),
      ID: 'C-5005', EncounterID: 'E-2003', PatientID: 'P1003', PatientName: 'OKAFOR, JAMES', PatientDateOfBirth: '03/22/1965',
      CaseName: 'Medicaid', CasePayerScenario: 'Medicaid',
      PrimaryInsuranceBilledCompanyName: 'SoonerCare', PrimaryInsuranceBilledPlanName: 'SoonerCare Traditional', BilledTo: 'SoonerCare',
      ProcedureCode: '99215', DiagnosisCode1: 'E11.42', DiagnosisCode2: 'N18.30', Units: '1', UnitCharge: '210.00', TotalCharges: '210.00',
      Status: 'Error – Denial', ExpectedAmount: '128.00', AllowedAmount: '128.00',
      PrimaryInsuranceAllowed: '0.00', PrimaryInsuranceContractAdjustment: '210.00', PrimaryInsuranceContractAdjustmentReason: 'CO-197',
      PrimaryInsurancePayment: '0.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '0.00', PrimaryInsuranceCopay: '0.00',
      Receipts: '0.00', AdjustedCharges: '0.00', InsuranceBalance: '0.00', PatientBalance: '0.00', TotalBalance: '0.00',
    },
    // E-2004 — BCBS of Oklahoma: one line never answered, one rejected at the clearinghouse. No adjudication at all.
    {
      ...base, ...billed,
      ID: 'C-5006', EncounterID: 'E-2004', PatientID: 'P1004', PatientName: 'NGUYEN, LINH', PatientDateOfBirth: '11/02/1988',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Blue Cross Blue Shield of Oklahoma', PrimaryInsuranceBilledPlanName: 'BlueChoice PPO', BilledTo: 'Blue Cross Blue Shield of Oklahoma',
      ProcedureCode: '99214', DiagnosisCode1: 'J45.20', DiagnosisCode2: 'R05.9', Units: '1', UnitCharge: '150.00', TotalCharges: '150.00',
      Status: 'Error – No Response', ExpectedAmount: '110.00', AllowedAmount: '110.00',
      Receipts: '0.00', AdjustedCharges: '150.00', InsuranceBalance: '150.00', PatientBalance: '0.00', TotalBalance: '150.00',
    },
    {
      ...base, ...billed,
      ID: 'C-5007', EncounterID: 'E-2004', PatientID: 'P1004', PatientName: 'NGUYEN, LINH', PatientDateOfBirth: '11/02/1988',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Blue Cross Blue Shield of Oklahoma', PrimaryInsuranceBilledPlanName: 'BlueChoice PPO', BilledTo: 'Blue Cross Blue Shield of Oklahoma',
      ProcedureCode: '96372', DiagnosisCode1: 'J45.20', Units: '1', UnitCharge: '40.00', TotalCharges: '40.00',
      Status: 'Error-Rejection', ExpectedAmount: '25.00', AllowedAmount: '25.00',
      Receipts: '0.00', AdjustedCharges: '40.00', InsuranceBalance: '40.00', PatientBalance: '0.00', TotalBalance: '40.00',
    },
  ]
}
