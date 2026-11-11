import { readFileSync } from 'node:fs'
import type { FeeScheduleLine } from '../../canonical'
import { csvRecords, findHeader } from '../../util/csv'
import { payerKey, tebraCents } from './to-canonical'

/**
 * Tebra "Export Contracts and Fees" → canonical fee-schedule lines.
 *
 * Tebra writes the export as a spreadsheet; saved as CSV its column names vary
 * by version, so the columns are found by meaning, not position: the insurance
 * company (and plan), the procedure code, an optional modifier, and the
 * contracted / allowed amount. The payer key is the same slug the charge
 * adapter derives from the billed company name, so the two sides join.
 *
 * These are the rates for codes that are NOT on any encounter yet (the add-ons
 * the pre-approval review can suggest) — on billed codes, GetCharges' own
 * ExpectedAmount wins.
 */

const PAYER = [/^insurance company$/, /insurance company/, /^payer$/, /payer/, /^company$/, /insurance/]
const PLAN = [/^plan name$/, /plan/]
const CODE = [/^procedure code$/, /procedure code/, /^cpt/, /hcpcs/, /^procedure$/, /\bcode\b/]
const MODIFIER = [/modifier/]
const RATE = [/contract rate/, /allowed amount/, /^allowed/, /expected/, /allowable/, /contract/, /^rate$/, /\brate\b/, /^fee$/, /\bfee\b/, /amount/]

export interface ContractExportParse {
  lines: FeeScheduleLine[]
  /** Which columns were used — surfaced so a mis-detected header is obvious. */
  columns: { payer?: string; plan?: string; code?: string; modifier?: string; rate?: string }
  skipped: number
}

export function parseContractExport(csv: string): ContractExportParse {
  const { headers, records } = csvRecords(csv)
  const columns = {
    payer: findHeader(headers, PAYER),
    plan: findHeader(headers, PLAN),
    code: findHeader(headers, CODE),
    modifier: findHeader(headers, MODIFIER),
    rate: findHeader(headers, RATE),
  }
  if (!columns.code || !columns.rate || (!columns.payer && !columns.plan)) {
    throw new Error(
      `Contract export: could not find the payer, procedure-code and rate columns in headers [${headers.join(', ')}].`,
    )
  }
  const seen = new Set<string>()
  const lines: FeeScheduleLine[] = []
  let skipped = 0
  for (const r of records) {
    const company = (columns.payer ? r[columns.payer] : '') || (columns.plan ? r[columns.plan] : '')
    const cptHcpcs = (r[columns.code] ?? '').trim().toUpperCase()
    const modifier = columns.modifier ? (r[columns.modifier] ?? '').trim().toUpperCase() || undefined : undefined
    const contractedCents = tebraCents(r[columns.rate])
    if (!company || !/^[A-Z0-9]{4,6}$/.test(cptHcpcs) || contractedCents <= 0) {
      skipped++
      continue
    }
    const payerExternalId = payerKey(company)
    const key = `${payerExternalId}|${cptHcpcs}|${modifier ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ payerExternalId, cptHcpcs, modifier, contractedCents })
  }
  return { lines, columns, skipped }
}

export function loadContractExport(path: string): FeeScheduleLine[] {
  return parseContractExport(readFileSync(path, 'utf8')).lines
}

/** The practice's contract export when configured (TEBRA_CONTRACT_EXPORT_PATH); otherwise no fallback rates. */
export function fallbackRatesFromEnv(env: Record<string, string | undefined> = process.env): FeeScheduleLine[] {
  const path = env.TEBRA_CONTRACT_EXPORT_PATH
  return path ? loadContractExport(path) : []
}
