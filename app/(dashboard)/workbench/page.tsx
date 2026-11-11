import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { createTebraSource, tebraConfigFromEnv } from '@/lib/adapters/tebra'
import { runTebraFoundMoney, type TebraFoundMoney } from '@/lib/found-money/tebra'
import { WORKBENCH_CATEGORIES, WORKBENCH_LABELS, type WorkbenchCategory } from '@/lib/found-money/workbench'
import { DEFAULT_DATE } from '@/lib/mock-ehr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Posting Workbench — the "claims that need a biller" queue Tebra sells as the
 * workbench half of its ERA bot, derived here from the pull instead: appeals,
 * resubmits, status checks, unbilled secondaries, unsent statements. Read-only
 * and deterministic; posting itself stays in the PM system's auto-posting.
 */

const VARIANT: Record<WorkbenchCategory, 'red' | 'amber' | 'green'> = {
  appeal_denial: 'red',
  appeal_underpayment: 'amber',
  recoupment: 'red',
  resubmit_rejected: 'red',
  status_check: 'amber',
  bill_secondary: 'amber',
  send_statement: 'green',
}

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa69f',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #ece7dd',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#3a4640', padding: '10px 12px', borderBottom: '1px solid #f0ece3', verticalAlign: 'top',
}
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default async function WorkbenchPage() {
  const cfg = tebraConfigFromEnv()
  let result: TebraFoundMoney | null = null
  let error: string | null = null
  try {
    result = await runTebraFoundMoney(createTebraSource(cfg), { serviceDateFrom: DEFAULT_DATE })
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const wb = result?.workbench
  const appeals = wb ? wb.byCategory.appeal_denial.count + wb.byCategory.appeal_underpayment.count : 0
  const appealsCents = wb ? wb.byCategory.appeal_denial.amountCents + wb.byCategory.appeal_underpayment.amountCents : 0
  const chasing = wb ? wb.byCategory.resubmit_rejected.count + wb.byCategory.status_check.count : 0
  const chasingCents = wb ? wb.byCategory.resubmit_rejected.amountCents + wb.byCategory.status_check.amountCents : 0
  const billing = wb ? wb.byCategory.bill_secondary.count + wb.byCategory.send_statement.count : 0
  const billingCents = wb ? wb.byCategory.bill_secondary.amountCents + wb.byCategory.send_statement.amountCents : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Posting Workbench</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
            Every claim line that needs a biller, ranked by the dollars on it — appeals, resubmits, status checks, secondaries never billed,
            statements never sent. Computed from the Tebra pull; your PM system keeps auto-posting the clean ERAs. Nothing here posts.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.useMock ? '#2f8a5b' : '#b8862a', background: cfg.useMock ? '#e6f4ec' : '#f6efdd', padding: '4px 10px', borderRadius: 999, marginTop: 4 }}>
          {cfg.useMock ? 'Tebra · mock · synthetic' : 'Tebra · live'}
        </span>
      </div>

      {error ? (
        <div style={{ padding: '14px 16px', fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, lineHeight: 1.55 }}>
          Workbench unavailable: {error}
        </div>
      ) : wb && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '0 0 18px' }}>
            <StatCard label="At stake" value={formatCents(wb.atStakeCents)} delta={`${wb.items.length} item${wb.items.length === 1 ? '' : 's'} to work`} accent={wb.items.length > 0 ? 'warning' : 'default'} />
            <StatCard label="Appeals" value={String(appeals)} delta={`${formatCents(appealsCents)} recoverable`} accent={appeals > 0 ? 'warning' : 'default'} />
            <StatCard label="Resubmit / status" value={String(chasing)} delta={`${formatCents(chasingCents)} unanswered`} accent={chasing > 0 ? 'warning' : 'default'} />
            <StatCard label="Secondary / patient" value={String(billing)} delta={`${formatCents(billingCents)} never billed`} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 16px' }}>
            {WORKBENCH_CATEGORIES.map((c) => (
              <span key={c} style={{ fontSize: 12, color: wb.byCategory[c].count ? '#1f2d27' : '#9aa69f', background: wb.byCategory[c].count ? '#f3f8f5' : '#faf8f4', border: '1px solid #e7e1d6', borderRadius: 999, padding: '4px 11px' }}>
                {WORKBENCH_LABELS[c]} · {wb.byCategory[c].count}{wb.byCategory[c].count ? ` · ${formatCents(wb.byCategory[c].amountCents)}` : ''}
              </span>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Do this</th>
                  <th style={th}>Patient</th>
                  <th style={th}>Payer</th>
                  <th style={th}>Service</th>
                  <th style={th}>DOS</th>
                  <th style={{ ...th, ...num }}>Age</th>
                  <th style={{ ...th, ...num }}>At stake</th>
                </tr>
              </thead>
              <tbody>
                {wb.items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ ...td, color: '#9aa69f', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...td, maxWidth: 420 }}>
                      <div style={{ marginBottom: 4 }}><Badge label={WORKBENCH_LABELS[item.category]} variant={VARIANT[item.category]} /></div>
                      <div style={{ fontSize: 12.5, color: '#4b5b52', lineHeight: 1.5 }}>{item.action}</div>
                    </td>
                    <td style={{ ...td, fontWeight: 500, color: '#1f2d27' }}>
                      {item.patientName}
                      <div style={{ fontSize: 11, color: '#9aa69f', fontFamily: 'DM Mono, monospace' }}>{item.claimControlNumber}</div>
                    </td>
                    <td style={{ ...td, color: '#6b7280' }}>{item.payerName}</td>
                    <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{item.cptHcpcs}</td>
                    <td style={{ ...td, color: '#6b7280', whiteSpace: 'nowrap' }}>{item.dateOfService ?? '—'}</td>
                    <td style={{ ...td, ...num, color: '#6b7280' }}>{item.daysSince === undefined ? '—' : `${item.daysSince}d`}</td>
                    <td style={{ ...td, ...num, fontWeight: 600, color: '#2f8a5b' }}>{formatCents(item.amountCents)}</td>
                  </tr>
                ))}
                {wb.items.length === 0 && (
                  <tr><td style={{ ...td, color: '#9aa69f' }} colSpan={8}>Nothing needs a biller — every line is paid to contract and billed through.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
            Deterministic: amounts are contract rates, posted balances, or a finding&apos;s recoverable figure — never an estimate. Appeals link to the same
            findings as <a href="/found-money" style={{ color: '#34685a', fontWeight: 600 }}>Found Money</a>; denials are drafted by the appeal writer from there.
            Posting itself (applying ERAs, matching copays) stays in Tebra&apos;s auto-posting — see <code>TEBRA-INTEGRATION.md</code>.
          </p>
        </>
      )}
    </div>
  )
}
