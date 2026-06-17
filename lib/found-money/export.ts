import type { Finding } from '../canonical'
import type { FoundMoneyReport } from './run'

/**
 * Findings export. A found-money report is only useful if a biller can work it
 * line by line, so we emit a flat CSV worklist (and JSON for programmatic use).
 * Money is rendered as decimal dollars here — this is a display artifact; the
 * canonical representation stays integer cents.
 */

const HEADERS = [
  'recoverable',
  'type',
  'cpt',
  'modifiers',
  'payer',
  'payer_id',
  'date_of_service',
  'expected',
  'actual',
  'delta',
  'appealable',
  'status',
  'carc',
  'claim',
  'line',
  'reason',
] as const

function dollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function csvCell(value: string | number | boolean): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function findingsToCsv(findings: Finding[]): string {
  const rows = [HEADERS.join(',')]
  for (const f of findings) {
    rows.push(
      [
        dollars(f.recoverableCents),
        f.type,
        f.cptHcpcs,
        f.modifiers.join(' '),
        f.payerName,
        f.payerExternalId,
        f.dateOfService ?? '',
        dollars(f.expectedCents),
        dollars(f.actualCents),
        dollars(f.deltaCents),
        f.appealable,
        f.status,
        f.carcCode ?? '',
        f.claimControlNumber,
        f.claimLineId,
        f.reason,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return rows.join('\n') + '\n'
}

export function reportToJson(report: FoundMoneyReport): string {
  return JSON.stringify(report, null, 2)
}
