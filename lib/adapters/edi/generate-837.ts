import { JSEDINotation, X12Generator, X12SerializationOptions } from 'node-x12'
import type { Claim } from '../../canonical'

/**
 * X12 837P *generation* — the Rung 1 keystone (Rung 0 only reads 837s; Rung 1
 * creates and submits them). The ONLY place 837 generation lives (adapter
 * boundary). We use the maintained node-x12 generator for envelope mechanics
 * (ISA/GS/ST/SE/GE/IEA + counts + delimiters); we specify the 837P body.
 *
 * Simplified but valid 5010 structure, sufficient to submit and round-trip; a
 * production build fills additional 2010/2300 loops per each payer's companion
 * guide. Callers pass claims that share one payer (one 837 per receiver).
 */

export interface Generate837Options {
  submitterId?: string
  /** ISA13 interchange control number (numeric, padded to 9). */
  controlNumber?: string
  now?: Date
}

function delimiters(): X12SerializationOptions {
  const o = new X12SerializationOptions()
  o.elementDelimiter = '*'
  o.segmentTerminator = '~'
  o.subElementDelimiter = ':'
  o.repetitionDelimiter = '^'
  return o
}

const pad = (s: string, n: number): string => (s + ' '.repeat(n)).slice(0, n)
const amount = (cents: number): string => (cents / 100).toFixed(2)
const d8 = (iso?: string): string => (iso ? iso.replace(/-/g, '') : '')
const isaDate = (d: Date): string => d.toISOString().slice(2, 10).replace(/-/g, '')
const isaTime = (d: Date): string => d.toISOString().slice(11, 16).replace(':', '')
const gsDate = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, '')

export function generate837(claims: Claim[], opts: Generate837Options = {}): string {
  if (claims.length === 0) throw new Error('generate837: no claims to submit')

  const options = delimiters()
  const now = opts.now ?? new Date()
  const ctrl = (opts.controlNumber ?? '1').padStart(9, '0').slice(-9)
  const submitter = (opts.submitterId ?? 'PRACTICE').toUpperCase()
  const payer = claims[0].payer
  const payerId = payer.externalId || 'PAYER'

  const isa = [
    '00', pad('', 10), '00', pad('', 10),
    'ZZ', pad(submitter, 15), 'ZZ', pad(payerId, 15),
    isaDate(now), isaTime(now), '^', '00501', ctrl, '0', 'P', ':',
  ]
  const notation = new JSEDINotation(isa, options)
  const group = notation.addFunctionalGroup([
    'HC', submitter, payerId, gsDate(now), isaTime(now), '1', 'X', '005010X222A1',
  ])
  const st = group.addTransaction(['837', '0001', '005010X222A1'])

  st.addSegment('BHT', ['0019', '00', ctrl, gsDate(now), isaTime(now), 'CH'])
  st.addSegment('NM1', ['41', '2', submitter, '', '', '', '', '46', submitter]) // submitter
  st.addSegment('NM1', ['40', '2', payer.name || 'PAYER', '', '', '', '', '46', payerId]) // receiver
  st.addSegment('HL', ['1', '', '20', '1']) // 2000A billing provider
  st.addSegment('NM1', ['85', '2', submitter, '', '', '', '', 'XX', claims[0].providerNpi ?? ''])

  let hl = 2
  for (const claim of claims) {
    st.addSegment('HL', [String(hl), '1', '22', '0']) // 2000B subscriber
    st.addSegment('SBR', ['P', '18', '', '', '', '', '', '', 'MB'])
    st.addSegment('NM1', ['IL', '1', 'SUBSCRIBER', '', '', '', '', 'MI', 'MEMBERID'])
    st.addSegment('NM1', ['PR', '2', claim.payer.name || 'PAYER', '', '', '', '', 'PI', claim.payer.externalId || 'PAYER'])

    const pos = claim.placeOfService || '11'
    // CLM05-3 is the claim frequency code (1 original, 7 replacement, 8 void).
    const freq = claim.claimFrequencyCode || '1'
    st.addSegment('CLM', [claim.controlNumber, amount(claim.totalBilledCents), '', '', `${pos}:B:${freq}`, 'Y', 'A', 'Y', 'Y'])
    // REF*F8 carries the payer's original claim control number (ICN/DCN) on a
    // replacement or void, so the payer supersedes the right claim on file.
    if (claim.originalClaimRef) st.addSegment('REF', ['F8', claim.originalClaimRef])
    if (claim.diagnoses.length) {
      st.addSegment('HI', claim.diagnoses.map((dx, i) => `${i === 0 ? 'ABK' : 'ABF'}:${dx}`))
    }
    for (const line of claim.lines) {
      st.addSegment('LX', [String(line.lineNumber)])
      const proc = ['HC', line.cptHcpcs, ...line.modifiers].join(':')
      st.addSegment('SV1', [proc, amount(line.billedCents), 'UN', String(line.units), '', '', line.diagnosisPointers.join(':')])
      if (claim.dateOfService) st.addSegment('DTP', ['472', 'D8', d8(claim.dateOfService)])
    }
    hl += 1
  }

  return new X12Generator(notation, options).toString()
}
