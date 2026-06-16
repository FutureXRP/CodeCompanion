import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FeeScheduleLine } from '../../canonical'
import { dollarsToCents } from '../../canonical'

/**
 * Fee-schedule adapter — ingests the practice's contracted rates into the
 * canonical model. CSV first (Athena export second). Contracted rates are not
 * PHI, so no compliance gate; sourcing them cleanly is the hardest data problem
 * on the platform (see DATA-MODEL.md).
 */

const SAMPLE_CSV = join(process.cwd(), 'lib', 'adapters', 'fee-schedule', 'sample_fee_schedule.csv')

function key(payerExternalId: string, cptHcpcs: string, modifier?: string): string {
  return `${payerExternalId}|${cptHcpcs}|${modifier ?? ''}`
}

export class FeeSchedule {
  private readonly rates = new Map<string, number>()

  constructor(lines: FeeScheduleLine[]) {
    for (const line of lines) {
      this.rates.set(key(line.payerExternalId, line.cptHcpcs, line.modifier), line.contractedCents)
    }
  }

  /** Contracted cents for (payer, cpt, modifier); falls back to the no-modifier rate. */
  rate(payerExternalId: string, cptHcpcs: string, modifier?: string): number | undefined {
    return (
      this.rates.get(key(payerExternalId, cptHcpcs, modifier)) ??
      this.rates.get(key(payerExternalId, cptHcpcs, undefined))
    )
  }

  get size(): number {
    return this.rates.size
  }
}

export function parseFeeScheduleCsv(csv: string): FeeScheduleLine[] {
  const out: FeeScheduleLine[] = []
  for (const row of csv.split(/\r?\n/)) {
    const trimmed = row.trim()
    if (!trimmed) continue
    const cells = trimmed.split(',').map((c) => c.trim())
    if (cells[0].toLowerCase() === 'payer_id') continue // header
    const [payerExternalId, cptHcpcs, modifier, rate] = cells
    if (!payerExternalId || !cptHcpcs || !rate) continue
    out.push({
      payerExternalId,
      cptHcpcs,
      modifier: modifier || undefined,
      contractedCents: dollarsToCents(rate),
    })
  }
  return out
}

export function loadFeeScheduleFromText(csv: string): FeeSchedule {
  return new FeeSchedule(parseFeeScheduleCsv(csv))
}

export function loadFeeScheduleFromFile(path: string): FeeSchedule {
  return loadFeeScheduleFromText(readFileSync(path, 'utf8'))
}

export function loadFeeSchedule(): FeeSchedule {
  const override =
    process.env.EDI_USE_SAMPLE_FILES === 'false' ? process.env.FEE_SCHEDULE_PATH : undefined
  return loadFeeScheduleFromFile(override ?? SAMPLE_CSV)
}
