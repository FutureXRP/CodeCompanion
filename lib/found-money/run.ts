import type { Finding, FindingType } from '../canonical'
import { loadClaims, loadRemittances } from '../adapters/edi'
import { loadFeeSchedule } from '../adapters/fee-schedule'
import { runDiff } from '../diff'

/**
 * The Phase 0 vertical slice, wired end to end:
 *   load 837 + 835  ->  load fee schedule  ->  diff  ->  ranked found-money report
 *
 * Single-tenant, no DB, no model, no rail. The dollar figure this returns is the
 * proof of the whole thesis (ROADMAP Phase 0). Deterministic throughout.
 */

export interface TypeTotal {
  count: number
  recoverableCents: number
}

export interface FoundMoneyTotals {
  recoverableCents: number
  count: number
  byType: Record<FindingType, TypeTotal>
  appealableDenialCount: number
}

export interface FoundMoneyReport {
  findings: Finding[]
  totals: FoundMoneyTotals
  meta: {
    generatedAt: string
    source: 'samples' | 'files'
    claimCount: number
    remittanceCount: number
    lineCount: number
    feeScheduleSize: number
  }
}

export function runFoundMoney(): FoundMoneyReport {
  const claims = loadClaims()
  const remittances = loadRemittances()
  const feeSchedule = loadFeeSchedule()
  const findings = runDiff(claims, remittances, feeSchedule)

  const byType: Record<FindingType, TypeTotal> = {
    underpayment: { count: 0, recoverableCents: 0 },
    denial: { count: 0, recoverableCents: 0 },
    undercoding: { count: 0, recoverableCents: 0 },
  }
  let recoverableCents = 0
  let appealableDenialCount = 0

  for (const finding of findings) {
    byType[finding.type].count += 1
    byType[finding.type].recoverableCents += finding.recoverableCents
    recoverableCents += finding.recoverableCents
    if (finding.type === 'denial' && finding.appealable) appealableDenialCount += 1
  }

  return {
    findings,
    totals: { recoverableCents, count: findings.length, byType, appealableDenialCount },
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.EDI_USE_SAMPLE_FILES === 'false' ? 'files' : 'samples',
      claimCount: claims.length,
      remittanceCount: remittances.length,
      lineCount: claims.reduce((total, claim) => total + claim.lines.length, 0),
      feeScheduleSize: feeSchedule.size,
    },
  }
}
