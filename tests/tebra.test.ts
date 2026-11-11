import { test } from 'node:test'
import assert from 'node:assert/strict'

import { escapeXml, decodeXml, extractRecords, extractFirst, extractStringList } from '../lib/adapters/tebra/xml'
import {
  TebraClient,
  MockTebraSource,
  createTebraSource,
  pullTebraCanonical,
  sampleTebraCharges,
  xmlFields,
  soapEnvelope,
  dateWindows,
  tebraDate,
  tebraCents,
  parseAdjustmentReason,
  normalizeStatus,
  payerKey,
  splitPatientName,
  claimFilingCode,
  tebraChargesToEncounters,
  tebraChargesToRemittances,
  tebraChargesToFeeScheduleLines,
  tebraChargesToClaimTracking,
  type SoapRequest,
  type TebraClientConfig,
} from '../lib/adapters/tebra'
import { encounterToClaim } from '../lib/adapters/ehr'
import { runTebraFoundMoney } from '../lib/found-money/tebra'

const PRACTICE = 'SquareOne Medical'

/** A WCF-shaped Get*Response like the live service returns (prefixes, nil, string lists). */
function soapResponse(
  records: Record<string, string | undefined>[],
  opts: { tag?: string; op?: string; error?: string; authenticated?: boolean; authorized?: boolean; missing?: string[] } = {},
): string {
  const tag = opts.tag ?? 'ChargeData'
  const op = opts.op ?? 'GetCharges'
  const list = tag === 'ChargeData' ? 'Charges' : 'Practices'
  const recs = records
    .map((r) => `<a:${tag}>${Object.entries(r).filter(([, v]) => v !== undefined).map(([k, v]) => `<a:${k}>${escapeXml(v!)}</a:${k}>`).join('')}</a:${tag}>`)
    .join('')
  const missing = (opts.missing ?? []).map((m) => `<b:string>${m}</b:string>`).join('')
  return (
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><${op}Response xmlns="http://www.kareo.com/api/schemas/">` +
    `<${op}Result xmlns:a="http://schemas.datacontract.org/2004/07/Kareo.Api" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">` +
    `<a:ErrorResponse>${opts.error ? `<a:ErrorMessage>${escapeXml(opts.error)}</a:ErrorMessage><a:IsError>true</a:IsError>` : '<a:ErrorMessage i:nil="true"/><a:IsError>false</a:IsError>'}<a:StackTrace i:nil="true"/></a:ErrorResponse>` +
    `<a:SecurityResponse><a:Authenticated>${opts.authenticated ?? true}</a:Authenticated><a:Authorized>${opts.authorized ?? true}</a:Authorized><a:CustomerId>1</a:CustomerId>` +
    `<a:PermissionsMissing xmlns:b="http://schemas.microsoft.com/2003/10/Serialization/Arrays">${missing}</a:PermissionsMissing>` +
    `<a:PracticesAuthorized xmlns:b="http://schemas.microsoft.com/2003/10/Serialization/Arrays"><b:string>${PRACTICE}</b:string></a:PracticesAuthorized>` +
    `<a:SecurityResult>Security check completed</a:SecurityResult><a:SecurityResultSuccess>false</a:SecurityResultSuccess></a:SecurityResponse>` +
    `<a:${list}>${recs}</a:${list}></${op}Result></${op}Response></s:Body></s:Envelope>`
  )
}

function client(transport: (req: SoapRequest) => Promise<{ status: number; text: string }>, extra: Partial<TebraClientConfig> = {}) {
  const slept: number[] = []
  const c = new TebraClient({
    customerKey: 'key-123',
    user: 'api@squareone.example',
    password: 'p&ss<word>',
    practiceName: PRACTICE,
    transport,
    sleep: async (ms) => { slept.push(ms) },
    now: () => 1_000_000,
    ...extra,
  })
  return { c, slept }
}

test('xml: flat records with prefixes, nil elements, entities and tag boundaries', () => {
  const xml =
    '<s:Envelope><s:Body><a:Charges xmlns:a="x" xmlns:i="y">' +
    '<a:ChargeData><a:ID>C-1</a:ID><a:PatientName>DOE, JANE &amp; CO</a:PatientName><a:Status i:nil="true"/><a:TotalCharges>150.00</a:TotalCharges></a:ChargeData>' +
    '<a:ChargeData><a:ID>C-2</a:ID></a:ChargeData></a:Charges></s:Body></s:Envelope>'
  const recs = extractRecords(xml, 'ChargeData')
  assert.equal(recs.length, 2)
  assert.equal(recs[0].ID, 'C-1')
  assert.equal(recs[0].PatientName, 'DOE, JANE & CO')
  assert.equal(recs[0].Status, '')
  assert.equal(recs[0].TotalCharges, '150.00')
  assert.equal(recs[1].ID, 'C-2')
  assert.equal(extractRecords(xml, 'Charge').length, 0) // "Charge" must not match "ChargeData"
  assert.equal(extractFirst(xml, 'Nope'), null)
  assert.deepEqual(extractStringList(soapResponse([], { missing: ['Charges', 'Encounters'] }), 'PermissionsMissing'), ['Charges', 'Encounters'])
  assert.equal(escapeXml(`p&<>"'`), 'p&amp;&lt;&gt;&quot;&apos;')
  assert.equal(decodeXml('&amp;lt; &#65;&#x42;'), '&lt; AB')
})

test('xmlFields: WCF (alphabetical) order, escaped text, blanks omitted', () => {
  assert.equal(
    xmlFields({ User: 'u@x.com', CustomerKey: 'k', Password: 'p&<1>', Blank: '', Missing: undefined }),
    '<sch:CustomerKey>k</sch:CustomerKey><sch:Password>p&amp;&lt;1&gt;</sch:Password><sch:User>u@x.com</sch:User>',
  )
  assert.match(soapEnvelope('GetCharges', '<x/>'), /<sch:GetCharges><sch:request><x\/><\/sch:request><\/sch:GetCharges>/)
})

test('dateWindows: slices a range into ≤ N-day inclusive windows', () => {
  assert.deepEqual(dateWindows('2026-01-01', '2026-03-15', 60), [['2026-01-01', '2026-03-01'], ['2026-03-02', '2026-03-15']])
  assert.deepEqual(dateWindows('2026-01-15', '2026-01-15', 60), [['2026-01-15', '2026-01-15']])
  assert.throws(() => dateWindows('01/15/2026', '2026-01-15', 60), /YYYY-MM-DD/)
})

test('TebraClient.getCharges: header + filter in WCF order, SOAPAction, records parsed', async () => {
  const reqs: SoapRequest[] = []
  const { c } = client(async (req) => {
    reqs.push(req)
    return { status: 200, text: soapResponse(sampleTebraCharges('2026-01-15').slice(0, 2)) }
  })
  const rows = await c.getCharges({ serviceDateFrom: '2026-01-15' })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].ID, 'C-5001')
  assert.equal(rows[0].PatientName, 'DOE, JANE')
  assert.equal(rows[1].ProcedureCode, '36415')

  assert.equal(reqs.length, 1)
  const req = reqs[0]
  assert.equal(req.url, 'https://webservice.kareo.com/services/soap/2.1/KareoServices.svc')
  assert.equal(req.headers.SOAPAction, '"http://www.kareo.com/api/schemas/KareoServices/GetCharges"')
  assert.match(req.headers['Content-Type'], /text\/xml/)
  assert.match(
    req.body,
    /<sch:GetCharges><sch:request><sch:RequestHeader><sch:CustomerKey>key-123<\/sch:CustomerKey><sch:Password>p&amp;ss&lt;word&gt;<\/sch:Password><sch:User>api@squareone.example<\/sch:User><\/sch:RequestHeader><sch:Filter>/,
  )
  assert.match(
    req.body,
    /<sch:Filter><sch:FromServiceDate>2026-01-15<\/sch:FromServiceDate><sch:PracticeName>SquareOne Medical<\/sch:PracticeName><sch:ToServiceDate>2026-01-15<\/sch:ToServiceDate><\/sch:Filter>/,
  )
  assert.ok(!req.body.includes('<sch:Fields>')) // omitted → full records
})

test('TebraClient: backs off on 429 throttling and paces consecutive calls (guide §3.3)', async () => {
  let calls = 0
  const { c, slept } = client(async () => {
    calls++
    if (calls === 1) {
      return { status: 200, text: soapResponse([], { error: '429: GetCharges endpoint requested more than allowed over time interval 1000 milliseconds. Please wait to try again.' }) }
    }
    return { status: 200, text: soapResponse([{ ID: 'C-1', EncounterID: 'E-1', ProcedureCode: '99213' }]) }
  })
  const first = await c.getCharges({ serviceDateFrom: '2026-01-15' })
  assert.equal(first.length, 1)
  assert.equal(calls, 2)
  assert.deepEqual(slept, [1000, 1000]) // backoff after the 429, then the 1 call/s pace before the retry
  await c.getCharges({ serviceDateFrom: '2026-01-16' })
  assert.deepEqual(slept, [1000, 1000, 1000]) // paced again

  let http = 0
  const { c: flaky } = client(async () => {
    http++
    return http === 1 ? { status: 503, text: '' } : { status: 200, text: soapResponse([{ ID: 'C-9', EncounterID: 'E-9', ProcedureCode: '99213' }]) }
  })
  assert.equal((await flaky.getCharges({ serviceDateFrom: '2026-01-15' })).length, 1)
  assert.equal(http, 2)
})

test('TebraClient: faults, API errors and security failures are readable errors', async () => {
  const { c: unauth } = client(async () => ({ status: 200, text: soapResponse([], { authenticated: false }) }))
  await assert.rejects(unauth.getCharges({ serviceDateFrom: '2026-01-15' }), /not authenticated/)

  const { c: noperm } = client(async () => ({ status: 200, text: soapResponse([], { authorized: false, missing: ['Charges', 'Encounters'] }) }))
  await assert.rejects(noperm.getCharges({ serviceDateFrom: '2026-01-15' }), /missing permissions: Charges, Encounters/)

  const { c: fault } = client(async () => ({
    status: 500,
    text: '<s:Envelope><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>Bad request shape</faultstring></s:Fault></s:Body></s:Envelope>',
  }))
  await assert.rejects(fault.getCharges({ serviceDateFrom: '2026-01-15' }), /SOAP fault: Bad request shape/)

  const { c: apiErr } = client(async () => ({ status: 200, text: soapResponse([], { error: 'At least one filter is required.' }) }))
  await assert.rejects(apiErr.getCharges({ serviceDateFrom: '2026-01-15' }), /At least one filter is required/)

  const { c: dates } = client(async () => ({ status: 200, text: soapResponse([]) }))
  await assert.rejects(dates.getCharges({ serviceDateFrom: '2026-02-01', serviceDateTo: '2026-01-01' }), /must not precede/)
})

test('TebraClient: wide ranges are sliced into ≤ maxWindowDays calls and de-duplicated by charge ID', async () => {
  const windows: string[] = []
  const { c } = client(async (req) => {
    const m = /<sch:FromServiceDate>([^<]+)<\/sch:FromServiceDate>.*<sch:ToServiceDate>([^<]+)<\/sch:ToServiceDate>/.exec(req.body)!
    windows.push(`${m[1]}..${m[2]}`)
    return { status: 200, text: soapResponse([{ ID: 'C-1', EncounterID: 'E-1', ProcedureCode: '99213' }]) }
  }, { maxWindowDays: 60 })
  const rows = await c.getCharges({ serviceDateFrom: '2026-01-01', serviceDateTo: '2026-03-15' })
  assert.deepEqual(windows, ['2026-01-01..2026-03-01', '2026-03-02..2026-03-15'])
  assert.equal(rows.length, 1) // same charge in both windows → once
})

test('TebraClient.getPractices + the alphabetical request-order fallback', async () => {
  const reqs: SoapRequest[] = []
  const { c } = client(
    async (req) => {
      reqs.push(req)
      return { status: 200, text: soapResponse([{ ID: '1', PracticeName: PRACTICE, NPI: '1234567893', TaxID: '74-2345678' }], { tag: 'PracticeData', op: 'GetPractices' }) }
    },
    { requestOrder: 'alphabetical' },
  )
  const practices = await c.getPractices()
  assert.equal(practices.length, 1)
  assert.equal(practices[0].NPI, '1234567893')
  assert.match(reqs[0].headers.SOAPAction, /KareoServices\/GetPractices"$/)
  assert.match(reqs[0].body, /<sch:request><sch:Filter><sch:PracticeName>SquareOne Medical<\/sch:PracticeName><\/sch:Filter><sch:RequestHeader>/)
})

test('createTebraSource defaults to mock and gates the real client', () => {
  assert.ok(createTebraSource() instanceof MockTebraSource)
  assert.throws(() => createTebraSource({ useMock: false }), /COMPLIANCE/)
  assert.throws(() => createTebraSource({ useMock: false, allowRealPhi: true }), /requires TEBRA_CUSTOMER_KEY/)
  const real = createTebraSource({
    useMock: false, allowRealPhi: true, customerKey: 'k', user: 'u', password: 'p', practiceName: PRACTICE,
    transport: async () => ({ status: 200, text: '' }),
  })
  assert.ok(real instanceof TebraClient)
})

test('to-canonical helpers: dates, money, payer keys, names, statuses, reasons, filing codes', () => {
  assert.equal(tebraDate('01/05/1990'), '1990-01-05')
  assert.equal(tebraDate('2026-01-15T00:00:00'), '2026-01-15')
  assert.equal(tebraDate(''), '')
  assert.equal(tebraCents('1,234.50'), 123450)
  assert.equal(tebraCents('$12'), 1200)
  assert.equal(tebraCents('(12.00)'), -1200)
  assert.equal(tebraCents(''), 0)
  assert.equal(tebraCents(undefined), 0)
  assert.equal(tebraCents('n/a'), 0)
  assert.equal(payerKey('Blue Cross Blue Shield of Oklahoma'), 'BLUECROSSBLUESHIELDOFOKLAHOMA')
  assert.equal(payerKey(''), 'UNKNOWNPAYER')
  assert.deepEqual(splitPatientName('DOE, JANE'), { firstName: 'JANE', lastName: 'DOE' })
  assert.deepEqual(splitPatientName('Jane Q Doe'), { firstName: 'Jane', lastName: 'Q Doe' })
  assert.equal(normalizeStatus('Error – Denial'), 'denial')
  assert.equal(normalizeStatus('Error-Rejection'), 'rejection')
  assert.equal(normalizeStatus('Error – No Response'), 'noresponse')
  assert.equal(normalizeStatus('Completed'), 'completed')
  assert.equal(normalizeStatus(undefined), 'undefined')
  assert.deepEqual(parseAdjustmentReason('CO-45'), { groupCode: 'CO', carcCode: '45' })
  assert.deepEqual(parseAdjustmentReason('45 - Charge exceeds fee schedule'), { groupCode: 'CO', carcCode: '45' })
  assert.deepEqual(parseAdjustmentReason('PR 1'), { groupCode: 'PR', carcCode: '1' })
  assert.deepEqual(parseAdjustmentReason('Contractual Adjustment'), { groupCode: 'CO', carcCode: 'UNKNOWN' })
  assert.equal(claimFilingCode('Medicare'), 'MB')
  assert.equal(claimFilingCode('Medicaid'), 'MC')
  assert.equal(claimFilingCode('Commercial'), 'CI')
  assert.equal(claimFilingCode('Self Pay'), undefined)
})

test('tebraChargesToEncounters: groups charge lines by encounter into canonical encounters', () => {
  const encs = tebraChargesToEncounters(sampleTebraCharges('2026-01-15'), { PracticeName: PRACTICE, NPI: '1234567893', TaxID: '74-2345678' })
  assert.equal(encs.length, 4)
  const e = encs[0]
  assert.equal(e.patientControlNumber, 'E-2001')
  assert.equal(e.payer.externalId, 'MEDICARE')
  assert.equal(e.payer.name, 'Medicare')
  assert.equal(e.subscriber.firstName, 'JANE')
  assert.equal(e.subscriber.lastName, 'DOE')
  assert.equal(e.subscriber.dateOfBirth, '1990-01-01')
  assert.equal(e.billingProvider.npi, '1234567893')
  assert.equal(e.billingProvider.taxId, '742345678')
  assert.equal(e.dateOfService, '2026-01-15')
  assert.equal(e.placeOfServiceCode, '11')
  assert.equal(e.claimFilingCode, 'MB')
  assert.deepEqual(e.diagnoses, ['E1165', 'I10'])
  assert.equal(e.lines.length, 2)
  assert.deepEqual(e.lines[0].diagnosisPointers, [1, 2])
  assert.equal(e.lines[0].chargeCents, 15000)
  assert.deepEqual(encs[1].lines[0].modifiers, ['25'])

  const claim = encounterToClaim(e, 'tebra')
  assert.equal(claim.totalBilledCents, 17500)
  assert.equal(claim.sourceAdapter, 'tebra')
  assert.equal(claim.controlNumber, 'E-2001')
})

test('tebraChargesToRemittances: adjudicated lines only, 835-style amounts and CARCs', () => {
  const remits = tebraChargesToRemittances(sampleTebraCharges('2026-01-15'))
  assert.deepEqual(remits.map((r) => r.claimControlNumber), ['E-2001', 'E-2002', 'E-2003']) // E-2004 was never adjudicated

  const paidToContract = remits[0]
  assert.equal(paidToContract.claimStatusCode, '1')
  assert.equal(paidToContract.totalPaidCents, 9300)
  assert.equal(paidToContract.patientRespCents, 2250)

  const aetna = remits[1].lines[0]
  assert.equal(aetna.cptHcpcs, '99213')
  assert.deepEqual(aetna.modifiers, ['25'])
  assert.equal(aetna.billedCents, 12000)
  assert.equal(aetna.paidCents, 6400)
  assert.equal(aetna.allowedCents, 8000)
  assert.equal(aetna.patientRespCents, 1600)
  assert.deepEqual(aetna.adjustments, [
    { groupCode: 'CO', carcCode: '45', amountCents: 4000 },
    { groupCode: 'PR', carcCode: '2', amountCents: 1600 },
  ])

  const denied = remits[2]
  assert.equal(denied.claimStatusCode, '4')
  assert.equal(denied.totalPaidCents, 0)
  assert.deepEqual(denied.lines[0].adjustments, [{ groupCode: 'CO', carcCode: '197', amountCents: 21000 }])

  // A denial posted with no adjustment detail still reads as a payer denial.
  const bare = tebraChargesToRemittances([{ ID: 'C-1', EncounterID: 'E-1', ProcedureCode: '99213', TotalCharges: '100.00', Status: 'Error – Denial', PrimaryInsuranceBilledCompanyName: 'Aetna' }])
  assert.deepEqual(bare[0].lines[0].adjustments, [{ groupCode: 'CO', carcCode: 'DENIED', amountCents: 10000 }])

  // Patient-pay-only rows have no payer contract to diff against → skipped.
  assert.equal(tebraChargesToRemittances([{ ID: 'C-2', EncounterID: 'E-2', ProcedureCode: '99213', TotalCharges: '100.00', Status: 'Completed' }]).length, 0)
})

test('tebraChargesToFeeScheduleLines: contract-expected amounts become rates (first per payer/code/modifier)', () => {
  const lines = tebraChargesToFeeScheduleLines(sampleTebraCharges())
  assert.equal(lines.length, 7)
  assert.deepEqual(lines[2], { payerExternalId: 'AETNA', cptHcpcs: '99213', modifier: '25', contractedCents: 9500 })
  assert.deepEqual(lines[6], { payerExternalId: 'BLUECROSSBLUESHIELDOFOKLAHOMA', cptHcpcs: '96372', modifier: undefined, contractedCents: 2500 })
})

test('found money straight from a Tebra pull (mock): every finding type, deterministic totals', async () => {
  const result = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' })
  const { report } = result
  assert.equal(report.meta.source, 'tebra')
  assert.equal(result.claims.length, 4)
  assert.equal(result.remittances.length, 3)
  assert.equal(result.feeSchedule.size, 7)
  assert.equal(report.totals.count, 4)
  assert.deepEqual(report.totals.byType.underpayment, { count: 1, recoverableCents: 1500 })
  assert.deepEqual(report.totals.byType.denial, { count: 1, recoverableCents: 12800 })
  assert.deepEqual(report.totals.byType.unadjudicated, { count: 2, recoverableCents: 13500 })
  assert.deepEqual(report.totals.byType.undercoding, { count: 0, recoverableCents: 0 })
  assert.equal(report.totals.recoverableCents, 27800)
  assert.equal(report.totals.appealableDenialCount, 1)

  const underpaid = report.findings.find((f) => f.type === 'underpayment')!
  assert.equal(underpaid.claimControlNumber, 'E-2002')
  assert.equal(underpaid.cptHcpcs, '99213')
  assert.equal(underpaid.carcCode, '45')
  assert.equal(underpaid.expectedCents, 9500)
  assert.equal(underpaid.actualCents, 6400)

  // Fallback (CSV) rates fill codes Tebra has no contract for, never override Tebra's.
  const withFallback = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, [
    { payerExternalId: 'AETNA', cptHcpcs: '99213', modifier: '25', contractedCents: 1 },
    { payerExternalId: 'AETNA', cptHcpcs: '99499', contractedCents: 5000 },
  ])
  assert.equal(withFallback.feeSchedule.rate('AETNA', '99213', '25'), 9500)
  assert.equal(withFallback.feeSchedule.rate('AETNA', '99499'), 5000)
})

test('pullTebraCanonical returns rows, practice, encounters, claims, remittances, rates and tracking', async () => {
  const pull = await pullTebraCanonical(new MockTebraSource(), { serviceDateFrom: '2026-01-15' })
  assert.equal(pull.rows.length, 7)
  assert.equal(pull.practice?.NPI, '1234567893')
  assert.equal(pull.encounters.length, 4)
  assert.equal(pull.claims[0].providerNpi, '1234567893')
  assert.equal(pull.feeScheduleLines.length, 7)
  assert.equal(pull.tracking.length, 7)
})

test('tebraChargesToClaimTracking: per-line status, balances, secondary + statement billing', () => {
  const tracking = tebraChargesToClaimTracking(sampleTebraCharges('2026-01-15'))
  assert.equal(tracking.length, 7)
  const jane = tracking[0]
  assert.equal(jane.claimLineId, 'E-2001:1')
  assert.equal(jane.status, 'adjudicated')
  assert.equal(jane.lastBilledDate, '2026-01-15')
  assert.equal(jane.patientBalanceCents, 2250)
  assert.equal(jane.insuranceBalanceCents, 0)
  assert.equal(jane.secondaryPayer?.name, 'SoonerCare')
  assert.equal(jane.secondaryBilledDate, undefined)
  assert.equal(tracking[2].patientBilledDate, undefined) // Aetna coinsurance never on a statement
  assert.equal(tracking[4].status, 'denied')
  assert.equal(tracking[5].status, 'no_response')
  assert.equal(tracking[6].status, 'rejected')
  // Tolerates the guide's "FirstBilDate" spelling.
  const [odd] = tebraChargesToClaimTracking([{ ID: 'C-1', EncounterID: 'E-1', ProcedureCode: '99213', PrimaryInsuranceBilledCompanyName: 'Aetna', PrimaryInsuranceFirstBilDate: '2026-02-01', Status: 'Pending' }])
  assert.equal(odd.lastBilledDate, '2026-02-01')
  assert.equal(odd.status, 'pending')
})

test('posting workbench: the "needs a biller" queue from a Tebra pull, deterministic and ranked by dollars', async () => {
  const now = new Date('2026-02-14T12:00:00Z') // 30 days after the clinic day
  const { workbench } = await runTebraFoundMoney(new MockTebraSource(), { serviceDateFrom: '2026-01-15' }, [], now)
  assert.equal(workbench.items.length, 6)
  assert.equal(workbench.atStakeCents, 31650)
  assert.deepEqual(
    workbench.items.map((i) => [i.category, i.amountCents]),
    [
      ['appeal_denial', 12800],
      ['status_check', 11000],
      ['resubmit_rejected', 2500],
      ['bill_secondary', 2250],
      ['send_statement', 1600],
      ['appeal_underpayment', 1500],
    ],
  )
  assert.equal(workbench.items[0].findingId, 'denial:E-2003:1')
  assert.equal(workbench.items[0].patientName, 'JAMES OKAFOR')
  const status = workbench.items.find((i) => i.category === 'status_check')!
  assert.equal(status.daysSince, 30)
  assert.match(status.action, /30 days since sent/)
  const secondary = workbench.items.find((i) => i.category === 'bill_secondary')!
  assert.equal(secondary.claimLineId, 'E-2001:1')
  assert.match(secondary.action, /Bill SoonerCare/)
  assert.deepEqual(workbench.byCategory.send_statement, { count: 1, amountCents: 1600 })
  assert.deepEqual(workbench.byCategory.appeal_underpayment, { count: 1, amountCents: 1500 })
  // No double counting: E-2004's unanswered lines come from tracking, not from the unadjudicated findings too.
  assert.equal(workbench.items.filter((i) => i.claimControlNumber === 'E-2004').length, 2)
})
