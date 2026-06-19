import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { pullClaims, adjudicate, mockEhrRates, DEFAULT_DATE } from '@/lib/mock-ehr'
import { scrubClaim, OKLAHOMA } from '@/lib/scrub'
import { buildLedger } from '@/lib/ledger'
import { runDiff } from '@/lib/diff'
import { DaySubmitPanel } from '@/components/ehr/DaySubmitPanel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const th: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9aa3b2',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 12px', borderBottom: '1px solid #e4e8ef',
}
const td: React.CSSProperties = {
  fontSize: 13, color: '#333d4d', padding: '10px 12px', borderBottom: '1px solid #f1f3f7', verticalAlign: 'top',
}
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function EhrPage() {
  const claims = pullClaims()
  const rates = mockEhrRates()
  const remits = adjudicate(claims, rates)
  const ledger = buildLedger({ claims, remittances: remits })
  const findings = runDiff(claims, remits, rates)

  const scrubs = new Map(claims.map((c) => [c.controlNumber, scrubClaim(c, OKLAHOMA)]))
  const accountByMember = new Map(ledger.accounts.map((a) => [a.accountKey, a]))
  const warned = [...scrubs.values()].filter((s) => s.ok && s.warningCount > 0).length

  const configured = Boolean(process.env.STEDI_API_KEY)
  const sandbox = process.env.STEDI_SANDBOX !== 'false'
  const claimRows = claims.map((c) => {
    const s = scrubs.get(c.controlNumber)!
    return {
      controlNumber: c.controlNumber,
      patientName: c.subscriber ? `${c.subscriber.firstName} ${c.subscriber.lastName}` : c.controlNumber,
      payerName: c.payer.name,
      payerId: c.payer.externalId,
      cpts: c.lines.map((l) => l.cptHcpcs + (l.modifiers.length ? `-${l.modifiers.join(',')}` : '')).join(' · '),
      scrubOk: s.ok,
      scrubWarnings: s.warningCount,
    }
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1e2533', margin: '0 0 4px', letterSpacing: '-0.02em' }}>EHR Integration</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
          A synthetic clinic-day pulled from a mock EHR as <strong>FHIR R4</strong> and normalized through the <code>fhir</code> adapter —
          the same path a real EHR (Epic, athenahealth, the 2027 CMS mandate) would take. Proof the whole pipeline runs on
          connected, realistic data.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '18px 0 18px' }}>
        <StatCard label="Patients pulled" value={String(claims.length)} delta={`${DEFAULT_DATE} · SquareOne FM`} />
        <StatCard label="Charged" value={formatCents(ledger.totals.chargedCents)} delta={`${formatCents(ledger.totals.insurancePaidCents)} insurance paid`} />
        <StatCard label="Patient balances" value={formatCents(ledger.totals.patientArCents)} delta={`${formatCents(ledger.totals.contractualAdjCents)} written off`} accent={ledger.totals.patientArCents > 0 ? 'warning' : 'default'} />
        <StatCard label="To work" value={String(findings.length)} delta={`${formatCents(findings.reduce((s, f) => s + f.recoverableCents, 0))} recoverable`} accent={findings.length > 0 ? 'warning' : 'default'} />
      </div>

      <div style={{ background: '#f0f5ff', border: '1px solid #d7e3fb', borderRadius: 12, padding: '11px 16px', margin: '0 0 18px', fontSize: 12.5, color: '#33415c', lineHeight: 1.6 }}>
        Pipeline: <strong>FHIR → canonical</strong> ({claims.length}) → <strong>scrub</strong> ({claims.length - warned} clean, {warned} warnings) →
        <strong> 837 submit</strong> → <strong>835 adjudication</strong> → <strong>ledger</strong> ({ledger.accounts.length} accounts) →
        <strong> found-money</strong> ({findings.length}) → <strong>corpus</strong> (suppressed — one day is below the de-id floor).
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2533' }}>Submit to clearinghouse</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: sandbox ? '#1a7a45' : '#c9302c', background: sandbox ? '#e8f6ee' : '#fff5f5', padding: '3px 10px', borderRadius: 999 }}>{sandbox ? 'Stedi Sandbox' : 'Production'}</span>
        </div>
        <div style={{ padding: '16px' }}>
          <DaySubmitPanel claims={claimRows} configured={configured} sandbox={sandbox} />
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f3f7', fontSize: 13, fontWeight: 600, color: '#1e2533' }}>Today&apos;s schedule</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Patient</th>
              <th style={th}>Payer</th>
              <th style={th}>Provider</th>
              <th style={th}>Services</th>
              <th style={th}>Dx</th>
              <th style={{ ...th, ...num }}>Charge</th>
              <th style={th}>Scrub</th>
              <th style={{ ...th, ...num }}>Patient owes</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => {
              const scrub = scrubs.get(c.controlNumber)!
              const status = !scrub.ok ? { label: 'blocked', variant: 'red' as const } : scrub.warningCount > 0 ? { label: 'review', variant: 'amber' as const } : { label: 'clean', variant: 'green' as const }
              const owes = accountByMember.get(c.subscriber?.memberId ?? '')?.balance.patientArCents ?? 0
              const rp = c.renderingProvider
              return (
                <tr key={c.controlNumber}>
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: '#1e2533' }}>{c.subscriber ? `${c.subscriber.firstName} ${c.subscriber.lastName}` : c.controlNumber}</div>
                    <div style={{ fontSize: 11, color: '#9aa3b2', fontFamily: 'DM Mono, monospace' }}>{c.subscriber?.memberId}</div>
                  </td>
                  <td style={{ ...td, color: '#6b7280' }}>{c.payer.name}</td>
                  <td style={{ ...td, color: '#6b7280' }}>{rp ? `${rp.firstName?.[0] ?? ''}. ${rp.lastName ?? ''}` : '—'}</td>
                  <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{c.lines.map((l) => l.cptHcpcs + (l.modifiers.length ? `-${l.modifiers.join(',')}` : '')).join(' · ')}</td>
                  <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: '#6b7280' }}>{c.diagnoses.join(', ')}</td>
                  <td style={{ ...td, ...num }}>{formatCents(c.totalBilledCents)}</td>
                  <td style={td}><Badge label={status.label} variant={status.variant} /></td>
                  <td style={{ ...td, ...num, fontWeight: owes > 0 ? 600 : 400, color: owes > 0 ? '#b45309' : '#9aa3b2' }}>{owes > 0 ? formatCents(owes) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: '#9aa3b2', marginTop: 16, lineHeight: 1.55 }}>
        Synthetic FHIR data — no PHI. The mock EHR (<code>lib/mock-ehr</code>) renders this day as a FHIR bundle and a mock payer
        adjudicates it; swap either for a real FHIR endpoint + clearinghouse behind the same adapters (gated by
        <code> ALLOW_REAL_PHI</code>). To run the full pipeline in the terminal: <code>npm run ehr-day</code>.
      </p>
    </div>
  )
}
