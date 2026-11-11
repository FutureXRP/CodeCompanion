import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { csvRecords, parseCsv } from '../lib/util/csv'
import { SEED_EDITS, loadEditTablesFromEnv, mergeEditTables, parseMueTable, parsePtpEdits, scrubClaim } from '../lib/scrub'
import { parseContractExport, sampleTebraCharges, samplePractice, samplePendingTebraCharges, validateTebraShape } from '../lib/adapters/tebra'
import type { Claim } from '../lib/canonical'

test('csv: quotes, doubled quotes, CRLF, BOM, blank lines', () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n\r\n2,,3\n')
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, y', 'say "hi"'], ['2', '', '3']])
  const { headers, records } = csvRecords('Insurance Company , CPT\nAetna,99213')
  assert.deepEqual(headers, ['insurance company', 'cpt'])
  assert.deepEqual(records, [{ 'insurance company': 'Aetna', cpt: '99213' }])
})

const PTP = [
  'Column 1,Column 2,* = In existence prior to 1996,Effective Date,Deletion Date,Modifier 0=not allowed 1=allowed 9=not applicable,PTP Edit Rationale',
  '99214,36415,*,19960101,*,0,Standards of medical / surgical practice',
  '80053,80048,,20000101,,0,CPT Manual or CMS manual coding instructions',
  '17110,11200,,20100101,,1,Misuse of column two code with column one code',
  '99213,G0444,,20110101,20120101,1,Deleted edit',
  '93000,93005,,19960101,,9,Not applicable',
  'abc,99213,,19960101,,1,junk',
].join('\n')

const MUE = ['HCPCS/CPT Code,Practitioner Services MUE Values,MUE Adjudication Indicator,MUE Rationale', '36415,1,3 Date of Service Edit: Clinical,Anatomic', '96372,4,2 Date of Service Edit: Policy,Code Descriptor', 'junk,x,,'].join('\n')

test('NCCI PTP + MUE files parse by meaning; deleted / not-applicable rows are skipped', () => {
  const edits = parsePtpEdits(PTP)
  assert.deepEqual(
    edits.map((e) => [e.column1, e.column2, e.bypassable]),
    [['99214', '36415', false], ['80053', '80048', false], ['17110', '11200', true]],
  )
  assert.equal(edits[2].note, 'Misuse of column two code with column one code')
  assert.deepEqual(parseMueTable(MUE), { '36415': 1, '96372': 4 })
  assert.throws(() => parsePtpEdits('foo,bar\n1,2'), /Column 1/)
  assert.throws(() => parseMueTable('foo,bar\n1,2'), /MUE/)
})

test('mergeEditTables: file entries override the seed on the same pair / code and add new ones', () => {
  const merged = mergeEditTables(SEED_EDITS, { cci: parsePtpEdits(PTP), mue: parseMueTable(MUE) })
  const pair = merged.cci.find((e) => e.column1 === '80053' && e.column2 === '80048')!
  assert.equal(pair.note, 'CPT Manual or CMS manual coding instructions') // file wins
  assert.equal(merged.cci.filter((e) => e.column1 === '80053' && e.column2 === '80048').length, 1)
  assert.ok(merged.cci.some((e) => e.column1 === '17110'))
  assert.equal(merged.mue['36415'], 1) // file overrides the seed cap of 2
  assert.equal(merged.mue['99213'], 1) // seed kept
})

test('loadEditTablesFromEnv: seed without files, merged with files, and the scrubber uses them', () => {
  assert.equal(loadEditTablesFromEnv({}), SEED_EDITS)
  const dir = mkdtempSync(join(tmpdir(), 'ncci-'))
  const ptp = join(dir, 'ptp.csv')
  const mue = join(dir, 'mue.csv')
  writeFileSync(ptp, PTP)
  writeFileSync(mue, MUE)
  const tables = loadEditTablesFromEnv({ NCCI_PTP_PATH: ptp, NCCI_MUE_PATH: mue })
  assert.ok(tables.cci.some((e) => e.column1 === '99214' && e.column2 === '36415'))

  const claim: Claim = {
    controlNumber: 'C', payer: { externalId: 'AETNA', name: 'Aetna' }, providerNpi: '1234567893', diagnoses: ['E1165'], dateOfService: '2026-01-15', placeOfService: '11',
    totalBilledCents: 17500, sourceAdapter: 'tebra',
    lines: [
      { id: 'C:1', lineNumber: 1, cptHcpcs: '99214', modifiers: [], units: 1, diagnosisPointers: [1], billedCents: 15000 },
      { id: 'C:2', lineNumber: 2, cptHcpcs: '36415', modifiers: [], units: 2, diagnosisPointers: [1], billedCents: 2500 },
    ],
    billingProvider: { npi: '1234567893', organizationName: 'X' },
  }
  const seeded = scrubClaim(claim) // seed: 36415 MUE 2 → fine; no 99214/36415 pair
  assert.ok(!seeded.findings.some((f) => f.code === 'CCI-PTP'))
  const real = scrubClaim(claim, undefined, tables) // file: the pair exists (not bypassable) and the MUE is 1
  assert.ok(real.findings.some((f) => f.code === 'CCI-PTP' && f.severity === 'error'))
  assert.ok(real.findings.some((f) => f.code === 'MUE'))
})

test('Tebra contract export: columns found by meaning, quoted payer names, the same payer key as the charge side', () => {
  const csv = [
    'Insurance Company,Insurance Plan,Procedure Code,Modifier,Fee,Contract Rate',
    '"Blue Cross Blue Shield of Oklahoma, Inc.",BlueChoice PPO,99214,,150.00,$110.00',
    'Aetna,Aetna Choice POS II,99213,25,120.00,95.00',
    'Aetna,Aetna Choice POS II,99213,25,120.00,99.00',
    'Medicare,Part B,G0444,,30.00,18.00',
    'Medicare,Part B,,,30.00,18.00',
    'Medicare,Part B,J3301,,0.00,0.00',
  ].join('\n')
  const parsed = parseContractExport(csv)
  assert.deepEqual(parsed.columns, { payer: 'insurance company', plan: 'insurance plan', code: 'procedure code', modifier: 'modifier', rate: 'contract rate' })
  assert.deepEqual(parsed.lines, [
    { payerExternalId: 'BLUECROSSBLUESHIELDOFOKLAHOMAINC', cptHcpcs: '99214', modifier: undefined, contractedCents: 11000 },
    { payerExternalId: 'AETNA', cptHcpcs: '99213', modifier: '25', contractedCents: 9500 },
    { payerExternalId: 'MEDICARE', cptHcpcs: 'G0444', modifier: undefined, contractedCents: 1800 },
  ])
  assert.equal(parsed.skipped, 2)
  assert.throws(() => parseContractExport('a,b\n1,2'), /could not find/)
})

test('validateTebraShape: the mock passes clean; an empty or rate-less account fails loudly', () => {
  const clean = validateTebraShape({ rows: sampleTebraCharges('2026-01-15'), practice: samplePractice(), pendingRows: samplePendingTebraCharges('2026-01-15') })
  assert.equal(clean.ok, true)
  assert.equal(clean.clean, true)
  assert.equal(clean.checks.find((c) => c.id === 'contract_rates')?.status, 'pass')
  assert.equal(clean.checks.find((c) => c.id === 'carc')?.status, 'pass')
  assert.equal(clean.checks.find((c) => c.id === 'pending')?.status, 'pass')

  const empty = validateTebraShape({ rows: [] })
  assert.equal(empty.ok, false)
  assert.equal(empty.checks[0].status, 'fail')

  const noRates = sampleTebraCharges('2026-01-15').map((r) => ({ ...r, ExpectedAmount: '0.00', AllowedAmount: '0.00' }))
  const blind = validateTebraShape({ rows: noRates, practice: samplePractice() })
  assert.equal(blind.ok, false)
  assert.equal(blind.checks.find((c) => c.id === 'contract_rates')?.status, 'fail')
  assert.equal(blind.checks.find((c) => c.id === 'pending')?.status, 'info')
})
