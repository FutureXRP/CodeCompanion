import type { Claim, ClaimLine, Payer } from '../../canonical'
import { dollarsToCents } from '../../canonical'
import { parseX12, components, el, ccyymmdd, idAfterQualifier, type RawSegment } from './x12'

/**
 * Map an X12 837 (professional claim) document into canonical Claims.
 *
 * Synthetic sample files are simplified (one subscriber loop, multiple CLMs);
 * the mapper keys off CLM/SV1/HI/DTP and tracks the most recent payer and
 * rendering provider, which is sufficient for the canonical model.
 */
export function parse837(raw: string): Claim[] {
  const claims: Claim[] = []

  for (const txn of parseX12(raw)) {
    if (txn.type !== '837') continue

    let payer: Payer = { externalId: '', name: '' }
    let providerNpi: string | undefined
    let current: Claim | null = null
    let lineNumber = 0

    const push = () => {
      if (current) claims.push(current)
      current = null
    }

    for (const seg of txn.segments) {
      switch (seg.tag) {
        case 'NM1': {
          const entity = el(seg.elements, 0)
          if (entity === 'PR') {
            payer = {
              name: el(seg.elements, 2),
              externalId: idAfterQualifier(seg.elements, ['PI', 'XX']) ?? '',
            }
          } else if (entity === '82' || entity === '85') {
            // Rendering (82) preferred over billing (85) provider NPI.
            const npi = idAfterQualifier(seg.elements, ['XX'])
            if (entity === '82' || !providerNpi) providerNpi = npi
          }
          break
        }
        case 'CLM': {
          push()
          lineNumber = 0
          current = {
            controlNumber: el(seg.elements, 0),
            payer,
            providerNpi,
            diagnoses: [],
            placeOfService: components(el(seg.elements, 4))[0] || undefined,
            totalBilledCents: dollarsToCents(el(seg.elements, 1)),
            sourceAdapter: 'edi',
            lines: [],
          }
          break
        }
        case 'HI': {
          if (!current) break
          for (const value of seg.elements) {
            const parts = components(value)
            if (parts.length >= 2 && parts[1]) current.diagnoses.push(parts[1])
          }
          break
        }
        case 'LX': {
          lineNumber = Number(el(seg.elements, 0)) || lineNumber + 1
          break
        }
        case 'SV1': {
          if (!current) break
          const proc = components(el(seg.elements, 0))
          const pointers = components(el(seg.elements, 6))
            .map((p) => Number(p))
            .filter((n) => Number.isFinite(n) && n > 0)
          const line: ClaimLine = {
            id: `${current.controlNumber}:${lineNumber}`,
            lineNumber,
            cptHcpcs: proc[1] ?? '',
            modifiers: proc.slice(2).filter(Boolean),
            units: Number(el(seg.elements, 3)) || 1,
            diagnosisPointers: pointers,
            billedCents: dollarsToCents(el(seg.elements, 1)),
          }
          current.lines.push(line)
          break
        }
        case 'DTP': {
          // 472 = date of service.
          if (current && !current.dateOfService && el(seg.elements, 0) === '472') {
            current.dateOfService = ccyymmdd(el(seg.elements, 2))
          }
          break
        }
        default:
          break
      }
    }
    push()
  }

  return claims
}

export type { RawSegment }
