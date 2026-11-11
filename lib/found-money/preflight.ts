import type { Claim, FeeScheduleLine, Remittance } from '../canonical'
import { formatCents } from '../canonical'
import { FeeSchedule } from '../adapters/fee-schedule'

/**
 * Preflight for the file path (837 + 835 + fee schedule): before anyone reads a
 * dollar figure, say whether the three files actually line up — do the
 * remittances join to the claims, do the contract rates cover the lines, do the
 * payer ids agree across the three sources. The #1 reason a first run "finds
 * nothing" is a fee schedule keyed by a payer name while the 837 carries the
 * payer's EDI id. DETERMINISTIC; prints counts and codes, never a patient.
 */

export type PreflightStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface PreflightCheck {
  id: string
  label: string
  status: PreflightStatus
  detail: string
}

export interface PayerAlignment {
  payerId: string
  name: string
  claims: number
  remittances: number
  rates: number
}

export interface PreflightStats {
  claims: number
  claimLines: number
  remittances: number
  remitLines: number
  /** Claims whose control number appears in a remittance. */
  joinedClaims: number
  joinRate: number
  /** Remittance lines that matched a claim line (CPT + modifiers). */
  matchedRemitLines: number
  lineMatchRate: number
  /** Claim lines with a contract rate on file. */
  ratedLines: number
  rateCoverage: number
  billedCents: number
  paidCents: number
  dosFrom?: string
  dosTo?: string
  payers: PayerAlignment[]
}

export interface PreflightReport {
  checks: PreflightCheck[]
  stats: PreflightStats
  /** No fails — the diff will produce meaningful numbers. */
  ok: boolean
  /** No fails and no warns. */
  clean: boolean
}

const ratio = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 10000)
const pct = (r: number) => `${Math.round(r * 1000) / 10}%`
const lineKey = (cpt: string, modifiers: string[]) => `${cpt}|${modifiers.slice().sort().join(',')}`

export function preflightFoundMoney(claims: Claim[], remittances: Remittance[], feeLines: FeeScheduleLine[]): PreflightReport {
  const checks: PreflightCheck[] = []
  const add = (id: string, label: string, status: PreflightStatus, detail: string) => checks.push({ id, label, status, detail })
  const fs = new FeeSchedule(feeLines)

  // ── Counts and the join ──
  const claimLines = claims.reduce((s, c) => s + c.lines.length, 0)
  const remitLines = remittances.reduce((s, r) => s + r.lines.length, 0)
  const remitByClaim = new Map<string, Remittance>()
  for (const r of remittances) remitByClaim.set(r.claimControlNumber, r)
  const joinedClaims = claims.filter((c) => remitByClaim.has(c.controlNumber)).length
  const joinRate = ratio(joinedClaims, claims.length)

  let matchedRemitLines = 0
  for (const r of remittances) {
    const claim = claims.find((c) => c.controlNumber === r.claimControlNumber)
    if (!claim) continue
    const keys = new Set(claim.lines.map((l) => lineKey(l.cptHcpcs, l.modifiers)))
    matchedRemitLines += r.lines.filter((l) => keys.has(lineKey(l.cptHcpcs, l.modifiers))).length
  }
  const lineMatchRate = ratio(matchedRemitLines, remitLines)

  let ratedLines = 0
  for (const c of claims) for (const l of c.lines) if (fs.rate(c.payer.externalId, l.cptHcpcs, l.modifiers[0]) !== undefined) ratedLines++
  const rateCoverage = ratio(ratedLines, claimLines)

  const billedCents = claims.reduce((s, c) => s + c.totalBilledCents, 0)
  const paidCents = remittances.reduce((s, r) => s + r.totalPaidCents, 0)
  const dos = claims.map((c) => c.dateOfService).filter((d): d is string => Boolean(d)).sort()

  // ── Payer alignment across the three files ──
  const payers = new Map<string, PayerAlignment>()
  const touch = (id: string, name: string) => {
    const p = payers.get(id) ?? { payerId: id, name, claims: 0, remittances: 0, rates: 0 }
    if (!p.name && name) p.name = name
    payers.set(id, p)
    return p
  }
  for (const c of claims) touch(c.payer.externalId || '(blank)', c.payer.name).claims++
  for (const r of remittances) touch(r.payer.externalId || '(blank)', r.payer.name).remittances++
  for (const f of feeLines) touch(f.payerExternalId || '(blank)', '').rates++
  const alignment = [...payers.values()].sort((a, b) => b.claims - a.claims || a.payerId.localeCompare(b.payerId))

  const stats: PreflightStats = {
    claims: claims.length, claimLines, remittances: remittances.length, remitLines, joinedClaims, joinRate, matchedRemitLines, lineMatchRate,
    ratedLines, rateCoverage, billedCents, paidCents, dosFrom: dos[0], dosTo: dos[dos.length - 1], payers: alignment,
  }

  // ── The checks ──
  add('claims', '837 — claims parsed', claims.length > 0 ? 'pass' : 'fail', claims.length > 0 ? `${claims.length} claims, ${claimLines} service lines, ${formatCents(billedCents)} billed${dos.length ? `, service dates ${dos[0]} → ${dos[dos.length - 1]}` : ''}.` : 'No claims parsed — is this an 837 file (ISA…ST*837)? A claims report from the EHR is not an 837; export the claim files from the clearinghouse or billing company.')
  if (claims.length === 0) return finish(checks, stats)

  const dupes = claims.length - new Set(claims.map((c) => c.controlNumber)).size
  if (dupes > 0) add('duplicates', 'Duplicate claim control numbers', 'warn', `${dupes} claims share a control number with another — corrected / resubmitted claims; the diff keeps the last one per number.`)

  add('remittances', '835 — remittances parsed', remittances.length > 0 ? 'pass' : 'warn', remittances.length > 0 ? `${remittances.length} remittances, ${remitLines} lines, ${formatCents(paidCents)} paid.` : 'No remittances parsed — every claim will show as unanswered. Is this an 835 (ST*835)? Payer portals often give a PDF EOB; the 835 is the ERA file from the clearinghouse.')

  if (remittances.length > 0) {
    add(
      'join',
      'Remittances join to claims (control number)',
      joinRate >= 0.5 ? 'pass' : joinRate > 0 ? 'warn' : 'fail',
      `${joinedClaims}/${claims.length} claims (${pct(joinRate)}) have a remittance.` +
        (joinRate < 0.5 ? ' The 835 CLP01 must equal the 837 claim id (CLM01). If the remittances cover a different date range than the claims, pull both for the same months; if the numbers are formatted differently (prefix / suffix), the files came from different systems.' : ''),
    )
    if (remitLines > 0) {
      add('line_join', 'Remittance lines match claim lines (CPT + modifiers)', lineMatchRate >= 0.8 ? 'pass' : lineMatchRate > 0 ? 'warn' : 'fail', `${matchedRemitLines}/${remitLines} remittance lines (${pct(lineMatchRate)}) match a billed line.${lineMatchRate < 0.8 ? ' Modifiers must match exactly; a 99213-25 on the claim and 99213 on the remit will not pair.' : ''}`)
    }
    if (paidCents > billedCents) add('money', 'Paid exceeds billed', 'warn', `${formatCents(paidCents)} paid against ${formatCents(billedCents)} billed — the 835 covers more claims than the 837; pull the 837s for the same period.`)
  }

  add(
    'rates',
    'Fee schedule — contract rates loaded',
    feeLines.length > 0 ? 'pass' : 'warn',
    feeLines.length > 0 ? `${feeLines.length} rates for ${feeLines.length ? new Set(feeLines.map((f) => f.payerExternalId)).size : 0} payer id(s).` : 'No contract rates — denials and unanswered claims still surface; underpayments cannot (the diff needs the contracted amount). Format: payer_id,cpt_hcpcs,modifier,contracted_rate.',
  )
  if (feeLines.length > 0) {
    add('rate_coverage', 'Claim lines with a contract rate', rateCoverage >= 0.8 ? 'pass' : rateCoverage > 0 ? 'warn' : 'fail', `${ratedLines}/${claimLines} lines (${pct(rateCoverage)}) have a rate for their payer + code.${rateCoverage < 0.8 ? ' Lines without a rate can still be flagged as denied or unanswered, never as underpaid.' : ''}`)
    const orphanRates = alignment.filter((p) => p.rates > 0 && p.claims === 0)
    const unratedPayers = alignment.filter((p) => p.claims > 0 && p.rates === 0)
    if (orphanRates.length > 0 || unratedPayers.length > 0) {
      add(
        'payer_alignment',
        'Payer ids agree across the files',
        rateCoverage === 0 ? 'fail' : 'warn',
        [
          orphanRates.length ? `Fee-schedule payer id(s) that match no claim: ${orphanRates.map((p) => p.payerId).join(', ')}.` : '',
          unratedPayers.length ? `Claim payer id(s) with no rates: ${unratedPayers.map((p) => `${p.payerId}${p.name ? ` (${p.name})` : ''}`).join(', ')}.` : '',
          'The fee schedule must use the payer id as it appears in the 837 (e.g. 04312), not a name — rename the payer_id column values to match.',
        ].filter(Boolean).join(' '),
      )
    } else {
      add('payer_alignment', 'Payer ids agree across the files', 'pass', `${alignment.filter((p) => p.claims > 0).length} payer id(s) in the claims, all with rates on file.`)
    }
  }

  add('payers', 'Payers seen', 'info', alignment.map((p) => `${p.payerId}${p.name ? ` ${p.name}` : ''}: ${p.claims} claims / ${p.remittances} remits / ${p.rates} rates`).join(' · '))

  return finish(checks, stats)
}

function finish(checks: PreflightCheck[], stats: PreflightStats): PreflightReport {
  const ok = !checks.some((c) => c.status === 'fail')
  return { checks, stats, ok, clean: ok && !checks.some((c) => c.status === 'warn') }
}
