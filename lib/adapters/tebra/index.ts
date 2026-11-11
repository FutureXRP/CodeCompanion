import type { Claim, ClaimTracking, FeeScheduleLine, Remittance, ScheduledVisit } from '../../canonical'
import type { EhrEncounter } from '../ehr'
import { MockTebraSource } from './mock'
import { TebraClient, type RequestElementOrder, type SoapTransport } from './client'
import {
  tebraAppointmentToVisit,
  tebraChargesToClaimTracking,
  tebraChargesToEncounters,
  tebraChargesToFeeScheduleLines,
  tebraChargesToRemittances,
} from './to-canonical'
import { encounterToClaim } from '../ehr'
import type { TebraAppointmentQuery, TebraAppointmentRaw, TebraChargeQuery, TebraChargeRaw, TebraPatientRaw, TebraPracticeRaw, TebraSource } from './types'

export * from './types'
export * from './client'
export * from './mock'
export * from './to-canonical'
export * from './contract-export'
export * from './validate'

/**
 * The Tebra (Kareo) adapter — pull charges + their adjudication from Tebra's
 * practice-management API and normalize them into the canonical model. Tebra
 * runs the rails (claims via its clearinghouse, eligibility, ERA posting);
 * CodeCompanion reads what it posted and finds the money. Mock-first, like every
 * adapter: the real client moves real PHI and is gated behind ALLOW_REAL_PHI
 * (COMPLIANCE.md).
 */

export interface TebraConfig {
  /** Default true — synthetic mock. Set false (TEBRA_USE_MOCK=false) for the real client. */
  useMock?: boolean
  allowRealPhi?: boolean
  customerKey?: string
  user?: string
  password?: string
  practiceName?: string
  endpoint?: string
  maxWindowDays?: number
  requestOrder?: RequestElementOrder
  /** Injectable for tests. */
  transport?: SoapTransport
}

export function createTebraSource(config: TebraConfig = {}): TebraSource {
  if (config.useMock !== false) return new MockTebraSource()
  if (!config.allowRealPhi) {
    throw new Error(
      'Tebra live integration pulls real patient data from Tebra — gated by COMPLIANCE.md. ' +
        'Set allowRealPhi=true (ALLOW_REAL_PHI) only after the BAA path is closed. Keep TEBRA_USE_MOCK=true for synthetic testing.',
    )
  }
  if (!config.customerKey || !config.user || !config.password || !config.practiceName) {
    throw new Error('Tebra live integration requires TEBRA_CUSTOMER_KEY, TEBRA_USER, TEBRA_PASSWORD, and TEBRA_PRACTICE_NAME.')
  }
  return new TebraClient({
    customerKey: config.customerKey,
    user: config.user,
    password: config.password,
    practiceName: config.practiceName,
    endpoint: config.endpoint,
    maxWindowDays: config.maxWindowDays,
    requestOrder: config.requestOrder,
    transport: config.transport,
  })
}

export function tebraConfigFromEnv(): TebraConfig {
  const windowDays = Number(process.env.TEBRA_MAX_WINDOW_DAYS)
  const order = process.env.TEBRA_REQUEST_ORDER
  return {
    useMock: process.env.TEBRA_USE_MOCK !== 'false', // must explicitly opt into the real client
    allowRealPhi: process.env.ALLOW_REAL_PHI === 'true',
    customerKey: process.env.TEBRA_CUSTOMER_KEY,
    user: process.env.TEBRA_USER,
    password: process.env.TEBRA_PASSWORD,
    practiceName: process.env.TEBRA_PRACTICE_NAME,
    endpoint: process.env.TEBRA_ENDPOINT || undefined,
    maxWindowDays: Number.isFinite(windowDays) && windowDays > 0 ? windowDays : undefined,
    requestOrder: order === 'alphabetical' || order === 'header-first' ? order : undefined,
  }
}

/** Everything a pull yields, in canonical form. */
export interface TebraCanonicalPull {
  rows: TebraChargeRaw[]
  practice?: TebraPracticeRaw
  encounters: EhrEncounter[]
  claims: Claim[]
  remittances: Remittance[]
  /** Tebra's contract-expected amounts (Settings > Contracts and Fees), one line per payer/code/modifier. */
  feeScheduleLines: FeeScheduleLine[]
  /** Per-line claim tracking: status, balances, who has been billed — the posting workbench's input. */
  tracking: ClaimTracking[]
}

/** Pull a service-date window from Tebra and normalize it: claims + remittances + contract rates. */
export async function pullTebraCanonical(source: TebraSource, query: TebraChargeQuery): Promise<TebraCanonicalPull> {
  const rows = await source.getCharges(query)
  return normalizePull(source, rows)
}

/**
 * Pull the encounters nobody has approved yet (Draft, then Review — two calls,
 * the API has no "either" filter) for the pre-approval review. Nothing here has
 * been sent, so there are no remittances; the claims are what *would* go out.
 */
export async function pullTebraPending(source: TebraSource, query: Omit<TebraChargeQuery, 'includeUnapproved' | 'encounterStatus'>): Promise<TebraCanonicalPull> {
  const rows: TebraChargeRaw[] = []
  const seen = new Set<string>()
  for (const encounterStatus of ['Draft', 'Review'] as const) {
    for (const row of await source.getCharges({ ...query, includeUnapproved: true, encounterStatus })) {
      const key = row.ID || `${row.EncounterID}|${row.ProcedureCode}|${rows.length}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
  }
  return normalizePull(source, rows)
}

export interface TebraSchedulePull {
  appointments: TebraAppointmentRaw[]
  patients: Map<string, TebraPatientRaw | null>
  visits: ScheduledVisit[]
}

/**
 * The schedule for a date range, each visit joined with its patient's
 * coverage and authorizations (one GetPatient per distinct patient, paced).
 * Rows without a patient — blocks, "Other" appointments — are left out.
 */
export async function pullTebraSchedule(source: TebraSource, query: TebraAppointmentQuery): Promise<TebraSchedulePull> {
  const appointments = (await source.getAppointments(query)).filter((a) => a.PatientID?.trim())
  const patients = new Map<string, TebraPatientRaw | null>()
  for (const a of appointments) {
    const id = a.PatientID!.trim()
    if (!patients.has(id)) patients.set(id, await source.getPatient(id).catch(() => null))
  }
  const visits = appointments
    .map((a) => tebraAppointmentToVisit(a, patients.get(a.PatientID!.trim()) ?? null))
    .sort((x, y) => (x.start ?? '').localeCompare(y.start ?? '') || x.id.localeCompare(y.id))
  return { appointments, patients, visits }
}

async function normalizePull(source: TebraSource, rows: TebraChargeRaw[]): Promise<TebraCanonicalPull> {
  // Billing NPI / tax id for the canonical billing provider — best-effort (its own permission).
  const practice = await source.getPractices().then((p) => p[0], () => undefined)
  const encounters = tebraChargesToEncounters(rows, practice)
  return {
    rows,
    practice,
    encounters,
    claims: encounters.map((e) => encounterToClaim(e, 'tebra')),
    remittances: tebraChargesToRemittances(rows),
    feeScheduleLines: tebraChargesToFeeScheduleLines(rows),
    tracking: tebraChargesToClaimTracking(rows),
  }
}
