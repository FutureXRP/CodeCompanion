// Mock Athena client with realistic primary care synthetic data
import type { AthenaClient, AthenaPatient, AthenaEncounterNote, AthenaAppointment, AthenaClaim } from './types'

const MOCK_PATIENTS: AthenaPatient[] = [
  {
    patientid: 'P001', age: 68, sex: 'M', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
      { icd10code: 'E78.5', description: 'Hyperlipidemia', status: 'active' },
    ],
    lastawvdate: '2023-03-15', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-01-10', Lipids: '2024-01-10' },
  },
  {
    patientid: 'P002', age: 74, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I50.9', description: 'Heart failure, unspecified', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'N18.3', description: 'Chronic kidney disease, stage 3', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
    ],
    lastawvdate: '2024-11-20', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-09-01' },
  },
  {
    patientid: 'P003', age: 55, sex: 'M', primaryinsurancetype: 'Commercial',
    problems: [
      { icd10code: 'J44.1', description: 'COPD with acute exacerbation', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
    ],
    lastlabdates: {},
  },
  {
    patientid: 'P004', age: 71, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'M05.9', description: 'Rheumatoid arthritis', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
    ],
    lastawvdate: '2025-01-10', ccmenrolled: true,
    lastlabdates: { HbA1c: '2024-10-15' },
  },
  {
    patientid: 'P005', age: 45, sex: 'F', primaryinsurancetype: 'Commercial',
    problems: [
      { icd10code: 'F32.1', description: 'Major depressive disorder, moderate', status: 'active' },
      { icd10code: 'F41.1', description: 'Generalized anxiety disorder', status: 'active' },
    ],
    lastlabdates: {},
  },
  {
    patientid: 'P006', age: 62, sex: 'M', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'E78.5', description: 'Hyperlipidemia', status: 'active' },
    ],
    lastawvdate: '2023-08-05', ccmenrolled: false,
    lastlabdates: { Lipids: '2023-08-05' },
  },
  {
    patientid: 'P009', age: 66, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'E11.65', description: 'T2DM with hyperglycemia', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
    ],
    lastawvdate: '2024-12-01', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-06-01' },
  },
]

const MOCK_NOTES: Record<string, AthenaEncounterNote> = {
  'E001': {
    encounterid: 'E001', patientid: 'P001',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Follow-up for diabetes and hypertension.

HISTORY OF PRESENT ILLNESS:
Mr. Johnson is a 68-year-old male with type 2 diabetes, hypertension, and hyperlipidemia presenting for routine follow-up. Home glucose readings 140-180 mg/dL fasting, up from 110-130. Reports new bilateral foot tingling since last visit. BP well controlled on current regimen. Diet less adherent over holidays.

MEDICATIONS: Metformin 1000mg BID, Lisinopril 10mg daily, Atorvastatin 40mg daily, Aspirin 81mg daily.

REVIEW OF SYSTEMS: Bilateral foot tingling. Denies chest pain, polyuria, visual changes.

PHYSICAL EXAM:
Vitals: BP 138/82, HR 74, Wt 198 lbs, BMI 29.4
Cardiovascular: RRR, no murmurs
Extremities: Bilateral decreased monofilament sensation plantar surface. No edema.

ASSESSMENT AND PLAN:
1. Type 2 diabetes with new peripheral neuropathy:
   - HbA1c ordered
   - Starting gabapentin 100mg TID
   - Podiatry referral placed
   - Consider GLP-1 if HbA1c > 8.5%
2. Hypertension: well controlled, continue regimen
3. Hyperlipidemia: lipid panel ordered

Total time: 35 minutes (10 min pre-visit review, 20 min face-to-face, 5 min documentation).`,
  },
  'E002': {
    encounterid: 'E002', patientid: 'P002',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Worsening shortness of breath x 2 weeks.

HISTORY OF PRESENT ILLNESS:
Mrs. Chen is a 74-year-old female with heart failure (EF 35%), hypertension, CKD stage 3, and T2DM presenting with progressive dyspnea on exertion over 2 weeks. Now limited to half block, down from 2 blocks. 4 lb weight gain over 5 days. 2-pillow orthopnea, occasional PND. Salty food at family gathering last week.

MEDICATIONS: Carvedilol 12.5mg BID, Lisinopril 5mg daily, Furosemide 40mg daily, Spironolactone 25mg daily, Metformin 500mg BID, Atorvastatin 40mg.

PHYSICAL EXAM:
Vitals: BP 152/90, HR 88, RR 18, O2 Sat 94% RA, Wt 174 lbs (+4 lbs)
JVD present at 45 degrees. S3 gallop. Bibasilar crackles to mid-lung. 2+ pitting edema to knees.

LABS: BMP last week — Cr 1.6 (baseline), K+ 4.2

ASSESSMENT AND PLAN:
1. Acute decompensated heart failure exacerbation:
   - Increase furosemide 80mg daily x 5 days
   - Daily weights, 2L fluid restriction, 2g sodium
   - BMP in 3 days
   - If no improvement 48-72 hours, admit
2. Hypertension: hold changes until euvolemic
3. CKD: monitor closely with diuresis
4. T2DM: stable

High complexity MDM: multiple chronic conditions with acute exacerbation, data review, decision re: hospitalization. Total time: 45 minutes.`,
  },
  'E003': {
    encounterid: 'E003', patientid: 'P005',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Depression/anxiety medication follow-up.

HISTORY OF PRESENT ILLNESS:
Ms. Williams is a 45-year-old female with MDD and GAD for 3-month medication follow-up. Mood "pretty good." PHQ-9 today 6 (mild), down from 12. Sleeping 7 hours, appetite improved, exercising 3x/week. Denies SI/HI.

MEDICATIONS: Sertraline 100mg daily, Buspirone 10mg BID.

PHYSICAL EXAM:
Vitals: BP 118/72, HR 68
Psychiatric: Affect appropriate, mood euthymic, speech normal.

ASSESSMENT AND PLAN:
1. MDD: improving, PHQ-9 6 from 12. Continue sertraline 100mg.
2. GAD: well controlled. Continue buspirone 10mg BID.
Return 3 months.`,
  },
}

const MOCK_APPOINTMENTS: AthenaAppointment[] = [
  { appointmentid: 'APPT001', patientid: 'P001', appointmentdate: '05/03/2026', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT002', patientid: 'P002', appointmentdate: '05/03/2026', appointmenttime: '10:00', appointmenttype: 'Urgent', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT003', patientid: 'P005', appointmentdate: '05/03/2026', appointmenttime: '11:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT004', patientid: 'P003', appointmentdate: '05/03/2026', appointmenttime: '13:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT005', patientid: 'P006', appointmentdate: '05/03/2026', appointmenttime: '14:00', appointmenttype: 'Annual Physical', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT006', patientid: 'P009', appointmentdate: '05/03/2026', appointmenttime: '15:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
]

const MOCK_HISTORY: Record<string, AthenaAppointment[]> = {
  'P001': [
    { appointmentid: 'H100', patientid: 'P001', appointmentdate: '02/01/2026', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
    { appointmentid: 'H101', patientid: 'P001', appointmentdate: '11/15/2025', appointmenttime: '10:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
  ],
  'P002': [
    { appointmentid: 'H200', patientid: 'P002', appointmentdate: '01/10/2026', appointmenttime: '11:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
    { appointmentid: 'H201', patientid: 'P002', appointmentdate: '10/05/2025', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
  ],
  'P005': [
    { appointmentid: 'H500', patientid: 'P005', appointmentdate: '02/01/2026', appointmenttime: '13:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
    { appointmentid: 'H501', patientid: 'P005', appointmentdate: '11/01/2025', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
  ],
}

const MOCK_CLAIMS: AthenaClaim[] = [
  { claimid: 'C001', encounterid: 'E001', patientid: 'P001', servicedate: '2026-05-03', primarydiagnosiscode: 'E11.9', procedurecode: '99213', billedamount: 92.00, status: 'submitted' },
  { claimid: 'C002', encounterid: 'E002', patientid: 'P002', servicedate: '2026-05-03', primarydiagnosiscode: 'I50.9', procedurecode: '99215', modifier: '25', billedamount: 211.00, status: 'submitted' },
  { claimid: 'C003', encounterid: 'E003', patientid: 'P005', servicedate: '2026-05-03', primarydiagnosiscode: 'F32.1', procedurecode: '99213', billedamount: 92.00, status: 'submitted' },
]

function delay(ms = 80) { return new Promise(r => setTimeout(r, ms)) }

export const mockClient: AthenaClient = {
  async getEncounterNote(practiceId, encounterId) {
    await delay()
    const note = MOCK_NOTES[encounterId]
    if (!note) throw new Error(`Mock: encounter ${encounterId} not found`)
    return note
  },
  async getEncounterDiagnoses(practiceId, encounterId) {
    await delay()
    const note = MOCK_NOTES[encounterId]
    if (!note) return []
    const patient = MOCK_PATIENTS.find(p => p.patientid === note.patientid)
    return (patient?.problems ?? []).map((p, i) => ({ icd10code: p.icd10code, description: p.description, diagnosisorder: i + 1 }))
  },
  async getEncounterProcedures(practiceId, encounterId) {
    await delay()
    const claim = MOCK_CLAIMS.find(c => c.encounterid === encounterId)
    if (!claim) return []
    return [{ cptcode: claim.procedurecode, modifier: claim.modifier, description: `CPT ${claim.procedurecode}`, units: 1 }]
  },
  async postEncounterDiagnoses(practiceId, encounterId, diagnoses) {
    await delay()
    console.log(`[MOCK] Posted ${diagnoses.length} diagnoses to encounter ${encounterId}`)
  },
  async postEncounterProcedures(practiceId, encounterId, procedures) {
    await delay()
    console.log(`[MOCK] Posted ${procedures.length} procedures to encounter ${encounterId}`)
  },
  async getAppointments(practiceId, date) { await delay(); return MOCK_APPOINTMENTS },
  async getPatient(practiceId, patientId) {
    await delay()
    const p = MOCK_PATIENTS.find(p => p.patientid === patientId)
    if (!p) throw new Error(`Mock: patient ${patientId} not found`)
    return p
  },
  async getPatientAppointmentHistory(practiceId, patientId) {
    await delay()
    return MOCK_HISTORY[patientId] ?? []
  },
  async getClaims(practiceId, dateFrom, dateTo) { await delay(); return MOCK_CLAIMS },
  async getCCMPatients(practiceId) {
    await delay()
    return MOCK_PATIENTS.filter(p => p.primaryinsurancetype === 'Medicare' && p.problems.length >= 2 && !p.ccmenrolled)
  },
}

export { MOCK_PATIENTS, MOCK_NOTES, MOCK_APPOINTMENTS, MOCK_CLAIMS }
