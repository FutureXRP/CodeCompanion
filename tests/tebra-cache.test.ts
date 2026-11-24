import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CachedTebraSource } from '../lib/adapters/tebra/cache'
import { TebraBudgetError, TebraCallMeter, meterFromEnv } from '../lib/adapters/tebra/meter'
import { MockTebraSource, TebraClient, createTebraSource, resetMockTebraState, type TebraSource } from '../lib/adapters/tebra'

/** A mock source that counts what reaches it. */
function counting(): { source: TebraSource; calls: Record<string, number> } {
  const inner = new MockTebraSource()
  const calls: Record<string, number> = {}
  const tick = (op: string) => { calls[op] = (calls[op] ?? 0) + 1 }
  const source: TebraSource = {
    getCharges: (q) => { tick('getCharges'); return inner.getCharges(q) },
    getPractices: () => { tick('getPractices'); return inner.getPractices() },
    getAppointments: (q) => { tick('getAppointments'); return inner.getAppointments(q) },
    getPatient: (id) => { tick('getPatient'); return inner.getPatient(id) },
    updateEncounterStatus: (id, s) => { tick('updateEncounterStatus'); return inner.updateEncounterStatus(id, s) },
  }
  return { source, calls }
}

test('cache: identical reads hit once per window, regardless of key order; a different query is a miss; expiry refetches', async () => {
  let t = 0
  const { source, calls } = counting()
  const c = new CachedTebraSource(source, { chargesTtlMs: 1000, now: () => t })
  const a = await c.getCharges({ serviceDateFrom: '2026-01-15', serviceDateTo: '2026-01-15' })
  const b = await c.getCharges({ serviceDateTo: '2026-01-15', serviceDateFrom: '2026-01-15', includeUnapproved: undefined })
  assert.equal(calls.getCharges, 1)
  assert.equal(a, b) // the same array instance — served from memory
  await c.getCharges({ serviceDateFrom: '2026-01-15', serviceDateTo: '2026-01-15', includeUnapproved: true })
  assert.equal(calls.getCharges, 2)
  t = 1001
  await c.getCharges({ serviceDateFrom: '2026-01-15', serviceDateTo: '2026-01-15' })
  assert.equal(calls.getCharges, 3)
  assert.deepEqual(c.stats(), { entries: 2, hits: 1, misses: 3 })
})

test('cache: concurrent misses for one key share a single request', async () => {
  const { source, calls } = counting()
  const c = new CachedTebraSource(source)
  await Promise.all([c.getPatient('P1101'), c.getPatient('P1101'), c.getPatient('P1101')])
  assert.equal(calls.getPatient, 1)
  assert.equal(c.stats().hits, 2)
})

test('cache: patients and the practice are kept for hours; an unknown patient (null) is cached too', async () => {
  const { source, calls } = counting()
  const c = new CachedTebraSource(source)
  assert.ok(await c.getPatient('P1101'))
  assert.ok(await c.getPatient('P1101'))
  assert.equal(await c.getPatient('nobody'), null)
  assert.equal(await c.getPatient('nobody'), null)
  assert.equal(calls.getPatient, 2)
  await c.getPractices()
  await c.getPractices()
  assert.equal(calls.getPractices, 1)
})

test('cache: a write through the source drops the charge entries only', async () => {
  resetMockTebraState()
  const { source, calls } = counting()
  const c = new CachedTebraSource(source)
  await c.getCharges({ serviceDateFrom: '2026-01-15', includeUnapproved: true, encounterStatus: 'Review' })
  await c.getPatient('P1101')
  await c.updateEncounterStatus('P-3001', 'Approved')
  await c.getCharges({ serviceDateFrom: '2026-01-15', includeUnapproved: true, encounterStatus: 'Review' })
  await c.getPatient('P1101')
  assert.equal(calls.getCharges, 2) // refetched after the write
  assert.equal(calls.getPatient, 1) // untouched
  resetMockTebraState()
})

test('meter: counts per month, holds a reserve for essential work, resets on rollover', async () => {
  let date = new Date('2026-12-05T12:00:00Z')
  const m = new TebraCallMeter({ budget: 5, reserve: 2, now: () => date })
  m.record('GetCharges')
  m.record('GetCharges')
  m.record('GetPatient')
  assert.throws(() => m.record('GetAppointments'), TebraBudgetError) // 3 of 5 used, 2 reserved
  assert.throws(() => m.record('GetAppointments'), /held in reserve for the nightly sync/)
  await m.essential(async () => {
    m.record('GetCharges') // 4
    m.record('GetCharges') // 5 — the reserve
    assert.throws(() => m.record('GetCharges'), /5 of 5 calls/)
  })
  assert.deepEqual(m.snapshot().byOperation, { GetCharges: 4, GetPatient: 1 })
  assert.equal(m.snapshot().month, '2026-12')
  date = new Date('2027-01-01T00:00:01Z')
  m.record('GetCharges') // a new month
  assert.equal(m.snapshot().calls, 1)
})

test('meter from env: 10,000 a month with 1,000 reserved by default; the reserve never exceeds the budget', () => {
  const d = meterFromEnv({}).snapshot()
  assert.equal(d.budget, 10_000)
  assert.equal(d.reserve, 1_000)
  const custom = meterFromEnv({ TEBRA_MONTHLY_CALL_BUDGET: '500', TEBRA_CALL_RESERVE: '900' }).snapshot()
  assert.equal(custom.budget, 500)
  assert.equal(custom.reserve, 500)
})

test('the live client counts every attempt on the shared meter and is wrapped in the cache', async () => {
  const meter = new TebraCallMeter({ budget: 2, reserve: 0 })
  let sent = 0
  const transport = async () => { sent += 1; return { status: 200, text: '' } }
  const source = createTebraSource({ useMock: false, allowRealPhi: true, customerKey: 'k', user: 'u', password: 'p', practiceName: 'SquareOne Medical', transport, meter })
  assert.ok(source instanceof CachedTebraSource)
  assert.ok(source.inner instanceof TebraClient)
  await source.getPractices()
  await source.getPractices() // cached — no second request, no second count
  assert.equal(sent, 1)
  assert.equal(meter.snapshot().calls, 1)
  const direct = new TebraClient({ customerKey: 'k', user: 'u', password: 'p', practiceName: 'SquareOne Medical', transport, meter, minIntervalMs: 0 })
  await direct.getPractices() // 2 of 2
  await assert.rejects(() => direct.getPractices(), TebraBudgetError)
  assert.equal(sent, 2)
  const uncached = createTebraSource({ useMock: false, allowRealPhi: true, customerKey: 'k', user: 'u', password: 'p', practiceName: 'SquareOne Medical', transport, meter, cache: false })
  assert.ok(uncached instanceof TebraClient)
})
