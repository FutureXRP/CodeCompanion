import type { Claim } from '../canonical'
import { loadClaims, loadRemittances } from '../adapters/edi'
import { loadFeeSchedule } from '../adapters/fee-schedule'
import { createTebraSource, tebraConfigFromEnv } from '../adapters/tebra'
import { DEFAULT_DATE } from '../mock-ehr'
import { runFoundMoneyFrom, type FoundMoneyReport } from './run'
import { runTebraFoundMoney } from './tebra'

/**
 * Which source the Found Money page, its CSV export and the appeal drafter read.
 * On a practice-management system (Tebra) the diff runs off the PM pull — mock
 * until the Customer Key exists, live after — so a denial on the page is a
 * denial the appeal writer can draft from. The 837/835 file path remains for
 * history loads and audits, and is chosen automatically when real files are
 * configured. `FOUND_MONEY_SOURCE` overrides either way.
 */

export type FoundMoneySourceKind = 'tebra' | 'files'

export interface FoundMoneyView {
  kind: FoundMoneySourceKind
  /** Badge text for the page. */
  label: string
  /** Real practice data (live PM, or real files) rather than the synthetic set. */
  live: boolean
  report: FoundMoneyReport
  /** The claims the findings refer to — patient names and lines for the page. */
  claims: Claim[]
}

type Env = Record<string, string | undefined>

export function foundMoneySourceKind(env: Env = process.env): FoundMoneySourceKind {
  const explicit = env.FOUND_MONEY_SOURCE
  if (explicit === 'files' || explicit === 'tebra') return explicit
  return env.EDI_USE_SAMPLE_FILES === 'false' ? 'files' : 'tebra'
}

export async function loadFoundMoney(env: Env = process.env): Promise<FoundMoneyView> {
  if (foundMoneySourceKind(env) === 'files') {
    const realFiles = env.EDI_USE_SAMPLE_FILES === 'false'
    const claims = loadClaims()
    const report = runFoundMoneyFrom(claims, loadRemittances(), loadFeeSchedule(), realFiles ? 'files' : 'samples')
    return { kind: 'files', label: realFiles ? '837 / 835 files' : 'Sample 837 / 835 · synthetic', live: realFiles, report, claims }
  }
  const cfg = tebraConfigFromEnv()
  const r = await runTebraFoundMoney(createTebraSource(cfg), { serviceDateFrom: DEFAULT_DATE })
  return { kind: 'tebra', label: cfg.useMock ? 'Tebra · mock · synthetic' : 'Tebra · live', live: !cfg.useMock, report: r.report, claims: r.claims }
}
