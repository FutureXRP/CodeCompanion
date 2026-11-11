import type { Claim, FindingType, Remittance } from '../canonical'
import type { FoundMoneyReport } from './run'

/**
 * A de-identified summary of a found-money run — totals by payer and by
 * payer × code, nothing else. No claim numbers, no dates of service, no names:
 * aggregate dollars and counts a practice owner can hand to a partner, a
 * consultant or a prospective vendor without moving PHI. (It is still the
 * practice's financial data — share at the owner's discretion.)
 */

export interface SummaryByPayer {
  payerId: string
  payer: string
  claims: number
  lines: number
  billedCents: number
  paidCents: number
  findings: number
  denials: number
  underpayments: number
  unanswered: number
  undercoding: number
  recoverableCents: number
}

export interface SummaryByPayerCode {
  payerId: string
  payer: string
  cptHcpcs: string
  findings: number
  byType: Record<FindingType, number>
  recoverableCents: number
}

export interface DeidentifiedSummary {
  generatedAt: string
  source: string
  totals: {
    claims: number
    lines: number
    remittances: number
    billedCents: number
    paidCents: number
    findings: number
    recoverableCents: number
    byType: Record<FindingType, { count: number; recoverableCents: number }>
  }
  byPayer: SummaryByPayer[]
  byPayerCode: SummaryByPayerCode[]
}

const TYPES: FindingType[] = ['underpayment', 'denial', 'undercoding', 'unadjudicated']
const emptyTypes = () => ({ underpayment: 0, denial: 0, undercoding: 0, unadjudicated: 0 })

export function summarizeReport(report: FoundMoneyReport, claims: Claim[], remittances: Remittance[]): DeidentifiedSummary {
  const byPayer = new Map<string, SummaryByPayer>()
  const payerOf = (id: string, name: string) => {
    const p = byPayer.get(id) ?? { payerId: id, payer: name, claims: 0, lines: 0, billedCents: 0, paidCents: 0, findings: 0, denials: 0, underpayments: 0, unanswered: 0, undercoding: 0, recoverableCents: 0 }
    byPayer.set(id, p)
    return p
  }
  for (const c of claims) {
    const p = payerOf(c.payer.externalId, c.payer.name)
    p.claims += 1
    p.lines += c.lines.length
    p.billedCents += c.totalBilledCents
  }
  const payerByControl = new Map(claims.map((c) => [c.controlNumber, c.payer]))
  for (const r of remittances) {
    const payer = payerByControl.get(r.claimControlNumber) ?? r.payer
    payerOf(payer.externalId, payer.name).paidCents += r.totalPaidCents
  }

  const byCode = new Map<string, SummaryByPayerCode>()
  for (const f of report.findings) {
    const p = payerOf(f.payerExternalId, f.payerName)
    p.findings += 1
    p.recoverableCents += f.recoverableCents
    if (f.type === 'denial') p.denials += 1
    else if (f.type === 'underpayment') p.underpayments += 1
    else if (f.type === 'unadjudicated') p.unanswered += 1
    else p.undercoding += 1
    const key = `${f.payerExternalId}|${f.cptHcpcs}`
    const row = byCode.get(key) ?? { payerId: f.payerExternalId, payer: f.payerName, cptHcpcs: f.cptHcpcs, findings: 0, byType: emptyTypes(), recoverableCents: 0 }
    row.findings += 1
    row.byType[f.type] += 1
    row.recoverableCents += f.recoverableCents
    byCode.set(key, row)
  }

  return {
    generatedAt: report.meta.generatedAt,
    source: report.meta.source,
    totals: {
      claims: claims.length,
      lines: report.meta.lineCount,
      remittances: remittances.length,
      billedCents: claims.reduce((s, c) => s + c.totalBilledCents, 0),
      paidCents: remittances.reduce((s, r) => s + r.totalPaidCents, 0),
      findings: report.totals.count,
      recoverableCents: report.totals.recoverableCents,
      byType: Object.fromEntries(TYPES.map((t) => [t, { count: report.totals.byType[t].count, recoverableCents: report.totals.byType[t].recoverableCents }])) as DeidentifiedSummary['totals']['byType'],
    },
    byPayer: [...byPayer.values()].sort((a, b) => b.recoverableCents - a.recoverableCents || b.billedCents - a.billedCents || a.payerId.localeCompare(b.payerId)),
    byPayerCode: [...byCode.values()].sort((a, b) => b.recoverableCents - a.recoverableCents || a.payerId.localeCompare(b.payerId) || a.cptHcpcs.localeCompare(b.cptHcpcs)),
  }
}

const dollars = (c: number) => (c / 100).toFixed(2)
const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

/** One CSV with a `section` column: totals, by_payer, by_payer_code. */
export function summaryToCsv(s: DeidentifiedSummary): string {
  const rows: (string | number)[][] = [['section', 'payer_id', 'payer', 'cpt', 'claims', 'lines', 'billed', 'paid', 'findings', 'denials', 'underpayments', 'unanswered', 'undercoding', 'recoverable']]
  rows.push(['totals', '', '', '', s.totals.claims, s.totals.lines, dollars(s.totals.billedCents), dollars(s.totals.paidCents), s.totals.findings, s.totals.byType.denial.count, s.totals.byType.underpayment.count, s.totals.byType.unadjudicated.count, s.totals.byType.undercoding.count, dollars(s.totals.recoverableCents)])
  for (const p of s.byPayer) rows.push(['by_payer', p.payerId, p.payer, '', p.claims, p.lines, dollars(p.billedCents), dollars(p.paidCents), p.findings, p.denials, p.underpayments, p.unanswered, p.undercoding, dollars(p.recoverableCents)])
  for (const r of s.byPayerCode) rows.push(['by_payer_code', r.payerId, r.payer, r.cptHcpcs, '', '', '', '', r.findings, r.byType.denial, r.byType.underpayment, r.byType.unadjudicated, r.byType.undercoding, dollars(r.recoverableCents)])
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'
}

export function summaryToJson(s: DeidentifiedSummary): string {
  return JSON.stringify(s, null, 2)
}
