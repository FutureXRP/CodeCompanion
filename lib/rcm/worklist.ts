import type { Claim, Finding, Remittance } from '../canonical'
import type { SubmissionAck } from './clearinghouse'

/**
 * The action worklist (Rung 1) — turns claim problems into the right next move.
 *
 * The distinction that trips practices up: a REJECTION (caught pre-adjudication
 * by the 277CA/999) never created a claim on file, so you fix it and resend as a
 * NEW original — frequency 1, no ICN. A DENIAL (post-adjudication, on the 835
 * with a CARC) means a claim IS on file, so you appeal it or correct-and-replace
 * it — frequency 7, referencing the payer's ICN. Sending a frequency-7 for a
 * rejection (or a fresh original for a denial) is how duplicate-claim denials
 * happen. DETERMINISTIC routing — no LLM decides the action or the dollars.
 */

export type WorkItemKind = 'rejection' | 'denial' | 'underpayment' | 'undercoding' | 'unadjudicated'
export type WorkAction = 'fix_resubmit' | 'correct_resubmit' | 'appeal' | 'follow_up' | 'write_off'

export interface WorkItem {
  claimControlNumber: string
  payerName: string
  cptHcpcs?: string
  kind: WorkItemKind
  action: WorkAction
  /** Does the next claim reference the payer ICN (a frequency-7 correction or an appeal)? */
  needsIcn: boolean
  /** The payer claim control number (ICN), when the claim reached adjudication. */
  payerClaimControlNumber?: string
  recoverableCents: number
  carcCode?: string
  reason: string
}

export const WORK_ACTION_LABEL: Record<WorkAction, string> = {
  fix_resubmit: 'Fix & resubmit (new claim)',
  correct_resubmit: 'Correct & replace (freq 7)',
  appeal: 'Appeal',
  follow_up: 'Follow up',
  write_off: 'Write off',
}

/** CARCs that signal a fixable claim-data error — correct & replace rather than appeal. */
const CORRECTABLE_CARCS = new Set(['4', '11', '16'])

export function buildWorklist(input: {
  claims: Claim[]
  acks: SubmissionAck[]
  remittances: Remittance[]
  findings: Finding[]
}): WorkItem[] {
  const payerByClaim = new Map(input.claims.map((c) => [c.controlNumber, c.payer.name]))
  const remitByClaim = new Map(input.remittances.map((r) => [r.claimControlNumber, r]))
  const items: WorkItem[] = []

  // 1. Rejections — pre-adjudication, from the 277CA acknowledgment. No claim on
  //    file, so there is nothing to replace: fix the error and resend fresh.
  for (const ack of input.acks) {
    if (ack.status !== 'rejected') continue
    items.push({
      claimControlNumber: ack.claimControlNumber,
      payerName: payerByClaim.get(ack.claimControlNumber) ?? '',
      kind: 'rejection',
      action: 'fix_resubmit',
      needsIcn: false,
      recoverableCents: 0,
      reason: `Rejected before adjudication${ack.rejectReason ? `: ${ack.rejectReason}` : ''}. No claim is on file — fix and resubmit as a new original (frequency 1), not a replacement.`,
    })
  }

  // 2. Findings — post-adjudication, from the 835 diff. A claim is on file, so
  //    corrections reference the payer ICN.
  for (const f of input.findings) {
    const icn = remitByClaim.get(f.claimControlNumber)?.payerClaimControlNumber
    const base = {
      claimControlNumber: f.claimControlNumber,
      payerName: f.payerName,
      cptHcpcs: f.cptHcpcs,
      payerClaimControlNumber: icn,
      recoverableCents: f.recoverableCents,
      carcCode: f.carcCode,
      reason: f.reason,
    }

    if (f.type === 'denial') {
      if (!f.appealable) {
        items.push({ ...base, kind: 'denial', action: 'write_off', needsIcn: false })
      } else if (f.carcCode && CORRECTABLE_CARCS.has(f.carcCode)) {
        items.push({ ...base, kind: 'denial', action: 'correct_resubmit', needsIcn: true })
      } else {
        items.push({ ...base, kind: 'denial', action: 'appeal', needsIcn: true })
      }
    } else if (f.type === 'underpayment') {
      items.push({ ...base, kind: 'underpayment', action: 'appeal', needsIcn: true })
    } else if (f.type === 'undercoding') {
      items.push({ ...base, kind: 'undercoding', action: 'correct_resubmit', needsIcn: true })
    } else if (f.type === 'unadjudicated') {
      items.push({ ...base, kind: 'unadjudicated', action: 'follow_up', needsIcn: false })
    }
  }

  // Highest recoverable dollars first — the work queue order.
  return items.sort((a, b) => b.recoverableCents - a.recoverableCents)
}
