import { loadClaims, loadRemittances } from '@/lib/adapters/edi'
import { runFoundMoneyFrom } from '@/lib/found-money/run'
import { loadFeeSchedule } from '@/lib/adapters/fee-schedule'
import { buildCommandCenter } from '@/lib/rcm/command-center'
import { isAppealDraftable } from '@/lib/ai/appeal'
import type { Claim, Remittance, Finding } from '@/lib/canonical'
import { WorkdayFlow, type WorkdayData, type DayPatient, type DayAdjudication } from '@/components/workday/WorkdayFlow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Workday — work an entire synthetic clinic day end to end in one guided flow:
 * morning huddle → eligibility sweep → coding review → submit & adjudicate →
 * work the denials → end-of-day tally.
 *
 * The whole day is anchored to runFoundMoney() (the deterministic diff engine) so
 * the finding ids the client sends to /api/appeals/draft match server-side — the
 * appeals route recomputes findings from the same source and joins by id. Every
 * dollar here is engine output; no figure is invented and no LLM produces a number.
 * 100% synthetic data, no PHI. No real claim submission — the day-submit is the
 * mock 835 adjudication only (athena runs real billing).
 */
export default function WorkdayPage() {
  // Source of truth: the same EDI files the appeals route diffs. Loading the
  // fee schedule + claims + remits here lets us share the remittances (for the
  // adjudication view) without changing runFoundMoney()'s return shape.
  const claims = loadClaims()
  const remittances = loadRemittances()
  const feeSchedule = loadFeeSchedule()
  const report = runFoundMoneyFrom(claims, remittances, feeSchedule, 'samples')

  const command = buildCommandCenter()

  const data: WorkdayData = {
    asOf: command.asOf,
    patients: buildDayPatients(claims, remittances, report.findings),
    findings: report.findings,
    totals: report.totals,
    adjudication: buildAdjudication(claims, remittances),
    kpis: {
      billedToday: command.kpis.billedCents,
      expectedCollectible: command.kpis.collectedCents + command.kpis.insuranceArCents,
      captureOpportunity: command.kpis.captureOpportunityCents,
      cleanClaimRate: command.kpis.cleanClaimRate,
      patientAr: command.kpis.patientArCents,
      recoverable: command.kpis.recoverableCents,
    },
    // The Workday's own claim set (runFoundMoney) rolled up — kept separate from
    // the command-center KPIs so the end-of-day tally is internally consistent.
    dayTotals: buildDayTotals(claims, remittances, report.findings),
  }

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 1080, margin: '0 auto' }}>
      <WorkdayFlow data={data} />
    </div>
  )
}

/** One scheduled patient per distinct claim: who, payer, and the planned codes. */
function buildDayPatients(claims: Claim[], remittances: Remittance[], findings: Finding[]): DayPatient[] {
  const seen = new Set<string>()
  const remitByCn = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const out: DayPatient[] = []
  for (const claim of claims) {
    if (seen.has(claim.controlNumber)) continue
    seen.add(claim.controlNumber)
    out.push({
      controlNumber: claim.controlNumber,
      patientName: claim.subscriber ? titleCase(`${claim.subscriber.firstName} ${claim.subscriber.lastName}`) : claim.controlNumber,
      payerName: claim.payer.name,
      dateOfService: claim.dateOfService,
      cptCodes: claim.lines.map((l) => l.cptHcpcs),
      billedCents: claim.totalBilledCents,
      hasRemittance: remitByCn.has(claim.controlNumber),
      findingCount: findings.filter((f) => f.claimControlNumber === claim.controlNumber).length,
    })
  }
  return out
}

/** Per-claim adjudication outcome from the (mock) 835: paid / denied / awaiting. */
function buildAdjudication(claims: Claim[], remittances: Remittance[]): DayAdjudication[] {
  const remitByCn = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const seen = new Set<string>()
  const out: DayAdjudication[] = []
  for (const claim of claims) {
    if (seen.has(claim.controlNumber)) continue
    seen.add(claim.controlNumber)
    const remit = remitByCn.get(claim.controlNumber)
    const status: DayAdjudication['status'] = !remit
      ? 'awaiting'
      : remit.totalPaidCents > 0
        ? 'paid'
        : 'denied'
    out.push({
      controlNumber: claim.controlNumber,
      patientName: claim.subscriber ? titleCase(`${claim.subscriber.firstName} ${claim.subscriber.lastName}`) : claim.controlNumber,
      payerName: claim.payer.name,
      status,
      billedCents: claim.totalBilledCents,
      insurancePaidCents: remit?.totalPaidCents ?? 0,
      patientRespCents: remit?.patientRespCents ?? 0,
    })
  }
  return out
}

/** Day roll-up off the Workday's own claim set (runFoundMoney spine). */
function buildDayTotals(claims: Claim[], remittances: Remittance[], findings: Finding[]): WorkdayData['dayTotals'] {
  const remitByCn = new Map(remittances.map((r) => [r.claimControlNumber, r]))
  const seen = new Set<string>()
  let billed = 0
  let insurancePaid = 0
  let patientAr = 0
  for (const claim of claims) {
    if (seen.has(claim.controlNumber)) continue
    seen.add(claim.controlNumber)
    billed += claim.totalBilledCents
    const remit = remitByCn.get(claim.controlNumber)
    insurancePaid += remit?.totalPaidCents ?? 0
    patientAr += remit?.patientRespCents ?? 0
  }
  const recoverable = findings.reduce((s, f) => s + f.recoverableCents, 0)
  const appealableDenials = findings.filter((f) => f.type === 'denial' && isAppealDraftable(f))
  const inAppealCents = appealableDenials.reduce((s, f) => s + f.recoverableCents, 0)
  return {
    patientsSeen: seen.size,
    billedCents: billed,
    insurancePaidCents: insurancePaid,
    patientArCents: patientAr,
    recoverableCents: recoverable,
    inAppealCents,
    appealableDenialCount: appealableDenials.length,
  }
}

/** "JOHN DOE" → "John Doe" — the EDI sample carries names upper-cased. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
