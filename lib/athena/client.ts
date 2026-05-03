// Real Athena API client — implement when credentials are ready
// See CLAUDE.md for endpoint reference

import type { AthenaClient } from './types'

const BASE_URL = process.env.ATHENA_BASE_URL ?? 'https://api.preview.platform.athenahealth.com'

async function getAccessToken(practiceId: string): Promise<string> {
  // TODO: fetch from athena_connections, refresh if expired
  throw new Error('TODO: implement getAccessToken')
}

export const realClient: AthenaClient = {
  async getEncounterNote(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/notes')
  },
  async getEncounterDiagnoses(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/diagnoses')
  },
  async getEncounterProcedures(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/procedures')
  },
  async postEncounterDiagnoses(practiceId, encounterId, diagnoses) {
    throw new Error('TODO: POST /v1/{practiceid}/encounters/{encounterid}/diagnoses')
  },
  async postEncounterProcedures(practiceId, encounterId, procedures) {
    throw new Error('TODO: POST /v1/{practiceid}/encounters/{encounterid}/procedures')
  },
  async getAppointments(practiceId, date) {
    throw new Error('TODO: GET /v1/{practiceid}/appointments/booked')
  },
  async getPatient(practiceId, patientId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/{patientid}')
  },
  async getPatientAppointmentHistory(practiceId, patientId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/{patientid}/appointments')
  },
  async getClaims(practiceId, dateFrom, dateTo) {
    throw new Error('TODO: GET /v1/{practiceid}/claims')
  },
  async getCCMPatients(practiceId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/ccm')
  },
}
