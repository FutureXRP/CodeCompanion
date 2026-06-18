import type { ClearinghouseProvider } from './clearinghouse'

/**
 * Payer directory + clearinghouse crosswalk.
 *
 * There is no universal payer ID: the same payer carries a *different* routing
 * id at each clearinghouse (Aetna might be `60054` at one and `AETNA` at
 * another). So the canonical model (lib/canonical) stores only the payer's own
 * EDI id; the vendor-specific routing id is resolved HERE, at the submission
 * edge, and never leaks up into the canonical/diff path. Ingest the
 * clearinghouse's published payer list once, then resolve at submit time.
 */

export interface PayerDirectoryEntry {
  /** Canonical key — matches Payer.externalId in the canonical model. */
  payerExternalId: string
  name: string
  /** Routing ids keyed by clearinghouse, e.g. { stedi: 'AETNA', availity: '60054' }. */
  clearinghouseIds: Partial<Record<ClearinghouseProvider, string>>
}

export class PayerDirectory {
  private byExternalId = new Map<string, PayerDirectoryEntry>()

  constructor(entries: PayerDirectoryEntry[] = []) {
    for (const e of entries) this.add(e)
  }

  /** Add or merge an entry — repeated payers accumulate per-clearinghouse ids. */
  add(entry: PayerDirectoryEntry): void {
    const existing = this.byExternalId.get(entry.payerExternalId)
    if (existing) {
      existing.clearinghouseIds = { ...existing.clearinghouseIds, ...entry.clearinghouseIds }
      if (entry.name) existing.name = entry.name
    } else {
      this.byExternalId.set(entry.payerExternalId, { ...entry, clearinghouseIds: { ...entry.clearinghouseIds } })
    }
  }

  get(payerExternalId: string): PayerDirectoryEntry | undefined {
    return this.byExternalId.get(payerExternalId)
  }

  /** Resolve the routing id this clearinghouse expects for a canonical payer. */
  resolve(payerExternalId: string, clearinghouse: ClearinghouseProvider): string | undefined {
    return this.byExternalId.get(payerExternalId)?.clearinghouseIds[clearinghouse]
  }

  /** Payers that cannot be routed through this clearinghouse yet (no id mapped). */
  unmapped(clearinghouse: ClearinghouseProvider): PayerDirectoryEntry[] {
    return [...this.byExternalId.values()].filter((e) => !e.clearinghouseIds[clearinghouse])
  }

  get size(): number {
    return this.byExternalId.size
  }
}

/**
 * Ingest a clearinghouse "payer list" export into directory entries. Real
 * clearinghouses publish this (API or CSV). Expected headers, case-insensitive:
 *   payer_external_id, payer_name, clearinghouse_payer_id
 */
export function ingestPayerListCsv(csv: string, clearinghouse: ClearinghouseProvider): PayerDirectoryEntry[] {
  const rows = csv.trim().split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (rows.length === 0) return []
  const header = splitCsvRow(rows[0]).map((h) => h.trim().toLowerCase())
  const extIdx = header.indexOf('payer_external_id')
  const nameIdx = header.indexOf('payer_name')
  const chIdx = header.indexOf('clearinghouse_payer_id')
  if (extIdx === -1 || chIdx === -1) {
    throw new Error('payer list must have payer_external_id and clearinghouse_payer_id columns')
  }
  const entries: PayerDirectoryEntry[] = []
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCsvRow(rows[i])
    const payerExternalId = (cols[extIdx] ?? '').trim()
    const chId = (cols[chIdx] ?? '').trim()
    if (!payerExternalId || !chId) continue
    entries.push({
      payerExternalId,
      name: (nameIdx >= 0 ? cols[nameIdx] ?? '' : '').trim(),
      clearinghouseIds: { [clearinghouse]: chId },
    })
  }
  return entries
}

/** Minimal CSV cell split that tolerates quoted cells with embedded commas. */
function splitCsvRow(row: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const c = row[i]
    if (inQuotes) {
      if (c === '"') {
        if (row[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}
