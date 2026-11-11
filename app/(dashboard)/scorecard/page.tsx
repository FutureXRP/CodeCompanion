import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { buildScorecard, type Scorecard, type ScorecardBucket, type ScorecardClaim, type ScorecardFinding } from '@/lib/analytics/scorecard'
import { createTebraSource, tebraConfigFromEnv } from '@/lib/adapters/tebra'
import { runTebraFoundMoney } from '@/lib/found-money/tebra'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService, withTenant } from '@/lib/db/sql'
import { resolveTenantId } from '@/lib/db/tenant'
import { loadScorecardInputs } from '@/lib/db/repository'
import { DEFAULT_DATE } from '@/lib/mock-ehr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scorecard — the revenue cycle in a handful of numbers, from what the sync has
 * stored (or the synthetic Tebra day until it has). The yardstick for the PM
 * switch: the 90 days before vs. the 90 days after.
 */

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa69f',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #ece7dd',
}
const td: React.CSSProperties = { fontSize: 13, color: '#3a4640', padding: '10px 12px', borderBottom: '1px solid #f0ece3' }
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const pct = (r: number) => `${Math.round(r * 1000) / 10}%`

async function storedInputs(): Promise<{ claims: ScorecardClaim[]; findings: ScorecardFinding[] } | null> {
  if (!isNeonConfigured()) return null
  try {
    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return null
    const tenantId = await withService((db) => resolveTenantId(db, user.id))
    if (!tenantId) return null
    const inputs = await withTenant(tenantId, (db) => loadScorecardInputs(db, tenantId))
    return inputs.claims.length > 0 ? inputs : null
  } catch {
    return null
  }
}

async function mockInputs(): Promise<{ claims: ScorecardClaim[]; findings: ScorecardFinding[] }> {
  const cfg = tebraConfigFromEnv()
  const r = await runTebraFoundMoney(createTebraSource({ ...cfg, useMock: true }), { serviceDateFrom: DEFAULT_DATE })
  const paid = new Map(r.remittances.map((x) => [x.claimControlNumber, x.totalPaidCents]))
  const dos = new Map(r.claims.map((c) => [c.controlNumber, c.dateOfService ?? null]))
  return {
    claims: r.claims.map((c) => ({ controlNumber: c.controlNumber, dateOfService: c.dateOfService ?? null, payerName: c.payer.name, billedCents: c.totalBilledCents, paidCents: paid.get(c.controlNumber) ?? 0, adjudicated: paid.has(c.controlNumber) })),
    findings: r.report.findings.map((f) => ({ controlNumber: f.claimControlNumber, dateOfService: dos.get(f.claimControlNumber) ?? null, type: f.type, status: f.status, recoverableCents: f.recoverableCents, appealable: f.appealable })),
  }
}

function BucketTable({ title, keyLabel, rows }: { title: string; keyLabel: string; rows: ScorecardBucket[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0ece3', fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{keyLabel}</th>
            <th style={{ ...th, ...num }}>Claims</th>
            <th style={{ ...th, ...num }}>Billed</th>
            <th style={{ ...th, ...num }}>Paid</th>
            <th style={{ ...th, ...num }}>Collected</th>
            <th style={{ ...th, ...num }}>Denied</th>
            <th style={{ ...th, ...num }}>Unanswered</th>
            <th style={{ ...th, ...num }}>Open recoverable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.key}>
              <td style={{ ...td, fontWeight: 500, color: '#1f2d27' }}>{b.key}</td>
              <td style={{ ...td, ...num }}>{b.claims}</td>
              <td style={{ ...td, ...num }}>{formatCents(b.billedCents)}</td>
              <td style={{ ...td, ...num }}>{formatCents(b.paidCents)}</td>
              <td style={{ ...td, ...num, color: '#6b7280' }}>{b.billedCents ? pct(b.paidCents / b.billedCents) : '—'}</td>
              <td style={{ ...td, ...num, color: b.denials ? '#cf5547' : '#9aa69f' }}>{b.denials}</td>
              <td style={{ ...td, ...num, color: b.unanswered ? '#b8862a' : '#9aa69f' }}>{b.unanswered}</td>
              <td style={{ ...td, ...num, fontWeight: b.openRecoverableCents ? 600 : 400, color: b.openRecoverableCents ? '#2f8a5b' : '#9aa69f' }}>{b.openRecoverableCents ? formatCents(b.openRecoverableCents) : '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td style={{ ...td, color: '#9aa69f' }} colSpan={8}>Nothing stored yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export default async function ScorecardPage() {
  const stored = await storedInputs()
  const inputs = stored ?? (await mockInputs())
  const live = stored !== null
  const s: Scorecard = buildScorecard(inputs.claims, inputs.findings)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Scorecard</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
            The revenue cycle in a handful of numbers from what the sync has stored: billed, paid, how often the payer said no or nothing, and
            what is still recoverable — by payer and by month of service. Compare the 90 days before a switch with the 90 days after.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: live ? '#3f7d6a' : '#2f8a5b', background: live ? '#e7f0eb' : '#e6f4ec', padding: '4px 10px', borderRadius: 999, marginTop: 4 }}>
          {live ? 'From the stored runs' : 'Synthetic · the mock Tebra day'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '0 0 14px' }}>
        <StatCard label="Claims" value={String(s.totals.claims)} delta={`${pct(s.totals.adjudicatedRate)} answered by the payer`} />
        <StatCard label="Billed" value={formatCents(s.totals.billedCents)} delta="as submitted" />
        <StatCard label="Paid" value={formatCents(s.totals.paidCents)} delta={`${pct(s.totals.grossCollectionRate)} gross collection`} />
        <StatCard label="Open recoverable" value={formatCents(s.totals.openRecoverableCents)} delta={`${s.totals.openFindings} open findings`} accent={s.totals.openRecoverableCents > 0 ? 'warning' : 'default'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '0 0 18px' }}>
        <StatCard label="Denial rate" value={pct(s.totals.denialRate)} delta={`${formatCents(s.totals.appealableDenialCents)} appealable`} accent={s.totals.denialRate > 0.05 ? 'warning' : 'default'} />
        <StatCard label="Unanswered" value={pct(s.totals.unansweredRate)} delta="claims with no remittance" accent={s.totals.unansweredRate > 0.1 ? 'warning' : 'default'} />
        <StatCard label="In appeal" value={formatCents(s.totals.appealingCents)} delta="findings marked appealing" />
        <StatCard label="Recovered" value={formatCents(s.totals.recoveredCents)} delta="findings marked recovered" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        <BucketTable title="By payer" keyLabel="Payer" rows={s.byPayer} />
        <BucketTable title="By month of service" keyLabel="Month" rows={s.byMonth} />
      </div>

      <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
        Deterministic (<code>lib/analytics/scorecard.ts</code>): gross collection is paid ÷ billed; denial and unanswered rates count claims with at least
        one such finding; open recoverable is the diff&apos;s figure on findings still open or in appeal. {live ? 'Stored runs need migration 013 for by-month trends.' : 'Once the sync runs against Neon, this page reads the stored runs.'}
      </p>
    </div>
  )
}
