import type { TebraChargeQuery, TebraChargeRaw, TebraPracticeRaw, TebraSource } from './types'

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
 */
export class MockTebraSource implements TebraSource {
  async getCharges(query: TebraChargeQuery): Promise<TebraChargeRaw[]> {
    return sampleTebraCharges(query.serviceDateFrom)
  }

  async getPractices(): Promise<TebraPracticeRaw[]> {
    return [samplePractice()]
  }
}

export function samplePractice(): TebraPracticeRaw {
  return { ID: '1', PracticeName: 'SquareOne Medical', TaxID: '74-2345678', NPI: '1234567893', Active: 'True' }
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
  const adjudicated = (paymentId: string, ref: string) => ({
    PrimaryInsurancePaymentID: paymentId,
    PrimaryInsurancePaymentPostingDate: serviceDate,
    PrimaryInsuranceAdjudicationDate: serviceDate,
    PrimaryInsurancePaymentRef: ref,
    PrimaryInsurancePaymentMethodDesc: 'ElectronicFundsTransfer',
    PrimaryInsurancePaymentCategoryDesc: 'ERA',
  })

  return [
    // E-2001 — Medicare, paid exactly to contract (coinsurance is patient-owed, not a shortfall).
    {
      ...base, ...adjudicated('PAY-9001', 'EFT-114455'),
      ID: 'C-5001', EncounterID: 'E-2001', PatientID: 'P1001', PatientName: 'DOE, JANE', PatientDateOfBirth: '01/01/1990',
      CaseName: 'Medicare', CasePayerScenario: 'Medicare',
      PrimaryInsuranceBilledCompanyName: 'Medicare', PrimaryInsuranceBilledPlanName: 'Medicare Part B', BilledTo: 'Medicare',
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
      ProcedureCode: '36415', DiagnosisCode1: 'E11.65', Units: '1', UnitCharge: '25.00', TotalCharges: '25.00',
      Status: 'Completed', ExpectedAmount: '3.00', AllowedAmount: '3.00',
      PrimaryInsuranceAllowed: '3.00', PrimaryInsuranceContractAdjustment: '22.00', PrimaryInsuranceContractAdjustmentReason: 'CO-45',
      PrimaryInsurancePayment: '3.00', PrimaryInsuranceDeductible: '0.00', PrimaryInsuranceCoinsurance: '0.00', PrimaryInsuranceCopay: '0.00',
      Receipts: '3.00', AdjustedCharges: '3.00', InsuranceBalance: '0.00', PatientBalance: '0.00', TotalBalance: '0.00',
    },
    // E-2002 — Aetna, 99213-25 allowed $80 against a $95 contract rate → $15 underpayment.
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
      ...base,
      ID: 'C-5006', EncounterID: 'E-2004', PatientID: 'P1004', PatientName: 'NGUYEN, LINH', PatientDateOfBirth: '11/02/1988',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Blue Cross Blue Shield of Oklahoma', PrimaryInsuranceBilledPlanName: 'BlueChoice PPO', BilledTo: 'Blue Cross Blue Shield of Oklahoma',
      ProcedureCode: '99214', DiagnosisCode1: 'J45.20', DiagnosisCode2: 'R05.9', Units: '1', UnitCharge: '150.00', TotalCharges: '150.00',
      Status: 'Error – No Response', ExpectedAmount: '110.00', AllowedAmount: '110.00',
      Receipts: '0.00', AdjustedCharges: '150.00', InsuranceBalance: '150.00', PatientBalance: '0.00', TotalBalance: '150.00',
    },
    {
      ...base,
      ID: 'C-5007', EncounterID: 'E-2004', PatientID: 'P1004', PatientName: 'NGUYEN, LINH', PatientDateOfBirth: '11/02/1988',
      CaseName: 'Commercial', CasePayerScenario: 'Commercial',
      PrimaryInsuranceBilledCompanyName: 'Blue Cross Blue Shield of Oklahoma', PrimaryInsuranceBilledPlanName: 'BlueChoice PPO', BilledTo: 'Blue Cross Blue Shield of Oklahoma',
      ProcedureCode: '96372', DiagnosisCode1: 'J45.20', Units: '1', UnitCharge: '40.00', TotalCharges: '40.00',
      Status: 'Error-Rejection', ExpectedAmount: '25.00', AllowedAmount: '25.00',
      Receipts: '0.00', AdjustedCharges: '40.00', InsuranceBalance: '40.00', PatientBalance: '0.00', TotalBalance: '40.00',
    },
  ]
}
