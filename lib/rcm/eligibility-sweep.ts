import type { Cents } from '../canonical'
import {
  MockEligibilityService,
  type CoverageStatus,
  type EligibilityRequest,
  type EligibilityService,
} from './eligibility'

/**
 * Schedule-driven eligibility sweep — verify tomorrow's whole schedule before the
 * visits, so coverage problems (terminated plans, big unmet deductibles) surface
 * at the front desk instead of as denials weeks later. Runs the same eligibility
 * service as the single check; in production this is a Stedi batch (up to 10k
 * checks per request) run overnight. Deterministic classification — no LLM.
 */

export interface Appointment {
  time: string
  patientName: string
  memberId: string
  payerName: string
  payerExternalId: string
}

export interface SweepItem {
  appointment: Appointment
  status: CoverageStatus
  copayCents?: Cents
  deductibleRemainingCents?: Cents
  /** Front-desk action flags, e.g. inactive coverage, collect-before-visit. */
  flags: string[]
}

export interface SweepReport {
  date: string
  items: SweepItem[]
  counts: { total: number; active: number; issues: number }
  /** Expected copays to collect across the active appointments. */
  estimatedCopayCents: Cents
}

const CLINIC_PROVIDER = { npi: '1234567893', organizationName: 'CodeCompanion Test Clinic' }
const DEDUCTIBLE_FLAG_MIN = 25_000 // flag when ≥ $250 of deductible remains

export async function buildScheduleSweep(
  appointments: Appointment[],
  service: EligibilityService = new MockEligibilityService(),
  date = 'tomorrow',
): Promise<SweepReport> {
  const items: SweepItem[] = []
  let estimatedCopayCents = 0
  let active = 0
  let issues = 0

  for (const appointment of appointments) {
    const request: EligibilityRequest = {
      payer: { externalId: appointment.payerExternalId, name: appointment.payerName },
      subscriber: { memberId: appointment.memberId, firstName: firstOf(appointment.patientName), lastName: lastOf(appointment.patientName) },
      provider: CLINIC_PROVIDER,
      serviceTypeCodes: ['30'],
    }
    const result = await service.check(request)

    const flags: string[] = []
    if (result.status === 'inactive') flags.push('Coverage inactive — verify before the visit')
    if (result.status === 'unknown') flags.push('Coverage unverified — payer returned no answer')
    if (result.deductibleRemainingCents != null && result.deductibleRemainingCents >= DEDUCTIBLE_FLAG_MIN) {
      flags.push('Deductible not met — collect patient portion at check-in')
    }

    if (result.status === 'active') active += 1
    if (result.status !== 'active') issues += 1
    if (result.status === 'active' && result.copayCents) estimatedCopayCents += result.copayCents

    items.push({
      appointment,
      status: result.status,
      copayCents: result.copayCents,
      deductibleRemainingCents: result.deductibleRemainingCents,
      flags,
    })
  }

  return {
    date,
    items,
    counts: { total: appointments.length, active, issues },
    estimatedCopayCents,
  }
}

function firstOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}
function lastOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name
}

/**
 * A deterministic synthetic schedule for the sweep demo. A couple of members
 * carry an "INACTIVE" id so the mock service returns terminated coverage and the
 * sweep flags them — exactly the catch an overnight sweep is for.
 */
export function sampleSchedule(): Appointment[] {
  return [
    { time: '8:00 AM', patientName: 'Maria Castellano', memberId: 'BCBS882211', payerName: 'Blue Cross Blue Shield', payerExternalId: '00840' },
    { time: '8:30 AM', patientName: 'James Okafor', memberId: 'MCR773120', payerName: 'Medicare', payerExternalId: '04312' },
    { time: '9:00 AM', patientName: 'Devon Carter', memberId: 'AET-INACTIVE-04', payerName: 'Aetna', payerExternalId: '60054' },
    { time: '9:30 AM', patientName: 'Priya Nair', memberId: 'UHC551903', payerName: 'UnitedHealthcare', payerExternalId: '87726' },
    { time: '10:00 AM', patientName: 'Harold Kim', memberId: 'MCR773994', payerName: 'Medicare', payerExternalId: '04312' },
    { time: '10:30 AM', patientName: 'Nina Alvarez', memberId: 'SKOK0-22841', payerName: 'Medicaid (SoonerCare)', payerExternalId: 'SKOK0' },
    { time: '11:00 AM', patientName: 'Raymond Childers', memberId: 'BCBS-TERM-INACTIVE', payerName: 'Blue Cross Blue Shield', payerExternalId: '00840' },
    { time: '11:30 AM', patientName: 'Grace Bishop', memberId: 'AET660241', payerName: 'Aetna', payerExternalId: '60054' },
    { time: '1:00 PM', patientName: 'Omar Frye', memberId: 'UHC551240', payerName: 'UnitedHealthcare', payerExternalId: '87726' },
    { time: '1:30 PM', patientName: 'Susan Holt', memberId: 'MCR778820', payerName: 'Medicare', payerExternalId: '04312' },
  ]
}
