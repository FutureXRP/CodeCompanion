import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { ScheduledVisit } from '../lib/canonical'
import {
  MockTebraSource,
  TebraClient,
  pullTebraSchedule,
  sampleTebraAppointments,
  sampleTebraPatient,
  samplePendingTebraCharges,
  sampleTebraCharges,
  samplePractice,
  tebraAppointmentToVisit,
  tebraPatientCoverage,
  validateTebraShape,
  visitStatus,
  type SoapRequest,
} from '../lib/adapters/tebra'
import { reviewSchedule, reviewVisit, runTebraFrontDesk } from '../lib/capture'

const PRACTICE = 'SquareOne Medical'

function visit(over: Partial<ScheduledVisit>): ScheduledVisit {
  return {
    id: 'V-1', date: '2026-01-15', start: '2026-01-15T08:00:00', patientRef: 'P1', patientName: 'TEST PATIENT', status: 'scheduled',
    payerScenario: 'Commercial', coverage: [], authorizations: [], ...over,
  }
}
const aetna = { payer: { externalId: 'AETNA', name: 'Aetna' }, memberId: 'W1', sequence: 'P' as const }

test('visitStatus + coverage mapping from the PM shapes', () => {
  assert.equal(visitStatus('Check-in'), 'checked_in')
  assert.equal(visitStatus('Checked Out'), 'checked_out')
  assert.equal(visitStatus('No-show'), 'no_show')
  assert.equal(visitStatus('ReminderSent'), 'scheduled')
  assert.equal(visitStatus(undefined), 'unknown')
  const cov = tebraPatientCoverage(sampleTebraPatient('P1101')!)
  assert.deepEqual(cov.map((c) => [c.sequence, c.payer.externalId, c.memberId, c.copayCents, c.deductibleCents]), [
    ['P', 'MEDICARE', '1EG4TE5MK72', undefined, 25700],
    ['S', 'SOONERCARE', 'OK5583920', undefined, undefined],
  ])
  const v = tebraAppointmentToVisit(sampleTebraAppointments('2026-01-15')[1], sampleTebraPatient('P1102'))
  assert.equal(v.id, 'A-7002')
  assert.equal(v.date, '2026-01-15')
  assert.equal(v.patientName, 'REYES, CARLOS')
  assert.equal(v.provider, 'Patel, Anjali')
  assert.equal(v.status, 'scheduled')
  assert.equal(v.coverage[0].copayCents, 2500)
  assert.equal(v.coverage[0].effectiveEnd, '2026-12-31')
})

test('front-desk rules: coverage, authorizations, money to collect', () => {
  assert.deepEqual(reviewVisit(visit({ coverage: [aetna] })).flags, [])
  assert.equal(reviewVisit(visit({ coverage: [aetna] })).ready, true)

  const none = reviewVisit(visit({}))
  assert.deepEqual(none.flags.map((f) => [f.code, f.severity]), [['FD-NO-COVERAGE', 'blocker']])
  assert.deepEqual(reviewVisit(visit({ payerScenario: 'Self Pay' })).flags, [])

  const ended = reviewVisit(visit({ coverage: [{ ...aetna, effectiveEnd: '2025-12-31', copayCents: 3000 }], patientBalanceCents: 4250 }))
  assert.deepEqual(ended.flags.map((f) => f.code), ['FD-COVERAGE-ENDED', 'FD-COPAY', 'FD-BALANCE'])
  assert.equal(ended.collectCents, 7250)
  assert.equal(ended.ready, false)

  const future = reviewVisit(visit({ coverage: [{ ...aetna, effectiveStart: '2026-02-01' }] }))
  assert.deepEqual(future.flags.map((f) => [f.code, f.severity]), [['FD-COVERAGE-NOT-STARTED', 'warning']])
  assert.deepEqual(reviewVisit(visit({ coverage: [{ ...aetna, memberId: '' }] })).flags.map((f) => f.code), ['FD-NO-MEMBER-ID'])

  const wc = { payer: { externalId: 'COMPSOURCE', name: 'CompSource Mutual' }, memberId: 'WC-1', sequence: 'P' as const }
  const expired = reviewVisit(visit({ payerScenario: 'Workers Comp', coverage: [wc], authorizationNumber: 'WC-8812', authorizationEnd: '2025-12-31', authorizations: [{ number: 'WC-8812', visitsAuthorized: 6, visitsUsed: 6, endDate: '2025-12-31' }] }))
  assert.deepEqual(expired.flags.map((f) => [f.code, f.severity]), [['FD-AUTH-EXPIRED', 'blocker'], ['FD-AUTH-EXHAUSTED', 'blocker']])
  const ending = reviewVisit(visit({ payerScenario: 'Workers Comp', coverage: [wc], authorizations: [{ number: 'WC-9', visitsAuthorized: 6, visitsUsed: 2, endDate: '2026-01-25' }] }))
  assert.deepEqual(ending.flags.map((f) => [f.code, f.severity]), [['FD-AUTH-ENDING', 'warning']])
  assert.deepEqual(reviewVisit(visit({ payerScenario: 'Auto Accident', coverage: [wc] })).flags.map((f) => f.code), ['FD-AUTH-MISSING'])
  assert.ok(!reviewVisit(visit({ payerScenario: 'Commercial', coverage: [aetna] })).flags.some((f) => f.code === 'FD-AUTH-MISSING'))

  // Cancelled / rescheduled / no-show visits are not reviewed.
  assert.deepEqual(reviewVisit(visit({ status: 'cancelled' })).flags, [])
})

test('the front desk straight from the Tebra mock: every flag type, deterministic totals', async () => {
  const result = await runTebraFrontDesk(new MockTebraSource(), { from: '2026-01-15', to: '2026-01-15' }, new Date('2026-01-15T07:00:00Z'))
  assert.equal(result.visits.length, 8)
  assert.equal(result.patients.size, 8)
  const { totals, reviews } = result.report
  assert.deepEqual(totals, { visits: 8, expected: 7, blockers: 4, warnings: 0, collectCents: 9750, copaysCents: 5500, balancesCents: 4250, ready: 4 })
  assert.deepEqual(
    reviews.map((r) => [r.visit.id, r.ready, r.collectCents, r.flags.map((f) => f.code)]),
    [
      ['A-7001', true, 0, []],
      ['A-7002', true, 2500, ['FD-COPAY']],
      ['A-7003', true, 0, []],
      ['A-7004', false, 7250, ['FD-COVERAGE-ENDED', 'FD-COPAY', 'FD-BALANCE']],
      ['A-7005', true, 0, []],
      ['A-7006', false, 0, ['FD-AUTH-EXPIRED', 'FD-AUTH-EXHAUSTED']],
      ['A-7007', false, 0, ['FD-NO-COVERAGE']],
      ['A-7008', true, 0, []], // cancelled self-pay — not reviewed
    ],
  )
  // Sorted by start time; a patient the PM can't return still yields a visit.
  assert.ok(reviews.every((r, i) => i === 0 || (reviews[i - 1].visit.start ?? '') <= (r.visit.start ?? '')))
  const base = new MockTebraSource()
  const missing = await pullTebraSchedule(
    {
      getCharges: (q) => base.getCharges(q),
      getPractices: () => base.getPractices(),
      updateEncounterStatus: (e, s) => base.updateEncounterStatus(e, s),
      getAppointments: (q) => base.getAppointments(q),
      getPatient: async () => null,
    },
    { from: '2026-01-15', to: '2026-01-15' },
  )
  assert.equal(missing.visits[0].coverage.length, 0)
  assert.equal(missing.visits.length, 8)
})

test('TebraClient: GetAppointments + GetPatient request shapes, nested policies parsed under candidate tags', async () => {
  const reqs: SoapRequest[] = []
  const patientXml =
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetPatientResponse xmlns="http://www.kareo.com/api/schemas/"><GetPatientResult xmlns:a="http://schemas.datacontract.org/2004/07/Kareo.Api" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">' +
    '<a:ErrorResponse><a:ErrorMessage i:nil="true"/><a:IsError>false</a:IsError></a:ErrorResponse><a:SecurityResponse><a:Authenticated>true</a:Authenticated><a:Authorized>true</a:Authorized></a:SecurityResponse>' +
    '<a:Patient><a:Active>true</a:Active><a:ID>P1102</a:ID><a:FirstName>CARLOS</a:FirstName><a:LastName>REYES</a:LastName><a:PatientBalance>0.00</a:PatientBalance>' +
    '<a:Cases><a:PatientCaseData><a:PatientCaseID>CASE-1102</a:PatientCaseID><a:Name>Commercial</a:Name><a:InsurancePolicies><a:InsurancePolicyData><a:CompanyName>Aetna</a:CompanyName><a:PlanName>Aetna Choice POS II</a:PlanName><a:Number>W223344556</a:Number><a:Copay>25.00</a:Copay><a:EffectiveStartDate>2026-01-01</a:EffectiveStartDate><a:Precedence>1</a:Precedence>' +
    '<a:Authorizations><a:AuthorizationData><a:Number>AUTH-1</a:Number><a:NumberOfVisits>10</a:NumberOfVisits><a:NumberOfVisitsUsed>3</a:NumberOfVisitsUsed><a:EndDate>2026-06-30</a:EndDate></a:AuthorizationData></a:Authorizations></a:InsurancePolicyData></a:InsurancePolicies></a:PatientCaseData></a:Cases></a:Patient>' +
    '</GetPatientResult></GetPatientResponse></s:Body></s:Envelope>'
  const appointmentsXml =
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GetAppointmentsResponse xmlns="http://www.kareo.com/api/schemas/"><GetAppointmentsResult xmlns:a="x"><a:ErrorResponse><a:IsError>false</a:IsError></a:ErrorResponse>' +
    '<a:Appointments><a:AppointmentData><a:ID>A-1</a:ID><a:PatientID>P1102</a:PatientID><a:PatientFullName>REYES, CARLOS</a:PatientFullName><a:StartDate>2026-01-15T08:30:00</a:StartDate><a:ConfirmationStatus>Scheduled</a:ConfirmationStatus></a:AppointmentData></a:Appointments></GetAppointmentsResult></GetAppointmentsResponse></s:Body></s:Envelope>'
  const c = new TebraClient({
    customerKey: 'k', user: 'u', password: 'p', practiceName: PRACTICE, sleep: async () => undefined, now: () => 1,
    transport: async (req) => {
      reqs.push(req)
      return { status: 200, text: /GetPatient>/.test(req.body) ? patientXml : appointmentsXml }
    },
  })
  const appts = await c.getAppointments({ from: '2026-01-15', to: '2026-01-15' })
  assert.equal(appts.length, 1)
  assert.match(reqs[0].headers.SOAPAction, /KareoServices\/GetAppointments"$/)
  assert.match(reqs[0].body, /<sch:Filter><sch:EndDate>2026-01-15T23:59:59<\/sch:EndDate><sch:PracticeName>SquareOne Medical<\/sch:PracticeName><sch:StartDate>2026-01-15T00:00:00<\/sch:StartDate><\/sch:Filter>/)

  const p = await c.getPatient('P1102')
  assert.match(reqs[1].body, /<sch:GetPatient><sch:request><sch:RequestHeader>.*<\/sch:RequestHeader><sch:Filter><sch:PatientID>P1102<\/sch:PatientID><\/sch:Filter><\/sch:request>/)
  assert.equal(p?.fields.ID, 'P1102')
  assert.equal(p?.fields.FirstName, 'CARLOS')
  assert.equal(p?.policies.length, 1)
  assert.equal(p?.policies[0].Number, 'W223344556') // the policy's own Number, not the authorization's
  assert.equal(p?.authorizations[0].Number, 'AUTH-1')
  const v = tebraAppointmentToVisit(appts[0], p)
  assert.equal(v.coverage[0].copayCents, 2500)
  assert.deepEqual(v.authorizations, [{ number: 'AUTH-1', payerName: undefined, visitsAuthorized: 10, visitsUsed: 3, startDate: undefined, endDate: '2026-06-30' }])
  await assert.rejects(c.getAppointments({ from: '2026-02-01', to: '2026-01-01' }), /precedes/)
})

test('validateTebraShape covers the schedule + coverage pull', async () => {
  const schedule = await pullTebraSchedule(new MockTebraSource(), { from: '2026-01-15', to: '2026-01-15' })
  const report = validateTebraShape({ rows: sampleTebraCharges(), practice: samplePractice(), pendingRows: samplePendingTebraCharges(), appointments: schedule.appointments, patients: schedule.patients })
  assert.equal(report.clean, true)
  assert.equal(report.checks.find((c) => c.id === 'appointments')?.status, 'pass')
  assert.equal(report.checks.find((c) => c.id === 'coverage')?.status, 'pass')
  const unreadable = validateTebraShape({ rows: sampleTebraCharges(), appointments: schedule.appointments, patients: new Map([['P1', null]]) })
  assert.equal(unreadable.checks.find((c) => c.id === 'coverage')?.status, 'fail')
})
