import { readFileSync } from 'node:fs'
import { csvRecords, findHeader } from '../util/csv'
import { SEED_EDITS } from './engine'
import type { CciEdit, EditTables, MueTable } from './types'

/**
 * Load the real CMS NCCI tables behind the scrubber's EditTables seam.
 *
 * CMS publishes the practitioner PTP edits and the MUE values quarterly as
 * spreadsheets; saved as CSV they parse here. Columns are found by meaning
 * (the headers shift wording between releases). Without the files the seed
 * tables apply — enough to prove the rules, not to clear a payer.
 *
 *   NCCI_PTP_PATH=/path/to/ptp-practitioner.csv
 *   NCCI_MUE_PATH=/path/to/mue-practitioner.csv
 */

const COL1 = [/^column 1$/, /column\s*1/, /comprehensive/]
const COL2 = [/^column 2$/, /column\s*2/, /component/]
const MOD = [/modifier/]
const DELETED = [/deletion/, /deleted/]
const RATIONALE = [/rationale/, /reason/]
const CODE = [/hcpcs\/cpt code/, /hcpcs/, /cpt/, /^code$/, /\bcode\b/]
const MUE = [/mue value/, /\bmue\b/, /max(imum)? units/, /units/]

const looksLikeDate = (v: string) => /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{8}/.test(v)

/** CMS PTP (procedure-to-procedure) edits → CciEdit[]; deleted pairs and "9 = not applicable" rows are skipped. */
export function parsePtpEdits(csv: string): CciEdit[] {
  const { headers, records } = csvRecords(csv)
  const col1 = findHeader(headers, COL1)
  const col2 = findHeader(headers, COL2)
  const mod = findHeader(headers, MOD)
  const del = findHeader(headers, DELETED)
  const why = findHeader(headers, RATIONALE)
  if (!col1 || !col2) throw new Error(`NCCI PTP: could not find the Column 1 / Column 2 headers in [${headers.join(', ')}].`)
  const out: CciEdit[] = []
  const seen = new Set<string>()
  for (const r of records) {
    const column1 = (r[col1] ?? '').trim().toUpperCase()
    const column2 = (r[col2] ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(column1) || !/^[A-Z0-9]{5}$/.test(column2)) continue
    if (del && looksLikeDate(r[del] ?? '')) continue
    const indicator = mod ? (r[mod] ?? '').trim() : '1'
    if (indicator === '9') continue
    const key = `${column1}|${column2}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ column1, column2, bypassable: indicator === '1', note: (why ? r[why] : '') || 'NCCI procedure-to-procedure edit' })
  }
  return out
}

/** CMS MUE values → code → max units per day. */
export function parseMueTable(csv: string): MueTable {
  const { headers, records } = csvRecords(csv)
  const code = findHeader(headers, CODE)
  const mue = findHeader(headers, MUE)
  if (!code || !mue) throw new Error(`NCCI MUE: could not find the code / MUE value headers in [${headers.join(', ')}].`)
  const out: MueTable = {}
  for (const r of records) {
    const c = (r[code] ?? '').trim().toUpperCase()
    const n = Number((r[mue] ?? '').replace(/[^\d.]/g, ''))
    if (/^[A-Z0-9]{5}$/.test(c) && Number.isFinite(n) && n > 0) out[c] = n
  }
  return out
}

/** Seed tables, overlaid with whatever files are configured (file entries win on conflict). */
export function mergeEditTables(base: EditTables, extra: Partial<EditTables>): EditTables {
  const seen = new Set(base.cci.map((e) => `${e.column1}|${e.column2}`))
  const cci = [...base.cci]
  for (const e of extra.cci ?? []) {
    const k = `${e.column1}|${e.column2}`
    if (seen.has(k)) {
      const i = cci.findIndex((x) => `${x.column1}|${x.column2}` === k)
      cci[i] = e
    } else {
      seen.add(k)
      cci.push(e)
    }
  }
  return { cci, mue: { ...base.mue, ...(extra.mue ?? {}) } }
}

let cached: { key: string; tables: EditTables } | null = null

export function loadEditTablesFromEnv(env: Record<string, string | undefined> = process.env): EditTables {
  const ptp = env.NCCI_PTP_PATH
  const mue = env.NCCI_MUE_PATH
  const key = `${ptp ?? ''}|${mue ?? ''}`
  if (cached && cached.key === key) return cached.tables
  const extra: Partial<EditTables> = {}
  if (ptp) extra.cci = parsePtpEdits(readFileSync(ptp, 'utf8'))
  if (mue) extra.mue = parseMueTable(readFileSync(mue, 'utf8'))
  const tables = ptp || mue ? mergeEditTables(SEED_EDITS, extra) : SEED_EDITS
  cached = { key, tables }
  return tables
}

/** Which tables are in force — for the readiness report and the review page footer. */
export function editTableStatus(env: Record<string, string | undefined> = process.env): { ptp: 'file' | 'seed'; mue: 'file' | 'seed' } {
  return { ptp: env.NCCI_PTP_PATH ? 'file' : 'seed', mue: env.NCCI_MUE_PATH ? 'file' : 'seed' }
}
