import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { loadSampleClaims } from '@/lib/adapters/edi'
import { scrubClaim, OKLAHOMA } from '@/lib/scrub'
import type { ScrubSeverity } from '@/lib/scrub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEV_BADGE: Record<ScrubSeverity, 'red' | 'amber' | 'gray'> = {
  error: 'red',
  warning: 'amber',
  info: 'gray',
}

export default function ScrubPage() {
  const j = OKLAHOMA
  const claims = loadSampleClaims()
  const results = claims.map((c) => ({ claim: c, result: scrubClaim(c, j) }))
  const clean = results.filter((r) => r.result.ok && r.result.warningCount === 0).length
  const warned = results.filter((r) => r.result.ok && r.result.warningCount > 0).length
  const errored = results.filter((r) => !r.result.ok).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Claim Scrubber</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Catches what a payer would reject or deny — <em>before</em> the claim goes out. Deterministic rules, no AI. Rules
          layer in three tiers: national correct-coding (NCCI/CCI, MUE, modifiers), then the state jurisdiction, then payer policy.
        </p>
      </div>

      <div style={{ background: '#f0f5ff', border: '1px solid #d7e3fb', borderRadius: 12, padding: '14px 16px', margin: '16px 0 20px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e3a8a', marginBottom: 6 }}>Active jurisdiction · {j.label} ({j.state})</div>
        <div style={{ fontSize: 13, color: '#33415c', lineHeight: 1.6 }}>
          <div>Medicare (filing <code>MB</code>) → <strong>{j.medicareMac}</strong> — its LCDs govern coverage.</div>
          <div>Medicaid (filing <code>MC</code>) → <strong>{j.medicaidProgram}</strong> — its manual + prior-auth + state NCCI govern.</div>
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
          State-by-state logic is data behind one seam: a state is a Jurisdiction object layering its rules on the national edits.
          Other states drop in the same way; the Rung 2 corpus (keyed by region) then learns the rest of each payer&apos;s behavior empirically.
          Oklahoma rules here are a labeled seed — verify against the current OHCA manual + Novitas LCDs before production.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '0 0 22px' }}>
        <StatCard label="Claims scrubbed" value={String(results.length)} delta="synthetic sample" />
        <StatCard label="Clean" value={String(clean)} delta="ready to submit" />
        <StatCard label="With warnings" value={String(warned)} delta="review before send" accent={warned > 0 ? 'warning' : 'default'} />
        <StatCard label="Blocked" value={String(errored)} delta="errors must fix" accent={errored > 0 ? 'danger' : 'default'} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {results.map(({ claim, result }) => {
          const status = !result.ok ? { label: 'errors', variant: 'red' as const } : result.warningCount > 0 ? { label: 'warnings', variant: 'amber' as const } : { label: 'clean', variant: 'green' as const }
          return (
            <div key={claim.controlNumber} style={{ background: '#fff', border: '1px solid #ece7dd', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,21,32,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: result.findings.length ? '1px solid #f0ece3' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: '#1f2d27' }}>{claim.controlNumber}</span>
                  <span style={{ fontSize: 12, color: '#9aa69f', fontFamily: 'DM Mono, monospace' }}>{claim.lines.map((l) => l.cptHcpcs).join(' · ')}</span>
                  <span style={{ fontSize: 11, color: '#9aa69f' }}>filing {claim.claimFilingCode ?? '—'}</span>
                </div>
                <Badge label={status.label} variant={status.variant} />
              </div>
              {result.findings.length > 0 && (
                <div style={{ padding: '4px 0' }}>
                  {result.findings.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 16px', alignItems: 'flex-start' }}>
                      <span style={{ marginTop: 1 }}><Badge label={`${f.severity} · ${f.code}`} variant={SEV_BADGE[f.severity]} /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#3a4640', lineHeight: 1.5 }}>{f.message}</div>
                        {f.hint && <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2, lineHeight: 1.5 }}>{f.hint}</div>}
                      </div>
                      <span style={{ fontSize: 10.5, color: '#b6bdca', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{f.source}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: '#9aa69f', marginTop: 16, lineHeight: 1.55 }}>
        Errors block submission; warnings advise. The same scrub runs in the clearinghouse submit path, so a claim that fails
        here never reaches the payer. Seed NCCI/MUE tables and Oklahoma rules are illustrative — the full CMS NCCI tables and
        OHCA/Novitas policy load behind the same interface without changing rule code.
      </p>
    </div>
  )
}
