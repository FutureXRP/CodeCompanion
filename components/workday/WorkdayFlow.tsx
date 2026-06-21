'use client'
import { useMemo, useState } from 'react'
import type { Finding } from '@/lib/canonical'
import type { FoundMoneyTotals } from '@/lib/found-money/run'
import type { AppealDraft } from '@/lib/ai/appeal'
import type { SweepResponse, SweepRow } from '@/app/api/eligibility/sweep/route'

/**
 * Workday — a guided, stateful stepper that works a whole synthetic clinic day end
 * to end. The server (workday/page.tsx) does all the heavy compute and hands the
 * day's spine in as props; this component only holds interaction state (which step
 * is open, which suggestions are applied, which denials are drafted/worked) and
 * makes two live calls: the eligibility sweep and the AI appeal draft.
 *
 * Every dollar shown is engine output passed from the server. The only figures the
 * client derives are running tallies of those same engine cents (applied-coding
 * total, in-appeal total) — never an invented amount.
 */

// ── Shared palette (matches EncounterSandbox / TestConsole) ───────────────────
const INK = '#1f2d27'
const SUB = '#5a6b62'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const HAIR = '#f0ece3'
const GREEN = '#2f8a5b'
const AMBER = '#b8862a'
const RED = '#cf5547'
const BTN = 'linear-gradient(135deg, #57997f 0%, #34685a 100%)'
const BTN_DISABLED = '#9bb3a8'

const fmt = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n?: number) => (n == null ? '—' : Math.round(n * 100) + '%')

// ── Prop shapes (computed on the server) ──────────────────────────────────────
export interface DayPatient {
  controlNumber: string
  patientName: string
  payerName: string
  dateOfService?: string
  cptCodes: string[]
  billedCents: number
  hasRemittance: boolean
  findingCount: number
}

export interface DayAdjudication {
  controlNumber: string
  patientName: string
  payerName: string
  status: 'paid' | 'denied' | 'awaiting'
  billedCents: number
  insurancePaidCents: number
  patientRespCents: number
}

export interface WorkdayKpis {
  billedToday: number
  expectedCollectible: number
  captureOpportunity: number
  cleanClaimRate: number
  patientAr: number
  recoverable: number
}

export interface WorkdayDayTotals {
  patientsSeen: number
  billedCents: number
  insurancePaidCents: number
  patientArCents: number
  recoverableCents: number
  inAppealCents: number
  appealableDenialCount: number
}

export interface WorkdayData {
  asOf: string
  patients: DayPatient[]
  findings: Finding[]
  totals: FoundMoneyTotals
  adjudication: DayAdjudication[]
  kpis: WorkdayKpis
  dayTotals: WorkdayDayTotals
}

// ── Style atoms ───────────────────────────────────────────────────────────────
const sect: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', marginTop: 14, boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }
const sh: React.CSSProperties = { padding: '12px 16px', borderBottom: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', gap: 10 }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '7px 10px' }
const td: React.CSSProperties = { fontSize: 12.5, color: '#3a4640', padding: '8px 10px', borderTop: `1px solid ${HAIR}`, fontVariantNumeric: 'tabular-nums' }
const mono: React.CSSProperties = { fontFamily: 'DM Mono, monospace' }

function primaryBtn(loading = false, disabled = false): React.CSSProperties {
  const off = loading || disabled
  return { fontSize: 13, fontWeight: 600, color: '#fff', background: off ? BTN_DISABLED : BTN, border: 'none', borderRadius: 9, padding: '10px 18px', cursor: off ? 'default' : 'pointer', boxShadow: off ? 'none' : '0 2px 8px rgba(52,104,90,0.25)' }
}
function ghostBtn(disabled = false): React.CSSProperties {
  return { fontSize: 12.5, fontWeight: 600, color: disabled ? FAINT : '#34685a', background: '#fff', border: `1px solid ${disabled ? LINE : '#cfe2d8'}`, borderRadius: 8, padding: '7px 13px', cursor: disabled ? 'default' : 'pointer' }
}
const errBox: React.CSSProperties = { marginTop: 12, fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 9, padding: '10px 14px' }
const okBox: React.CSSProperties = { background: '#e6f4ec', border: '1px solid #c4e3d2', borderRadius: 9, padding: '12px 14px', color: INK, fontSize: 12.5, lineHeight: 1.6 }

function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
}

function StepHeader({ n, title, badge }: { n: number; title: string; badge?: React.ReactNode }) {
  return (
    <div style={sh}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: '#e7f0eb', color: '#34685a', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{title}</span>
      {badge != null && <span style={{ marginLeft: 'auto' }}>{badge}</span>}
    </div>
  )
}

function MiniCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ background: '#fbfaf7', border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, color: FAINT, margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 700, color: accent ?? INK, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: SUB, margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

const STATUS_STYLE: Record<DayAdjudication['status'], { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: GREEN, bg: '#e6f4ec' },
  denied: { label: 'Denied', color: RED, bg: '#fae9e6' },
  awaiting: { label: 'Awaiting payer', color: AMBER, bg: '#f6efdd' },
}

const STEPS = [
  'Morning huddle',
  'Eligibility sweep',
  'Coding review',
  'Submit & adjudicate',
  'Work the denials',
  'End of day',
] as const

export function WorkdayFlow({ data }: { data: WorkdayData }) {
  // How far the user has advanced (0-based index of the last revealed step).
  const [step, setStep] = useState(0)

  // Step 2 — eligibility sweep.
  const [sweep, setSweep] = useState<SweepResponse | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepErr, setSweepErr] = useState<string | null>(null)

  // Step 3 — applied coding suggestions.
  const undercoding = useMemo(() => data.findings.filter((f) => f.type === 'undercoding'), [data.findings])
  const [appliedCoding, setAppliedCoding] = useState<Set<string>>(new Set())
  const appliedCodingCents = useMemo(
    () => undercoding.filter((f) => appliedCoding.has(f.id)).reduce((s, f) => s + f.recoverableCents, 0),
    [undercoding, appliedCoding],
  )

  // Step 4 — submit & adjudicate (reveal of server-computed results).
  const [adjudicated, setAdjudicated] = useState(false)

  // Step 5 — denials worked.
  const appealableDenials = useMemo(
    () => data.findings.filter((f) => f.type === 'denial' && f.appealable),
    [data.findings],
  )
  const [drafts, setDrafts] = useState<Record<string, AppealDraft>>({})
  const [draftLoading, setDraftLoading] = useState<string | null>(null)
  const [draftErr, setDraftErr] = useState<Record<string, string>>({})
  const [worked, setWorked] = useState<Set<string>>(new Set())

  const reveal = (n: number) => setStep((s) => Math.max(s, n))

  async function runSweep() {
    setSweepLoading(true)
    setSweepErr(null)
    try {
      const res = await fetch('/api/eligibility/sweep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      setSweep(j as SweepResponse)
    } catch (e) {
      setSweepErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSweepLoading(false)
    }
  }

  async function draftAppeal(finding: Finding) {
    setDraftLoading(finding.id)
    setDraftErr((m) => ({ ...m, [finding.id]: '' }))
    try {
      const res = await fetch('/api/appeals/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findingId: finding.id }) })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      setDrafts((m) => ({ ...m, [finding.id]: j as AppealDraft }))
    } catch (e) {
      setDraftErr((m) => ({ ...m, [finding.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setDraftLoading(null)
    }
  }

  const k = data.kpis
  const t = data.dayTotals
  const draftedCount = Object.keys(drafts).length
  const workedCount = worked.size

  // Next-button label / gating per current step.
  const canAdvance = step < STEPS.length - 1
  const nextLabel = `Next — ${STEPS[Math.min(step + 1, STEPS.length - 1)]}`

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0, letterSpacing: '-0.03em' }}>Workday</h1>
            <Pill color={GREEN} bg="#e6f4ec">Synthetic clinic day</Pill>
          </div>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
            {data.asOf}&nbsp;&nbsp;·&nbsp;&nbsp;{data.patients.length} patients&nbsp;&nbsp;·&nbsp;&nbsp;work the day end to end — eligibility, coding, adjudication, appeals.
          </p>
        </div>
      </div>

      {/* Step rail */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
        {STEPS.map((label, i) => {
          const done = i < step
          const cur = i === step
          return (
            <button
              key={label}
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 999,
                border: `1px solid ${cur ? '#34685a' : done ? '#cfe2d8' : LINE}`,
                color: cur ? '#fff' : done ? '#34685a' : FAINT,
                background: cur ? BTN : done ? '#eef5f1' : '#fff',
                cursor: i <= step ? 'pointer' : 'default',
              }}
            >
              {i + 1}. {label}
            </button>
          )
        })}
      </div>

      {/* ── Step 1 — Morning huddle ───────────────────────────────────────── */}
      <div style={sect}>
        <StepHeader n={1} title="Morning huddle — today's schedule" badge={<Pill color={SUB} bg="#f0ece3">{data.patients.length} on the schedule</Pill>} />
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <MiniCard label="Billed today" value={fmt(k.billedToday)} sub="charges built" />
            <MiniCard label="Expected collectible" value={fmt(k.expectedCollectible)} accent={GREEN} sub="insurance" />
            <MiniCard label="Capture opportunity" value={fmt(k.captureOpportunity)} accent={AMBER} sub="recoverable + patient A/R" />
            <MiniCard label="Clean-claim rate" value={pct(k.cleanClaimRate)} sub="first-pass" />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Patient</th>
                <th style={th}>Payer</th>
                <th style={th}>Planned CPT / HCPCS</th>
                <th style={{ ...th, textAlign: 'right' }}>Charges</th>
              </tr>
            </thead>
            <tbody>
              {data.patients.map((p) => (
                <tr key={p.controlNumber}>
                  <td style={td}>
                    <span style={{ fontWeight: 600, color: INK }}>{p.patientName}</span>
                    {p.dateOfService && <span style={{ color: FAINT }}> · {p.dateOfService}</span>}
                  </td>
                  <td style={td}>{p.payerName}</td>
                  <td style={{ ...td, ...mono, fontSize: 12 }}>{p.cptCodes.join(', ') || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(p.billedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Step 2 — Eligibility sweep ────────────────────────────────────── */}
      {step >= 1 && (
        <div style={sect}>
          <StepHeader
            n={2}
            title="Eligibility sweep — verify coverage (270/271)"
            badge={sweep ? <Pill color={GREEN} bg="#e6f4ec">{sweep.provider}{sweep.sandbox ? ' · sandbox' : ''}</Pill> : undefined}
          />
          <div style={{ padding: '14px 16px' }}>
            {!sweep && (
              <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 12px', lineHeight: 1.55 }}>
                Run a real-time 270/271 for every patient on today&apos;s schedule, then estimate what each will owe.
                Uses the Stedi sandbox when configured, otherwise the local mock — synthetic test members, no PHI.
              </p>
            )}
            <button onClick={runSweep} disabled={sweepLoading} style={primaryBtn(sweepLoading)}>
              {sweepLoading ? 'Checking eligibility…' : sweep ? 'Re-run eligibility sweep' : `Run eligibility for ${data.patients.length} patients`}
            </button>
            {sweepErr && <div style={errBox}>{sweepErr}</div>}
            {sweep && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th style={th}>Patient</th>
                      <th style={th}>Payer</th>
                      <th style={th}>Coverage</th>
                      <th style={{ ...th, textAlign: 'right' }}>Copay</th>
                      <th style={{ ...th, textAlign: 'right' }}>Coins.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Deductible left</th>
                      <th style={{ ...th, textAlign: 'right' }}>Est. patient resp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweep.rows.map((r: SweepRow) => (
                      <tr key={r.controlNumber}>
                        <td style={{ ...td, fontWeight: 600, color: INK }}>{r.patientName}</td>
                        <td style={td}>{r.payerName}</td>
                        <td style={td}>
                          <Pill color={r.active ? GREEN : AMBER} bg={r.active ? '#e6f4ec' : '#f6efdd'}>{r.active ? 'active' : r.status}</Pill>
                          {r.errors.length > 0 && <span style={{ color: AMBER, fontSize: 11, marginLeft: 6 }}>{r.errors[0]}</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.copayCents != null ? fmt(r.copayCents) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{pct(r.coinsurancePercent)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.deductibleRemainingCents != null ? fmt(r.deductibleRemainingCents) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: AMBER }}>{fmt(r.estimatedPatientRespCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ ...okBox, marginTop: 12 }}>
                  Estimated patient responsibility for the day:{' '}
                  <strong style={{ color: AMBER }}>{fmt(sweep.totalEstimatedPatientRespCents)}</strong> across {sweep.rows.length} patients.
                  <span style={{ color: SUB }}> Deterministic estimate from the parsed 271 benefits and today&apos;s charges — collect at the front desk.</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3 — Coding review ────────────────────────────────────────── */}
      {step >= 2 && (
        <div style={sect}>
          <StepHeader
            n={3}
            title="Coding review — suggest & apply"
            badge={<Pill color={appliedCodingCents > 0 ? GREEN : SUB} bg={appliedCodingCents > 0 ? '#e6f4ec' : '#f0ece3'}>{fmt(appliedCodingCents)} added</Pill>}
          />
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 12px', lineHeight: 1.55 }}>
              Deterministic undercoding suggestions from the diff — each is documented at a higher level. Apply the ones the chart supports;
              applied codes add to today&apos;s revenue. <span style={{ color: FAINT }}>No AI here — these are engine findings, requiring chart review before re-coding.</span>
            </p>
            {undercoding.length === 0 ? (
              <div style={{ fontSize: 12.5, color: FAINT }}>No undercoding flagged today — charges captured at the documented level.</div>
            ) : (
              undercoding.map((f) => {
                const isApplied = appliedCoding.has(f.id)
                return (
                  <div key={f.id} style={{ border: `1px solid ${isApplied ? '#c4e3d2' : LINE}`, background: isApplied ? '#f3f8f5' : '#fbfaf7', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: INK }}>{f.cptHcpcs}</span>
                        <Pill color={AMBER} bg="#f6efdd">undercoding</Pill>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>+{fmt(f.recoverableCents)}</span>
                      </div>
                      <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.5 }}>{f.reason}</p>
                    </div>
                    <button
                      onClick={() => setAppliedCoding((s) => new Set(s).add(f.id))}
                      disabled={isApplied}
                      style={isApplied ? ghostBtn(true) : primaryBtn(false)}
                    >
                      {isApplied ? '✓ Applied' : 'Apply'}
                    </button>
                  </div>
                )
              })
            )}
            {undercoding.length > 0 && (
              <div style={{ ...okBox, marginTop: 4 }}>
                Added revenue from applied coding: <strong style={{ color: GREEN }}>{fmt(appliedCodingCents)}</strong>
                <span style={{ color: SUB }}> ({appliedCoding.size} of {undercoding.length} suggestions applied)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4 — Submit & adjudicate ──────────────────────────────────── */}
      {step >= 3 && (
        <div style={sect}>
          <StepHeader n={4} title="Submit & adjudicate the day" badge={adjudicated ? <Pill color={GREEN} bg="#e6f4ec">adjudicated</Pill> : undefined} />
          <div style={{ padding: '14px 16px' }}>
            {!adjudicated ? (
              <>
                <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 12px', lineHeight: 1.55 }}>
                  Submit the day&apos;s claims and post the payers&apos; responses (the mock 835 / ERA). <span style={{ color: FAINT }}>No real claim
                  submission — athena runs billing. This is the synthetic adjudication only.</span>
                </p>
                <button onClick={() => setAdjudicated(true)} style={primaryBtn()}>Submit the day → adjudicate</button>
              </>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Patient</th>
                      <th style={th}>Payer</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Billed</th>
                      <th style={{ ...th, textAlign: 'right' }}>Insurance paid</th>
                      <th style={{ ...th, textAlign: 'right' }}>Patient A/R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adjudication.map((a) => {
                      const s = STATUS_STYLE[a.status]
                      return (
                        <tr key={a.controlNumber}>
                          <td style={{ ...td, fontWeight: 600, color: INK }}>{a.patientName}</td>
                          <td style={td}>{a.payerName}</td>
                          <td style={td}><Pill color={s.color} bg={s.bg}>{s.label}</Pill></td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmt(a.billedCents)}</td>
                          <td style={{ ...td, textAlign: 'right', color: a.insurancePaidCents > 0 ? GREEN : FAINT, fontWeight: a.insurancePaidCents > 0 ? 600 : 400 }}>{fmt(a.insurancePaidCents)}</td>
                          <td style={{ ...td, textAlign: 'right', color: a.patientRespCents > 0 ? AMBER : FAINT }}>{fmt(a.patientRespCents)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
                  <MiniCard label="Billed" value={fmt(t.billedCents)} sub={`${t.patientsSeen} claims`} />
                  <MiniCard label="Insurance paid" value={fmt(t.insurancePaidCents)} accent={GREEN} sub="posted" />
                  <MiniCard label="Patient A/R" value={fmt(t.patientArCents)} accent={AMBER} sub="to collect" />
                </div>
                <div style={{ ...okBox, marginTop: 12 }}>
                  Found money this day: <strong style={{ color: GREEN }}>{fmt(t.recoverableCents)}</strong> recoverable —{' '}
                  {data.totals.byType.underpayment.count} underpayment{data.totals.byType.underpayment.count === 1 ? '' : 's'},{' '}
                  {data.totals.appealableDenialCount} appealable denial{data.totals.appealableDenialCount === 1 ? '' : 's'},{' '}
                  {data.totals.byType.undercoding.count} undercoding,{' '}
                  {data.totals.byType.unadjudicated.count} unadjudicated.
                  <span style={{ color: SUB }}> The rest of the billing industry leaves this on the table.</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 5 — Work the denials ─────────────────────────────────────── */}
      {step >= 4 && (
        <div style={sect}>
          <StepHeader
            n={5}
            title="Work the denials — draft appeals with AI"
            badge={<Pill color={SUB} bg="#f0ece3">{draftedCount} drafted · {workedCount} worked</Pill>}
          />
          <div style={{ padding: '14px 16px' }}>
            {appealableDenials.length === 0 ? (
              <div style={{ fontSize: 12.5, color: FAINT }}>No appealable denials today — nothing to appeal.</div>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 12px', lineHeight: 1.55 }}>
                  Claude drafts the appeal prose around the engine&apos;s figures — it never invents a dollar amount, and the letter is
                  rejected if it does (it falls back to a deterministic template). Draft, review, then mark as worked.
                </p>
                {appealableDenials.map((f) => {
                  const draft = drafts[f.id]
                  const isWorked = worked.has(f.id)
                  const loading = draftLoading === f.id
                  const err = draftErr[f.id]
                  return (
                    <div key={f.id} style={{ border: `1px solid ${isWorked ? '#c4e3d2' : LINE}`, background: isWorked ? '#f3f8f5' : '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{patientFor(data, f.claimControlNumber)}</span>
                            <span style={{ ...mono, fontSize: 12, color: SUB }}>{f.cptHcpcs}</span>
                            <Pill color={RED} bg="#fae9e6">denial{f.carcCode ? ` · CARC ${f.carcCode}` : ''}</Pill>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>{fmt(f.recoverableCents)}</span>
                            {isWorked && <Pill color={GREEN} bg="#e6f4ec">appealing</Pill>}
                          </div>
                          <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.5 }}>{f.reason}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => draftAppeal(f)} disabled={loading} style={primaryBtn(loading)}>
                            {loading ? 'Drafting…' : draft ? 'Re-draft with AI' : 'Draft appeal with AI'}
                          </button>
                          {draft && (
                            <button onClick={() => setWorked((s) => new Set(s).add(f.id))} disabled={isWorked} style={ghostBtn(isWorked)}>
                              {isWorked ? '✓ Worked' : 'Mark as worked'}
                            </button>
                          )}
                        </div>
                      </div>
                      {err && <div style={errBox}>{err}</div>}
                      {draft && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Pill color={draft.mode === 'llm' ? GREEN : SUB} bg={draft.mode === 'llm' ? '#e6f4ec' : '#f0ece3'}>
                              {draft.mode === 'llm' ? `AI draft${draft.model ? ` · ${draft.model}` : ''}` : 'template'}
                            </Pill>
                            {draft.note && <span style={{ fontSize: 11, color: FAINT }}>{draft.note}</span>}
                          </div>
                          <pre style={{ margin: 0, padding: '12px 14px', fontSize: 11.5, lineHeight: 1.55, color: '#3a4640', background: '#faf8f4', border: `1px solid ${HAIR}`, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'DM Mono, monospace' }}>{draft.letter}</pre>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ ...okBox, marginTop: 4 }}>
                  {draftedCount} appeal{draftedCount === 1 ? '' : 's'} drafted · {workedCount} marked as worked ·{' '}
                  <strong style={{ color: GREEN }}>{fmt(appealableDenials.reduce((s, f) => s + f.recoverableCents, 0))}</strong> in appeal.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 6 — End of day ───────────────────────────────────────────── */}
      {step >= 5 && (
        <div style={{ ...sect, border: '1px solid #c4e3d2' }}>
          <StepHeader n={6} title="End of day — the tally" badge={<Pill color={GREEN} bg="#e6f4ec">day complete</Pill>} />
          <div style={{ padding: '16px' }}>
            <div style={{ background: 'linear-gradient(140deg, #34685a 0%, #3f7d6a 60%, #57997f 100%)', color: '#fff', borderRadius: 14, padding: '18px 22px', marginBottom: 16, boxShadow: '0 14px 32px rgba(63,125,106,.28)' }}>
              <p style={{ fontSize: 11, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, opacity: 0.8 }}>This day&apos;s work produced</p>
              <p style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(t.recoverableCents + appliedCodingCents)}
              </p>
              <p style={{ fontSize: 12.5, opacity: 0.9, margin: '4px 0 0' }}>
                {fmt(t.recoverableCents)} found money + {fmt(appliedCodingCents)} applied coding — on top of {fmt(t.insurancePaidCents)} collected.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <MiniCard label="Patients seen" value={String(t.patientsSeen)} sub="schedule worked" />
              <MiniCard label="Total billed" value={fmt(t.billedCents)} />
              <MiniCard label="Expected collectible" value={fmt(k.expectedCollectible)} accent={GREEN} sub="insurance" />
              <MiniCard label="Patient A/R" value={fmt(t.patientArCents)} accent={AMBER} sub="to collect" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
              <MiniCard label="Found money" value={fmt(t.recoverableCents)} accent={GREEN} sub={`${fmt(t.inAppealCents)} in appeal`} />
              <MiniCard label="Appeals drafted" value={String(draftedCount)} sub={`${workedCount} worked`} />
              <MiniCard label="Coding applied" value={fmt(appliedCodingCents)} accent={GREEN} sub={`${appliedCoding.size} suggestions`} />
              <MiniCard
                label="Est. patient resp."
                value={sweep ? fmt(sweep.totalEstimatedPatientRespCents) : '—'}
                accent={AMBER}
                sub={sweep ? 'from eligibility' : 'run the sweep'}
              />
            </div>
            <p style={{ fontSize: 11.5, color: FAINT, marginTop: 14, lineHeight: 1.5 }}>
              Every figure is deterministic engine output over the synthetic clinic day — reproducible, auditable, no PHI. The AI only
              wrote the appeal prose around the engine&apos;s numbers. The same flow runs on real adapters once the COMPLIANCE.md gate is closed.
            </p>
          </div>
        </div>
      )}

      {/* Advance control */}
      {canAdvance && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button onClick={() => reveal(step + 1)} style={primaryBtn()}>{nextLabel} →</button>
          <span style={{ fontSize: 11.5, color: FAINT }}>Step {step + 1} of {STEPS.length}</span>
        </div>
      )}
    </div>
  )
}

/** Patient display name for a given claim control number (from the schedule). */
function patientFor(data: WorkdayData, controlNumber: string): string {
  return data.patients.find((p) => p.controlNumber === controlNumber)?.patientName ?? controlNumber
}
