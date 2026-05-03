export interface AthenaEncounterNote {
  encounterid: string
  patientid: string
  encounterdate: string
  encountertype: string
  notetext: string
  lockeddate?: string
  providerid: string
}

export interface AthenaEncounterDiagnosis {
  icd10code: string
  description: string
  diagnosisorder: number
}

export interface AthenaEncounterProcedure {
  cptcode: string
  modifier?: string
  description: string
  units: number
}

export interface AthenaAppointment {
  appointmentid: string
  patientid: string
  appointmentdate: string
  appointmenttime: string
  appointmenttype: string
  status: string
  providerid: string
}

export interface AthenaPatientProblem {
  icd10code: string
  description: string
  status: string
  onsetdate?: string
}

export interface AthenaPatient {
  patientid: string
  age: number
  sex: string
  primaryinsurancetype: string
  problems: AthenaPatientProblem[]
  lastawvdate?: string
  ccmenrolled?: boolean
  lastlabdates?: Record<string, string>
}

export interface AthenaClaim {
  claimid: string
  encounterid: string
  patientid: string
  servicedate: string
  primarydiagnosiscode: string
  procedurecode: string
  modifier?: string
  billedamount: number
  allowedamount?: number
  status: string
}

export interface CodeSuggestion {
  emLevel: string
  icd10Codes: Array<{ code: string; description: string; confidence: number }>
  cptCodes: Array<{ code: string; description: string; units: number }>
  modifiers: Array<{ modifier: string; reason: string }>
  confidence: number
  reasoning: string
  mdmLevel?: 'straightforward' | 'low' | 'moderate' | 'high'
  timeMinutes?: number
}

export interface AthenaClient {
  getEncounterNote(practiceId: string, encounterId: string): Promise<AthenaEncounterNote>
  getEncounterDiagnoses(practiceId: string, encounterId: string): Promise<AthenaEncounterDiagnosis[]>
  getEncounterProcedures(practiceId: string, encounterId: string): Promise<AthenaEncounterProcedure[]>
  postEncounterDiagnoses(practiceId: string, encounterId: string, diagnoses: AthenaEncounterDiagnosis[]): Promise<void>
  postEncounterProcedures(practiceId: string, encounterId: string, procedures: AthenaEncounterProcedure[]): Promise<void>
  getAppointments(practiceId: string, date: string): Promise<AthenaAppointment[]>
  getPatient(practiceId: string, patientId: string): Promise<AthenaPatient>
  getPatientAppointmentHistory(practiceId: string, patientId: string): Promise<AthenaAppointment[]>
  getClaims(practiceId: string, dateFrom: string, dateTo: string): Promise<AthenaClaim[]>
  getCCMPatients(practiceId: string): Promise<AthenaPatient[]>
}
