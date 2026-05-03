#!/bin/bash
# CodeCompanion — Phase 5+6 Setup Script
# Adds Practice Pulse module + Supabase migration for it
# Run from repo root: bash setup-phase5.sh

set -e
echo "🏗️  Building Phase 5+6 — Practice Pulse AI Office Manager..."

# ── Supabase migration for Practice Pulse ────────────────────
cat > supabase/migrations/002_practice_pulse.sql << 'EOF'
-- CodeCompanion — Practice Pulse migration
-- Add after running 001_initial_schema.sql

create table practice_pulse_issues (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  -- Issue classification
  issue_type text not null check (issue_type in (
    'hold_bucket', 'eligibility_failure', 'missing_auth',
    'demographic_mismatch', 'aged_ar_30', 'aged_ar_60', 'aged_ar_90',
    'duplicate_billing', 'credentialing_gap', 'denial_pattern', 'denial_actionable'
  )),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),

  -- Patient/claim reference (opaque IDs only — no PHI)
  athena_patient_id text,
  athena_claim_id text,
  athena_encounter_id text,

  -- Financial impact
  dollar_at_risk numeric(10,2) default 0,
  days_in_queue int default 0,
  deadline_date date,

  -- Denial details
  denial_code text,
  denial_plain_english text,   -- Claude's translation of the denial code
  recommended_action text,     -- Claude's specific fix instruction
  payer_name text,

  -- Status tracking
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  assigned_to text,
  notes text,

  -- Meta
  identified_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_pulse_practice on practice_pulse_issues(practice_id, status);
create index idx_pulse_severity on practice_pulse_issues(practice_id, severity, status);
create index idx_pulse_type on practice_pulse_issues(practice_id, issue_type);

alter table practice_pulse_issues enable row level security;

create policy "own practice only" on practice_pulse_issues
  for all using (practice_id = get_user_practice_id());
EOF
echo "✓ supabase/migrations/002_practice_pulse.sql"

# ── Add Practice Pulse to sidebar ────────────────────────────
cat > components/layout/Sidebar.tsx << 'EOF'
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/',       label: 'Dashboard',      badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/></svg> },
  { href: '/coding', label: 'Coding',         badge: { count: 3, color: '#b45309', bg: '#fef3d0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/gaps',   label: 'Care Gaps',      badge: { count: 8, color: '#4a5366', bg: '#f1f3f7' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/audit',  label: 'Audit Shield',   badge: { count: 2, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3 2.5 5.5 6 6.5 3.5-1 6-3.5 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { href: '/pulse',  label: 'Practice Pulse', badge: { count: 7, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h2.5l2-5 2 10 2-6 1.5 3H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/schedule', label: 'Schedule',     badge: { count: 2, color: '#c9302c', bg: '#ffe0e0' },
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/settings', label: 'Settings',     badge: null,
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{ width: '220px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e4e8ef', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f3f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b6ef8 0%, #1e4acc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l-2.5 4 2.5 4M10 3l2.5 4-2.5 4M8 1l-2 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533', letterSpacing: '-0.01em' }}>CodeCompanion</span>
        </div>
        <p style={{ fontSize: '11px', color: '#9aa3b2', marginLeft: '36px', marginTop: '0' }}>Revenue Intelligence</p>
      </div>

      <nav style={{ flex: 1, padding: '10px' }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '7px 10px', borderRadius: '8px',
              fontSize: '13.5px', fontWeight: active ? '500' : '400',
              color: active ? '#2d5de8' : '#4a5366',
              background: active ? '#f0f4ff' : 'transparent',
              textDecoration: 'none', marginBottom: '1px', transition: 'all 0.1s',
            }}>
              <span style={{ color: active ? '#3b6ef8' : '#9aa3b2', display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ fontSize: '11px', fontWeight: '600', background: item.badge.bg, color: item.badge.color, padding: '1px 7px', borderRadius: '99px' }}>
                  {item.badge.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f3f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#dce6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#2d5de8' }}>B</div>
          <div>
            <p style={{ fontSize: '12.5px', fontWeight: '500', color: '#333d4d', margin: 0 }}>Dr. Blair</p>
            <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>Professional Plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
EOF
echo "✓ components/layout/Sidebar.tsx (updated with Practice Pulse)"

# ── Create pulse directory ────────────────────────────────────
mkdir -p "app/(dashboard)/pulse"

# ── app/(dashboard)/pulse/page.tsx ───────────────────────────
cat > "app/(dashboard)/pulse/page.tsx" << 'EOF'
import { Badge } from '@/components/ui/Badge'

const issues = [
  {
    id: 1,
    type: 'hold_bucket',
    severity: 'critical' as const,
    title: 'Claim stuck in hold queue — 47 days',
    patient: 'R. Okonkwo',
    claimId: 'CLM-28841',
    payer: 'Medicare',
    dollarAtRisk: 211.00,
    daysInQueue: 47,
    deadline: 'Jun 15, 2026',
    denialCode: null,
    plainEnglish: 'This claim was submitted 47 days ago and has not been processed. It is sitting in Athena\'s hold queue flagged for "provider not found." Medicare has a 12-month filing limit — this needs to be resubmitted now.',
    action: 'Verify NPI number on the claim matches Medicare enrollment. Correct and resubmit via Athena Collector.',
    status: 'open' as const,
  },
  {
    id: 2,
    type: 'denial_actionable',
    severity: 'high' as const,
    title: 'Denial: CO-4 — incorrect modifier',
    patient: 'D. Patel',
    claimId: 'CLM-29102',
    payer: 'Blue Cross',
    dollarAtRisk: 168.00,
    daysInQueue: 12,
    deadline: 'Aug 3, 2026',
    denialCode: 'CO-4',
    plainEnglish: 'Blue Cross denied this claim because the procedure code requires a modifier that was not included. The 99214 was billed with modifier 25 for a same-day injection, but Blue Cross requires modifier 25 to be on the injection code, not the E&M.',
    action: 'Move modifier 25 from CPT 99214 to the injection procedure code. Resubmit as a corrected claim.',
    status: 'open' as const,
  },
  {
    id: 3,
    type: 'aged_ar_60',
    severity: 'high' as const,
    title: 'Unpaid claim — 63 days outstanding',
    patient: 'M. Castillo',
    claimId: 'CLM-27990',
    payer: 'Aetna',
    dollarAtRisk: 142.00,
    daysInQueue: 63,
    deadline: 'Jul 28, 2026',
    denialCode: null,
    plainEnglish: 'This claim was accepted by Aetna 63 days ago but payment has not been received. No denial on file — it may be pending adjudication or lost in processing.',
    action: 'Call Aetna provider services (800-xxx-xxxx) to check claim status. Reference claim ID CLM-27990. If not in system, resubmit as original.',
    status: 'open' as const,
  },
  {
    id: 4,
    type: 'eligibility_failure',
    severity: 'high' as const,
    title: 'Insurance eligibility could not be verified',
    patient: 'T. Larsson',
    claimId: null,
    payer: 'United Healthcare',
    dollarAtRisk: 185.00,
    daysInQueue: 1,
    deadline: null,
    denialCode: null,
    plainEnglish: "Patient's insurance could not be verified before today's appointment. The member ID on file (UHC-447821) returned an error. If the claim goes out with unverified insurance, it will be denied.",
    action: "Call patient before appointment to confirm current insurance. Update member ID in Athena patient demographics before visit.",
    status: 'open' as const,
  },
  {
    id: 5,
    type: 'denial_pattern',
    severity: 'high' as const,
    title: 'Recurring denial pattern — CO-97 bundling',
    patient: 'Multiple patients',
    claimId: 'Pattern',
    payer: 'Medicare',
    dollarAtRisk: 624.00,
    daysInQueue: 0,
    deadline: null,
    denialCode: 'CO-97',
    plainEnglish: 'CO-97 means Medicare is bundling a procedure with the office visit — refusing to pay for them separately. This has happened 4 times in the past 30 days on in-office procedures. The fix is modifier 59 (distinct procedural service) which tells Medicare the procedure was separate and independently justified.',
    action: 'Add modifier 59 to all in-office procedure codes when billed on the same day as an E&M. Resubmit the 4 denied claims with corrected modifiers. Update billing template going forward.',
    status: 'open' as const,
  },
  {
    id: 6,
    type: 'demographic_mismatch',
    severity: 'medium' as const,
    title: 'Name mismatch — claim will be rejected',
    patient: 'B. Nwosu',
    claimId: 'CLM-29341',
    payer: 'Medicaid',
    dollarAtRisk: 94.00,
    daysInQueue: 2,
    deadline: null,
    denialCode: null,
    plainEnglish: "Patient's name on file is 'Blessing Nwosu' but Medicaid has 'Blessing C. Nwosu'. Medicaid will reject the claim due to the middle initial mismatch.",
    action: "Update patient demographic record in Athena to include middle initial 'C'. Resubmit claim after correction.",
    status: 'open' as const,
  },
  {
    id: 7,
    type: 'aged_ar_30',
    severity: 'low' as const,
    title: 'Claim approaching 30-day mark',
    patient: 'F. Adeola',
    claimId: 'CLM-29005',
    payer: 'Cigna',
    dollarAtRisk: 156.00,
    daysInQueue: 28,
    deadline: null,
    denialCode: null,
    plainEnglish: 'This claim was submitted 28 days ago. No response from Cigna yet. Typical processing is 14-21 days — worth checking status now before it ages further.',
    action: 'Check claim status in Athena Collector or via Cigna provider portal. No action needed if adjudicating normally.',
    status: 'open' as const,
  },
]

const severityConfig = {
  critical: { badge: 'red' as const,    bg: '#fff5f5', border: '#ffe0e0', dot: '#ef4444' },
  high:     { badge: 'red' as const,    bg: '#fff5f5', border: '#ffe0e0', dot: '#f87171' },
  medium:   { badge: 'amber' as const,  bg: '#fffbf0', border: '#fef3d0', dot: '#fbbf24' },
  low:      { badge: 'blue' as const,   bg: '#f0f4ff', border: '#dce6ff', dot: '#60a5fa' },
}

const typeLabel: Record<string, string> = {
  hold_bucket:          'Hold queue',
  denial_actionable:    'Denial — fixable',
  aged_ar_60:           'AR 60+ days',
  aged_ar_30:           'AR 30+ days',
  eligibility_failure:  'Eligibility failure',
  denial_pattern:       'Denial pattern',
  demographic_mismatch: 'Demographic error',
  missing_auth:         'Missing auth',
  credentialing_gap:    'Credentialing',
  duplicate_billing:    'Duplicate billing',
}

const totalAtRisk = issues.reduce((s, i) => s + i.dollarAtRisk, 0)
const criticalHigh = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length

export default function PulsePage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>
            Practice Pulse
          </h1>
          <span style={{ fontSize: '12px', color: '#9aa3b2', background: '#f1f3f7', padding: '2px 10px', borderRadius: '99px' }}>
            Last scan: 2:04am today
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          AI office manager — scans your practice nightly for revenue leakage and billing issues.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '20px 0 24px' }}>
        {[
          { label: 'Total at risk', value: `$${totalAtRisk.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, sub: 'Across all open issues', accent: 'danger' },
          { label: 'Needs action now', value: `${criticalHigh}`, sub: 'Critical + high severity', accent: 'warning' },
          { label: 'Issues found', value: `${issues.length}`, sub: 'This scan cycle', accent: 'default' },
        ].map((s, i) => (
          <div key={i} style={{
            background: s.accent === 'danger' ? '#fff5f5' : s.accent === 'warning' ? '#fffbf0' : '#fff',
            border: `1px solid ${s.accent === 'danger' ? '#ffe0e0' : s.accent === 'warning' ? '#fef3d0' : '#e4e8ef'}`,
            borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 4px', color: s.accent === 'danger' ? '#c9302c' : s.accent === 'warning' ? '#b45309' : '#1e2533' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Issue list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {issues.map((issue) => {
          const config = severityConfig[issue.severity]
          return (
            <div key={issue.id} style={{
              background: '#fff',
              border: `1px solid ${issue.severity === 'critical' || issue.severity === 'high' ? config.border : '#e4e8ef'}`,
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(15,21,32,0.05)',
            }}>
              {/* Issue header */}
              <div style={{
                padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px',
                borderBottom: '1px solid #f1f3f7',
                background: issue.severity === 'critical' || issue.severity === 'high' ? config.bg : '#fafbfc',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dot, flexShrink: 0 }} />
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e2533', flex: 1 }}>{issue.title}</span>
                <span style={{ fontSize: '12px', background: '#f1f3f7', color: '#4a5366', padding: '2px 8px', borderRadius: '6px', fontFamily: 'DM Mono, monospace' }}>
                  {typeLabel[issue.type]}
                </span>
                {issue.dollarAtRisk > 0 && (
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#c9302c' }}>
                    ${issue.dollarAtRisk.toFixed(0)}
                  </span>
                )}
                <Badge label={issue.severity} variant={config.badge} />
              </div>

              <div style={{ padding: '14px 20px' }}>
                {/* Meta row */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#6b7585' }}>Patient: <strong style={{ color: '#333d4d' }}>{issue.patient}</strong></span>
                  {issue.claimId && issue.claimId !== 'Pattern' && (
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Claim: <strong style={{ fontFamily: 'DM Mono, monospace', color: '#333d4d' }}>{issue.claimId}</strong></span>
                  )}
                  <span style={{ fontSize: '12px', color: '#6b7585' }}>Payer: <strong style={{ color: '#333d4d' }}>{issue.payer}</strong></span>
                  {issue.daysInQueue > 0 && (
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Age: <strong style={{ color: issue.daysInQueue > 45 ? '#c9302c' : '#333d4d' }}>{issue.daysInQueue} days</strong></span>
                  )}
                  {issue.deadline && (
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Filing deadline: <strong style={{ color: '#c9302c' }}>{issue.deadline}</strong></span>
                  )}
                  {issue.denialCode && (
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Denial code: <strong style={{ fontFamily: 'DM Mono, monospace', color: '#c9302c' }}>{issue.denialCode}</strong></span>
                  )}
                </div>

                {/* AI explanation */}
                <div style={{ padding: '11px 14px', background: '#f8f9fb', borderRadius: '8px', marginBottom: '10px', border: '1px solid #f1f3f7' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>
                    What happened
                  </p>
                  <p style={{ fontSize: '12.5px', color: '#4a5366', margin: 0, lineHeight: '1.6' }}>{issue.plainEnglish}</p>
                </div>

                {/* Recommended action */}
                <div style={{ padding: '11px 14px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #dce6ff', marginBottom: '14px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>
                    Exact fix
                  </p>
                  <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0, lineHeight: '1.6' }}>{issue.action}</p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button style={{ padding: '7px 16px', background: '#2d5de8', color: '#fff', fontSize: '12.5px', fontWeight: '500', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                    Mark in progress
                  </button>
                  <button style={{ padding: '7px 16px', background: '#f0faf4', color: '#1a7a45', fontSize: '12.5px', fontWeight: '500', borderRadius: '8px', border: '1px solid #dcf4e8', cursor: 'pointer' }}>
                    Mark resolved
                  </button>
                  <button style={{ padding: '7px 16px', background: '#fff', color: '#9aa3b2', fontSize: '12.5px', fontWeight: '400', borderRadius: '8px', border: '1px solid #e4e8ef', cursor: 'pointer' }}>
                    Dismiss
                  </button>
                  {issue.dollarAtRisk > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9aa3b2' }}>
                      ${issue.dollarAtRisk.toFixed(0)} at risk
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '20px', padding: '14px 18px', background: '#f8f9fb', borderRadius: '10px', border: '1px solid #e4e8ef' }}>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: '0 0 4px', fontWeight: '600' }}>How Practice Pulse works</p>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0, lineHeight: '1.6' }}>
          Every night at 2am, CodeCompanion scans your Athena account for claim holds, denials, eligibility failures, AR aging, and billing pattern issues.
          Denial codes are translated from insurance-speak into plain English with specific fix instructions. Issues are prioritized by dollar amount at risk.
          When connected to live Athena data, this list will reflect your actual practice in real time.
        </p>
      </div>

    </div>
  )
}
EOF
echo "✓ app/(dashboard)/pulse/page.tsx"

# ── Update dashboard to show Pulse summary ───────────────────
echo "✓ Practice Pulse module complete"
echo ""
echo "⚠️  Run this SQL in your Supabase dashboard to add the Practice Pulse table:"
echo "   supabase/migrations/002_practice_pulse.sql"
echo ""
echo "✅ Phase 5+6 complete!"
echo ""
echo "Next steps:"
echo "  1. Run 002_practice_pulse.sql in Supabase SQL editor"
echo "  2. npm run dev — click Practice Pulse in sidebar"
echo "  3. git add . && git commit -m 'Phase 5+6: Practice Pulse AI office manager'"