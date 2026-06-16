import type { Adjustment, Payer, Remittance, RemittanceLine } from '../../canonical'
import { dollarsToCents } from '../../canonical'
import { parseX12, components, el } from './x12'

/**
 * Map an X12 835 (remittance advice) document into canonical Remittances.
 *
 * Per-line allowed amount is derived as billed - sum(CO contractual
 * adjustments); per-line patient responsibility as sum(PR adjustments).
 */
export function parse835(raw: string): Remittance[] {
  const remittances: Remittance[] = []

  for (const txn of parseX12(raw)) {
    if (txn.type !== '835') continue

    let payer: Payer = { externalId: '', name: '' }
    let current: Remittance | null = null
    let currentLine: RemittanceLine | null = null

    const finalizeLine = () => {
      if (!currentLine) return
      const co = currentLine.adjustments
        .filter((a) => a.groupCode === 'CO')
        .reduce((sum, a) => sum + a.amountCents, 0)
      const pr = currentLine.adjustments
        .filter((a) => a.groupCode === 'PR')
        .reduce((sum, a) => sum + a.amountCents, 0)
      currentLine.allowedCents = currentLine.billedCents - co
      currentLine.patientRespCents = pr
      currentLine = null
    }

    const push = () => {
      finalizeLine()
      if (current) remittances.push(current)
      current = null
    }

    for (const seg of txn.segments) {
      switch (seg.tag) {
        case 'N1': {
          if (el(seg.elements, 0) === 'PR') {
            payer = {
              name: el(seg.elements, 1),
              externalId: el(seg.elements, 2) === 'PI' ? el(seg.elements, 3) : payer.externalId,
            }
          }
          break
        }
        case 'REF': {
          // 2U = payer identification number.
          if (el(seg.elements, 0) === '2U') {
            payer = { ...payer, externalId: el(seg.elements, 1) }
          }
          break
        }
        case 'CLP': {
          push()
          current = {
            claimControlNumber: el(seg.elements, 0),
            claimStatusCode: el(seg.elements, 1),
            totalBilledCents: dollarsToCents(el(seg.elements, 2)),
            totalPaidCents: dollarsToCents(el(seg.elements, 3)),
            patientRespCents: dollarsToCents(el(seg.elements, 4)),
            payerClaimControlNumber: el(seg.elements, 6),
            payer,
            lines: [],
          }
          break
        }
        case 'SVC': {
          if (!current) break
          finalizeLine()
          const proc = components(el(seg.elements, 0))
          currentLine = {
            cptHcpcs: proc[1] ?? '',
            modifiers: proc.slice(2).filter(Boolean),
            billedCents: dollarsToCents(el(seg.elements, 1)),
            paidCents: dollarsToCents(el(seg.elements, 2)),
            units: Number(el(seg.elements, 4)) || 1,
            allowedCents: 0,
            patientRespCents: 0,
            adjustments: [],
          }
          current.lines.push(currentLine)
          break
        }
        case 'CAS': {
          if (!currentLine) break
          const groupCode = el(seg.elements, 0)
          // CAS carries up to six (reason, amount, quantity) triplets.
          for (let i = 1; i < seg.elements.length; i += 3) {
            const carcCode = el(seg.elements, i)
            const amount = el(seg.elements, i + 1)
            if (!carcCode) continue
            const adj: Adjustment = {
              groupCode,
              carcCode,
              amountCents: dollarsToCents(amount),
            }
            currentLine.adjustments.push(adj)
          }
          break
        }
        default:
          break
      }
    }
    push()
  }

  return remittances
}
