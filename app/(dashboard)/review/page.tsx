import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { formatCents } from '@/lib/canonical'
import { createTebraSource, tebraConfigFromEnv, sampleTebraContractRates, fallbackRatesFromEnv } from '@/lib/adapters/tebra'
import { runTebraPreApproval, type TebraPreApproval, type CaptureSeverity, type ReviewVerdict } from '@/lib/capture'
import { editTableStatus, loadEditTablesFromEnv } from '@/lib/scrub'
import { EncounterActions } from '@/components/review/EncounterActions'
import { DEFAULT_DATE } from '@/lib/mock-ehr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Pre-approval Review — the encounters nobody has approved yet, each with what
 * to fix (would reject / deny) and what is missing (separately payable if
 * documented), with the contracted dollars on every item. Read-only and
 * deterministic; the provider or biller makes the change and approves in the
 * PM system.
 */

const VERDICT_BADGE: Record<ReviewVerdict, { label: string; variant: 'red' | 'amber' | 'green' }> = {
  blocked: { label: 'will reject — fix first', variant: 'red' },
  fix: { label: 'fix before approving', variant: 'amber' },
  opportunities: { label: 'review opportunities', variant: 'green' },
  ready: { label: 'ready to approve', variant: 'green' },
}
const SEVERITY_BADGE: Record<CaptureSeverity, { label: string; variant: 'red' | 'amber' | 'green' }> = {
  blocker: { label: 'blocker', variant: 'red' },
  warning: { label: 'warning', variant: 'amber' },
  opportunity: { label: 'opportunity', variant: 'green' },
}
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', review: 'Review', unknown: 'Pending' }

const mono: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 12 }

export default async function ReviewPage() {
  const cfg = tebraConfigFromEnv()
  let result: TebraPreApproval | null = null
  let error: string | null = null
  try {
    // Rates for codes not on any encounter yet: the synthetic contract export in mock
    // mode, the practice's TEBRA_CONTRACT_EXPORT_PATH live. NCCI tables from env (seed otherwise).
    result = await runTebraPreApproval(
      createTebraSource(cfg),
      { serviceDateFrom: DEFAULT_DATE },
      cfg.useMock ? sampleTebraContractRates() : fallbackRatesFromEnv(),
      new Date(),
      loadEditTablesFromEnv(),
    )
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const report = result?.report
  const writesEnabled = cfg.useMock || process.env.TEBRA_ALLOW_WRITES === 'true'
  const tables = editTableStatus()
  const claimsByControl = new Map((result?.claims ?? []).map((c) => [c.controlNumber, c]))
  const encountersByControl = new Map((result?.encounters ?? []).map((e) => [e.patientControlNumber, e]))
  const providerByControl = new Map((result?.rows ?? []).map((r) => [r.EncounterID ?? '', r.RenderingProviderName ?? '']))

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Pre-approval Review</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
            Every encounter that is documented but not yet approved, with what would reject or deny as coded and what is separately payable
            but missing — in contracted dollars. Fix it here, then approve in Tebra. Nothing is changed for you: the provider or biller decides.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: cfg.useMock ? '#2f8a5b' : '#b8862a', background: cfg.useMock ? '#e6f4ec' : '#f6efdd', padding: '4px 10px', borderRadius: 999, marginTop: 4 }}>
          {cfg.useMock ? 'Tebra · mock · synthetic' : 'Tebra · live'}
        </span>
      </div>

      {error ? (
        <div style={{ padding: '14px 16px', fontSize: 12.5, color: '#92400e', background: '#f6efdd', border: '1px solid #f6e0b5', borderRadius: 12, lineHeight: 1.55 }}>
          Review unavailable: {error}
        </div>
      ) : report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, margin: '0 0 18px' }}>
            <StatCard label="Awaiting approval" value={String(report.totals.encounters)} delta={`${formatCents(report.totals.expectedCents)} contracted as coded`} />
            <StatCard label="Ready" value={String(report.totals.byVerdict.ready)} delta="nothing to fix" accent="default" />
            <StatCard label="Fix first" value={String(report.totals.byVerdict.blocked + report.totals.byVerdict.fix)} delta={`${report.totals.blockers} blocker${report.totals.blockers === 1 ? '' : 's'} · ${report.totals.warnings} warning${report.totals.warnings === 1 ? '' : 's'}`} accent={report.totals.blockers + report.totals.warnings > 0 ? 'warning' : 'default'} />
            <StatCard label="At risk as coded" value={formatCents(report.totals.atRiskCents)} delta="would reject, deny or bundle" accent={report.totals.atRiskCents > 0 ? 'warning' : 'default'} />
            <StatCard label="Left on the table" value={formatCents(report.totals.opportunityCents)} delta={`${report.totals.opportunities} separately payable if documented`} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {report.reviews.map((r) => {
              const claim = claimsByControl.get(r.claimControlNumber)
              const enc = encountersByControl.get(r.claimControlNumber)
              const patient = enc?.subscriber ? `${enc.subscriber.firstName} ${enc.subscriber.lastName}`.trim() : r.claimControlNumber
              const badge = VERDICT_BADGE[r.verdict]
              return (
                <div key={r.claimControlNumber} style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ece3', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5a6b62', background: '#f0ece3', padding: '3px 9px', borderRadius: 999 }}>{STATUS_LABEL[r.approvalStatus]}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1f2d27' }}>{patient}</span>
                    <span style={{ ...mono, color: '#9aa69f' }}>{r.claimControlNumber}</span>
                    <span style={{ fontSize: 12.5, color: '#6b7280' }}>{claim?.payer.name}{providerByControl.get(r.claimControlNumber) ? ` · ${providerByControl.get(r.claimControlNumber)}` : ''}{claim?.dateOfService ? ` · ${claim.dateOfService}` : ''}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{formatCents(r.expectedCents)} as coded</span>
                      <Badge label={badge.label} variant={badge.variant} />
                    </span>
                  </div>

                  <div style={{ padding: '10px 16px', borderBottom: r.findings.length ? '1px solid #f0ece3' : 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {claim?.lines.map((l) => (
                      <span key={l.id} style={{ ...mono, color: '#3a4640', background: '#fbfaf7', border: '1px solid #ece7dd', borderRadius: 7, padding: '3px 8px' }}>
                        {l.cptHcpcs}{l.modifiers.length ? `-${l.modifiers.join(',')}` : ''}{l.units > 1 ? ` ×${l.units}` : ''}
                        <span style={{ color: '#9aa69f' }}> · {formatCents(l.billedCents)}</span>
                      </span>
                    ))}
                    {claim && claim.diagnoses.length > 0 && <span style={{ ...mono, color: '#9aa69f', padding: '3px 0' }}>dx {claim.diagnoses.join(', ')}</span>}
                  </div>

                  {r.findings.map((f) => {
                    const sb = SEVERITY_BADGE[f.severity]
                    return (
                      <div key={f.id} style={{ padding: '11px 16px', borderBottom: '1px solid #f6f3ec', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, paddingTop: 1 }}><Badge label={sb.label} variant={sb.variant} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>{f.title}{f.cptHcpcs ? <span style={{ ...mono, color: '#9aa69f', fontWeight: 400 }}> · {f.cptHcpcs}</span> : null}</div>
                          <div style={{ fontSize: 12.5, color: '#4b5b52', lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
                          {f.hint && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginTop: 2 }}>→ {f.hint}</div>}
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: f.impact === 'at_risk' ? '#cf5547' : f.impact === 'opportunity' ? '#2f8a5b' : '#9aa69f' }}>
                          {f.impact === 'none' ? '—' : (f.impact === 'opportunity' ? '+' : '') + formatCents(f.impactCents)}
                          <div style={{ fontSize: 10.5, fontWeight: 500, color: '#9aa69f' }}>{f.impact === 'at_risk' ? 'at risk' : f.impact === 'opportunity' ? 'if documented' : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                  {writesEnabled && (
                    <div style={{ padding: '10px 16px', background: '#fbfaf7' }}>
                      <EncounterActions encounterId={r.claimControlNumber} verdict={r.verdict} source={cfg.useMock ? 'mock' : 'live'} />
                    </div>
                  )}
                </div>
              )
            })}
            {report.reviews.length === 0 && (
              <div style={{ padding: '14px 16px', fontSize: 13, color: '#9aa69f', background: '#fff', border: '1px solid #ece7dd', borderRadius: 12 }}>No encounters are waiting for approval.</div>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
            Deterministic rules (<code>lib/capture</code>) over the scrubber&apos;s edits and Tebra&apos;s contract rates — never an estimate, never an LLM.
            &ldquo;If documented&rdquo; means exactly that: bill it only when the note supports it. Editing stays in Tebra;
            {writesEnabled ? ' approve / send-back here writes through the Tebra API.' : ' approving too (TEBRA_ALLOW_WRITES is off).'}
            {' '}NCCI tables: PTP {tables.ptp} · MUE {tables.mue}{tables.ptp === 'seed' ? ' — load the CMS files (NCCI_PTP_PATH / NCCI_MUE_PATH) before relying on bundling edits.' : '.'}
          </p>
        </>
      )}
    </div>
  )
}
