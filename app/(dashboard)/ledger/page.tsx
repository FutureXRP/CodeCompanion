import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { sampleLedger } from '@/lib/ledger/sample'
import { buildStatement } from '@/lib/ledger'
import type { AccountStanding } from '@/lib/ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STANDING: Record<AccountStanding, { label: string; variant: 'green' | 'amber' | 'blue' | 'purple' }> = {
  awaiting_payer: { label: 'awaiting payer', variant: 'blue' },
  patient_owes: { label: 'patient owes', variant: 'amber' },
  settled: { label: 'settled', variant: 'green' },
  credit: { label: 'credit', variant: 'purple' },
}

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa3b2',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #e4e8ef',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#333d4d', padding: '11px 12px', borderBottom: '1px solid #f1f3f7', verticalAlign: 'top',
}
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function LedgerPage() {
  const ledger = sampleLedger()
  const { accounts, totals } = ledger
  const statementAccount = accounts.find((a) => a.balance.patientArCents > 0)
  const statement = statementAccount ? buildStatement(statementAccount) : null

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Patient Balances</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          The patient ledger — CodeCompanion&apos;s financial system of record. When the EHR is clinical-only, the balance lives
          here: charges open the account, the 835 pays it down and moves the patient&apos;s share to their tab, and patient
          payments draw it to zero. Every figure is a sum of ledger entries — deterministic, no AI.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '18px 0 22px' }}>
        <StatCard label="Total outstanding" value={formatCents(totals.totalBalanceCents)} delta={`${accounts.length} accounts`} accent={totals.totalBalanceCents > 0 ? 'warning' : 'default'} />
        <StatCard label="Awaiting payer" value={formatCents(totals.insuranceArCents)} delta="insurance A/R" />
        <StatCard label="Patient responsibility" value={formatCents(totals.patientArCents)} delta={`${formatCents(totals.patientPaidCents)} collected`} accent={totals.patientArCents > 0 ? 'warning' : 'default'} />
        <StatCard label="Contractual write-offs" value={formatCents(totals.contractualAdjCents)} delta="not billable" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2533' }}>Accounts</span>
          <span style={{ fontSize: 12, color: '#9aa3b2' }}>posted from 837 charges + 835 remittances · synthetic data</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Patient</th>
              <th style={th}>Payer</th>
              <th style={{ ...th, ...num }}>Charged</th>
              <th style={{ ...th, ...num }}>Ins. paid</th>
              <th style={{ ...th, ...num }}>Adjusted</th>
              <th style={{ ...th, ...num }}>Patient resp</th>
              <th style={{ ...th, ...num }}>Balance</th>
              <th style={th}>Standing</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const adjusted = a.balance.contractualAdjCents + a.balance.otherAdjCents
              const patientNet = a.balance.patientArCents
              return (
                <tr key={a.accountKey}>
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: '#1e2533' }}>{a.patientName ?? a.accountKey}</div>
                    <div style={{ fontSize: 11.5, color: '#9aa3b2', fontFamily: 'DM Mono, monospace' }}>{a.accountKey}</div>
                  </td>
                  <td style={{ ...td, color: '#6b7280' }}>{a.payerName ?? '—'}</td>
                  <td style={{ ...td, ...num }}>{formatCents(a.balance.chargedCents)}</td>
                  <td style={{ ...td, ...num, color: a.balance.insurancePaidCents > 0 ? '#1a7a45' : '#9aa3b2' }}>{formatCents(a.balance.insurancePaidCents)}</td>
                  <td style={{ ...td, ...num, color: '#9aa3b2' }}>{formatCents(adjusted)}</td>
                  <td style={{ ...td, ...num }}>{patientNet > 0 ? formatCents(patientNet) : '—'}</td>
                  <td style={{ ...td, ...num, fontWeight: 600, color: a.balance.totalBalanceCents > 0 ? '#b45309' : '#1a7a45' }}>{formatCents(a.balance.totalBalanceCents)}</td>
                  <td style={td}><Badge label={STANDING[a.standing].label} variant={STANDING[a.standing].variant} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {statement && (
        <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2533' }}>
              Patient statement · {statement.patientName ?? statement.accountKey}
            </span>
            <span style={{ fontSize: 12, color: '#9aa3b2' }}>the bill (not an EOB — the payer mails that)</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Service</th>
                <th style={{ ...th, ...num }}>Charge</th>
                <th style={{ ...th, ...num }}>Insurance paid</th>
                <th style={{ ...th, ...num }}>Plan adjustment</th>
                <th style={{ ...th, ...num }}>Your responsibility</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: '#6b7280' }}>{l.dateOfService ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{l.cptHcpcs}</td>
                  <td style={{ ...td, ...num }}>{formatCents(l.chargedCents)}</td>
                  <td style={{ ...td, ...num, color: '#1a7a45' }}>{formatCents(l.insurancePaidCents)}</td>
                  <td style={{ ...td, ...num, color: '#9aa3b2' }}>{formatCents(l.adjustedCents)}</td>
                  <td style={{ ...td, ...num }}>{formatCents(l.patientRespCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fbfcfe', borderTop: '1px solid #f1f3f7' }}>
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>
              Already paid {formatCents(statementAccount!.balance.patientPaidCents)} of {formatCents(statementAccount!.balance.patientRespCents)} responsibility.
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#16213a' }}>
              Amount due&nbsp;<span style={{ color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>{formatCents(statement.amountDueCents)}</span>
            </span>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: '#9aa3b2', marginTop: 16, lineHeight: 1.55 }}>
        Synthetic data. The ledger is append-only and the math is deterministic — the patient-responsibility split comes
        straight from the 835&apos;s PR adjustments, not a guess. Denials and appealable shortfalls are tracked separately in
        <strong> Found Money</strong>; a denied line shows a $0 balance here (nothing currently collectable) while the recovery
        worklist chases it. Statement delivery (print-and-mail or electronic) is a downstream vendor step.
      </p>
    </div>
  )
}
