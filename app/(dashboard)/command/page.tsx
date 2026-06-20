import Link from 'next/link'
import { formatCents } from '@/lib/canonical'
import { buildCommandCenter, type CycleStage, type StageTone } from '@/lib/rcm/command-center'
import { WORK_ACTION_LABEL, type WorkItemKind } from '@/lib/rcm/worklist'
import type { AccountStanding } from '@/lib/ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INK = '#1f2d27'
const SUB = '#65726b'
const FAINT = '#9aa69f'
const LINE = '#ece7dd'
const BLUE = '#3f7d6a' // sage primary
const HERO_GRADIENT = 'linear-gradient(140deg, #34685a 0%, #3f7d6a 60%, #57997f 100%)'

const TONE: Record<StageTone, string> = { neutral: INK, good: '#2f8a5b', warn: '#b8862a', bad: '#cf5547' }
const TONE_BG: Record<StageTone, string> = { neutral: '#e7f0eb', good: '#e6f4ec', warn: '#f6efdd', bad: '#fae9e6' }

const KIND_TONE: Record<WorkItemKind, StageTone> = {
  rejection: 'bad', denial: 'bad', underpayment: 'warn', undercoding: 'warn', unadjudicated: 'neutral',
}
const STANDING_LABEL: Record<AccountStanding, string> = {
  awaiting_payer: 'Awaiting payer', patient_owes: 'Patient owes', settled: 'Settled', credit: 'Credit',
}

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }

function SectionLabel({ children, meta }: { children: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</span>
      <div style={{ height: 1, flex: 1, background: LINE }} />
      {meta && <span style={{ fontSize: 11.5, color: FAINT }}>{meta}</span>}
    </div>
  )
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="pc-card" style={{ ...card, padding: '15px 17px' }}>
      <p style={{ fontSize: 11, color: FAINT, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? INK, margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: SUB, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function StageCard({ stage, step }: { stage: CycleStage; step: number }) {
  const c = TONE[stage.tone]
  return (
    <Link href={stage.href} style={{ textDecoration: 'none' }}>
      <div className="pc-card" style={{ ...card, padding: '13px 15px', height: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: FAINT }}>{String(step).padStart(2, '0')}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c, background: TONE_BG[stage.tone], padding: '2px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{stage.count}</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.25 }}>{stage.label}</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: c, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {stage.amountCents != null ? formatCents(stage.amountCents) : stage.count}
          <span style={{ fontSize: 10.5, fontWeight: 500, color: FAINT, marginLeft: 5 }}>{stage.amountLabel}</span>
        </p>
        <p style={{ fontSize: 11, color: SUB, margin: '2px 0 0', lineHeight: 1.4 }}>{stage.hint}</p>
      </div>
    </Link>
  )
}

export default function CommandCenterPage() {
  const cc = buildCommandCenter()
  const k = cc.kpis

  return (
    <div style={{ padding: '34px 40px 48px', maxWidth: 1180, margin: '0 auto' }}>
      <style>{`
        .pc-card { transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .pc-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15,21,32,.08); border-color: #ddd6c8; }
        .pc-row { transition: background .12s ease; }
        .pc-row:hover { background: #faf7f1; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 26 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: 0, letterSpacing: '-0.03em' }}>Command Center</h1>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#2f8a5b', background: '#e6f4ec', padding: '3px 10px', borderRadius: 999 }}>Synthetic clinic day</span>
          </div>
          <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
            {cc.asOf}&nbsp;&nbsp;·&nbsp;&nbsp;{cc.counts.patients} patients&nbsp;&nbsp;·&nbsp;&nbsp;{cc.counts.denials} denials&nbsp;&nbsp;·&nbsp;&nbsp;
            {cc.counts.scrubFails === 0 ? 'scrub clean' : `${cc.counts.scrubFails} scrub flags`}
          </p>
        </div>
        <div style={{ background: HERO_GRADIENT, color: '#fff', borderRadius: 18, padding: '16px 22px', textAlign: 'right', minWidth: 264, boxShadow: '0 14px 32px rgba(63,125,106,.28)' }}>
          <p style={{ fontSize: 11, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, opacity: 0.78 }}>Capture opportunity</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatCents(k.captureOpportunityCents)}</p>
          <p style={{ fontSize: 12, opacity: 0.88, margin: '3px 0 0' }}>{formatCents(k.recoverableCents)} recoverable&nbsp;·&nbsp;{formatCents(k.patientArCents)} to collect</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 30 }}>
        <Kpi label="Billed today" value={formatCents(k.billedCents)} sub={`${cc.counts.claims} claims`} />
        <Kpi label="Collected" value={formatCents(k.collectedCents)} accent="#2f8a5b" sub="insurance posted" />
        <Kpi label="Insurance A/R" value={formatCents(k.insuranceArCents)} sub="awaiting payer" />
        <Kpi label="Patient A/R" value={formatCents(k.patientArCents)} accent="#b8862a" sub="to collect" />
        <Kpi label="Recoverable" value={formatCents(k.recoverableCents)} accent="#b8862a" sub={`clean claims ${Math.round(k.cleanClaimRate * 100)}%`} />
      </div>

      {/* The revenue cycle */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel meta="click any stage to work it">The revenue cycle</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {cc.stages.map((s, i) => <StageCard key={s.key} stage={s} step={i + 1} />)}
        </div>
      </div>

      {/* Worklist + balances */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Today&apos;s worklist</span>
            <span style={{ fontSize: 11.5, color: FAINT }}>highest recoverable first</span>
          </div>
          <div>
            {cc.worklist.length === 0 && <div style={{ padding: '18px', fontSize: 13, color: SUB }}>Nothing to work — every claim is clean and paid.</div>}
            {cc.worklist.map((w, i) => {
              const t = TONE[KIND_TONE[w.kind]]
              return (
                <Link key={`${w.claimControlNumber}-${i}`} href="/claims" style={{ textDecoration: 'none' }}>
                  <div className="pc-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < cc.worklist.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{w.patientName ?? w.claimControlNumber}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: t, background: TONE_BG[KIND_TONE[w.kind]], padding: '1px 7px', borderRadius: 999 }}>{WORK_ACTION_LABEL[w.action]}</span>
                      </div>
                      <p style={{ fontSize: 12, color: SUB, margin: 0, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.payerName}{w.cptHcpcs ? ` · ${w.cptHcpcs}` : ''}{w.carcCode ? ` · CARC ${w.carcCode}` : ''} — {w.reason}
                      </p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: w.recoverableCents > 0 ? '#2f8a5b' : FAINT, minWidth: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {w.recoverableCents > 0 ? formatCents(w.recoverableCents) : '—'}
                    </span>
                  </div>
                </Link>
              )
            })}
            <div style={{ padding: '11px 18px' }}>
              <Link href="/claims" style={{ fontSize: 12.5, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Open the full worklist →</Link>
            </div>
          </div>
        </div>

        <div className="pc-card" style={card}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Patient balances</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#b8862a' }}>{formatCents(k.patientArCents)}</span>
          </div>
          <div>
            {cc.balances.length === 0 && <div style={{ padding: '18px', fontSize: 13, color: SUB }}>No patient balances outstanding.</div>}
            {cc.balances.map((b, i) => (
              <Link key={b.accountKey} href="/ledger" style={{ textDecoration: 'none' }}>
                <div className="pc-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < cc.balances.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.patientName ?? b.accountKey}</p>
                    <p style={{ fontSize: 11.5, color: SUB, margin: 0 }}>{b.payerName ?? STANDING_LABEL[b.standing]}</p>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#b8862a', fontVariantNumeric: 'tabular-nums' }}>{formatCents(b.patientArCents)}</span>
                </div>
              </Link>
            ))}
            <div style={{ padding: '11px 18px' }}>
              <Link href="/ledger" style={{ fontSize: 12.5, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Send statements →</Link>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: FAINT, marginTop: 22, lineHeight: 1.5 }}>
        Live figures from the deterministic engine over the synthetic clinic day (pull → scrub → submit → adjudicate → diff → worklist → ledger).
        No real PHI; every dollar is reproducible. The same view is fed by real adapters once the COMPLIANCE.md gate is closed.
      </p>
    </div>
  )
}
