import type { AthenaSource, AthenaEncounterQuery, AthenaEncounterBundle } from './types'

/**
 * Mock athena source — synthetic, athena-shaped bundles (no network, no PHI), so
 * the adapter runs end to end: bundle -> EhrEncounter -> canonical Claim. This is
 * the ATHENA_USE_MOCK=true default and what the unit tests exercise.
 */
export class MockAthenaSource implements AthenaSource {
  async getEncounterBundles(query: AthenaEncounterQuery): Promise<AthenaEncounterBundle[]> {
    return sampleAthenaBundles(query.serviceDateFrom)
  }
}

export function sampleAthenaBundles(date = '2026-01-15'): AthenaEncounterBundle[] {
  const clinic = { providerid: 'PR1', npi: '1234567893', firstname: 'Matthew', lastname: 'Blair', billingname: 'CodeCompanion Clinic', federaltaxid: '742345678' }
  return [
    {
      encounterId: 'enc-1001', patientControlNumber: 'P1001', dateOfService: date, placeOfService: '11', claimFilingCode: 'MB',
      patient: { patientid: 'P1001', firstname: 'JANE', lastname: 'DOE', dob: '01/01/1990', sex: 'F', address1: '123 Main St', city: 'Tulsa', state: 'OK', zip: '74135' },
      insurance: { insurancepackageid: '04312', insuranceplanname: 'Medicare', insuranceidnumber: '1EG4TE5MK72', insurancetype: 'MB', sequencenumber: '1' },
      provider: clinic,
      charges: [
        { procedurecode: '99214', unitcount: 1, amount: 150, diagnoses: [{ diagnosiscode: 'E1165' }, { diagnosiscode: 'I10' }] },
        { procedurecode: '36415', unitcount: 1, amount: 25, icd10code: 'E1165' },
      ],
    },
    {
      encounterId: 'enc-1002', patientControlNumber: 'P1002', dateOfService: date, placeOfService: '11', claimFilingCode: 'CI',
      patient: { patientid: 'P1002', firstname: 'MARIA', lastname: 'CASTELLANO', dob: '07/14/1978', sex: 'F', address1: '88 Elm Ave', city: 'Owasso', state: 'OK', zip: '74055' },
      insurance: { insurancepackageid: '60054', insuranceplanname: 'Aetna', insuranceidnumber: 'AET99120341', insurancetype: 'CI', sequencenumber: '1' },
      provider: clinic,
      charges: [
        { procedurecode: '99213', modifiers: ['25'], unitcount: 1, amount: 120, diagnosiscodes: ['J0290', 'R0789'] },
        { procedurecode: '93000', unitcount: 1, amount: 45, icd10code: 'R0789' },
      ],
    },
    {
      encounterId: 'enc-1003', patientControlNumber: 'P1003', dateOfService: date, placeOfService: '11', claimFilingCode: 'MC',
      patient: { patientid: 'P1003', firstname: 'JAMES', lastname: 'OKAFOR', dob: '03/22/1965', sex: 'M', address1: '5 Birch Ln', city: 'Bixby', state: 'OK', zip: '74008' },
      insurance: { insurancepackageid: 'SKOK0', insuranceplanname: 'SoonerCare', insuranceidnumber: 'OK4471920', insurancetype: 'MC', sequencenumber: '1' },
      provider: clinic,
      charges: [{ procedurecode: '99215', unitcount: 1, amount: 210, icd10code: 'E1142' }],
    },
  ]
}
