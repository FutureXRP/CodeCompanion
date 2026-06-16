import { X12Parser } from 'node-x12'
import type { X12Interchange, X12FatInterchange } from 'node-x12'

/**
 * Low-level X12 access. This module — and the parse-837 / parse-835 siblings
 * beside it — are the ONLY place in the codebase that knows X12 exists.
 *
 * SACRED BOUNDARY (see CLAUDE.md): nothing above lib/adapters/ may import this
 * file or reference an X12 segment tag. Everything else reads the canonical
 * model. We do not hand-roll the X12 grammar; the maintained `node-x12` library
 * tokenizes the envelope and segments, and these adapters map segments ->
 * canonical.
 */

export interface RawSegment {
  /** Segment tag, e.g. "CLM", "SVC", "CAS". */
  tag: string
  /** Element values; elements[0] === element 01 (the tag is not included). */
  elements: string[]
}

export interface RawTransaction {
  /** ST01 transaction set code, e.g. "837" or "835". */
  type: string
  segments: RawSegment[]
}

/** Component (sub-element) delimiter; ":" is the universal X12 default. */
const COMPONENT_DELIMITER = ':'

function toInterchanges(result: X12Interchange | X12FatInterchange): X12Interchange[] {
  if ('interchanges' in result) {
    return (result as X12FatInterchange).interchanges
  }
  return [result as X12Interchange]
}

/**
 * Parse a raw X12 document into a flat, vendor-neutral list of transactions.
 * Lenient by design: extract data even from envelopes with imperfect control
 * numbers — the diff math does not depend on envelope integrity.
 */
export function parseX12(raw: string): RawTransaction[] {
  const parser = new X12Parser(false)
  const result = parser.parse(raw)
  const out: RawTransaction[] = []
  for (const interchange of toInterchanges(result)) {
    for (const group of interchange.functionalGroups) {
      for (const txn of group.transactions) {
        out.push({
          type: txn.header.elements[0]?.value ?? '',
          segments: txn.segments.map((seg) => ({
            tag: seg.tag,
            elements: seg.elements.map((el) => el.value),
          })),
        })
      }
    }
  }
  return out
}

/** Split a composite element value (e.g. "HC:99214") into its components. */
export function components(value: string | undefined): string[] {
  if (!value) return []
  return value.split(COMPONENT_DELIMITER)
}

/** Element accessor that treats missing/short segments as empty strings. */
export function el(elements: string[], index: number): string {
  return elements[index] ?? ''
}

/** Convert an X12 CCYYMMDD date to ISO `YYYY-MM-DD`; pass through otherwise. */
export function ccyymmdd(value: string): string {
  const v = value.trim()
  if (v.length === 8) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  }
  return v
}

/** Find the id following a name-qualifier in an NM1-style element list. */
export function idAfterQualifier(elements: string[], qualifiers: string[]): string | undefined {
  for (let i = 0; i < elements.length - 1; i++) {
    if (qualifiers.includes(elements[i])) {
      return elements[i + 1]
    }
  }
  return undefined
}
