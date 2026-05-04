#!/bin/bash
# CodeCompanion — Phase 6 Setup Script
# Expands Practice Pulse with 5 new office manager sections
# Run from repo root: bash setup-phase6.sh

set -e
echo "🏗️  Building Phase 6 — Expanded Practice Pulse Office Manager..."

# ── Supabase migration 003 ────────────────────────────────────
cat > supabase/migrations/003_office_manager.sql << 'EOF'
-- CodeCompanion — Office Manager expansion
-- Run after 002_practice_pulse.sql

create table office_manager_items (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  category text not null check (category in (
    'unreviewed_lab', 'patient_balance', 'recall_overdue',
    'portal_message', 'unconfirmed_appointment'
  )),
  severity text not null default 'medium'
    check (severity in ('high', 'medium', 'low')),

  -- Patient reference (opaque ID only)
  athena_patient_id text,
  athena_appointment_id text,

  -- Item details
  title text not null,
  detail text,
  dollar_amount numeric(10,2) default 0,
  days_pending int default 0,
  due_date date,

  -- Status
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),

  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_office_mgr_practice on office_manager_items(practice_id, status);
create index idx_office_mgr_category on office_manager_items(practice_id, category);

alter table office_manager_items enable row level security;
create policy "own practice only" on office_manager_items
  for all using (practice_id = get_user_practice_id());
EOF
echo "✓ supabase/migrations/003_office_manager.sql"

# ── Full Practice Pulse page with all sections ────────────────
cat > "app/(dashboard)/pulse/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

// ── Section: Billing issues (existing) ───────────────────────
const billingIssues = [
  {
    id: 1, severity: 'critical' as const, type: 'hold_bucket',
    title: 'Claim stuck in hold queue — 47 days',
    patient: 'R. Okonkwo', claimId: 'CLM-28841', payer: 'Medicare',
    dollarAtRisk: 211, daysInQueue: 47, deadline: 'Jun 15, 2026',
    denialCode: null,
    plainEnglish: "This claim was submitted 47 days ago and has not been processed. It is sitting in Athena's hold queue flagged for 'provider not found.' Medicare has a 12-month filing limit — this needs to be resubmitted now.",
    action: 'Verify NPI number on the claim matches Medicare enrollment. Correct and resubmit via Athena Collector.',
  },
  {
    id: 2, severity: 'high' as const, type: 'denial_actionable',
    title: 'Denial: CO-4 — incorrect modifier',
    patient: 'D. Patel', claimId: 'CLM-29102', payer: 'Blue Cross',
    dollarAtRisk: 168, daysInQueue: 12, deadline: 'Aug 3, 2026',
    denialCode: 'CO-4',
    plainEnglish: 'Blue Cross denied this claim because the procedure code requires a modifier that was not included. Modifier 25 needs to be on the injection code, not the E&M.',
    action: 'Move modifier 25 from CPT 99214 to the injection procedure code. Resubmit as a corrected claim.',
  },
  {
    id: 3, severity: 'high' as const, type: 'aged_ar_60',
    title: 'Unpaid claim — 63 days outstanding',
    patient: 'M. Castillo', claimId: 'CLM-27990', payer: 'Aetna',
    dollarAtRisk: 142, daysInQueue: 63, deadline: 'Jul 28, 2026',
    denialCode: null,
    plainEnglish: 'This claim was accepted by Aetna 63 days ago but payment has not been received. No denial on file — it may be pending adjudication or lost in processing.',
    action: 'Call Aetna provider services to check claim status. Reference claim ID CLM-27990. If not in system, resubmit as original.',
  },
  {
    id: 4, severity: 'high' as const, type: 'denial_pattern',
    title: 'Recurring denial pattern — CO-97 bundling',
    patient: 'Multiple patients', claimId: 'Pattern', payer: 'Medicare',
    dollarAtRisk: 624, daysInQueue: 0, deadline: null,
    denialCode: 'CO-97',
    plainEnglish: 'CO-97 means Medicare is bundling a procedure with the office visit. This has happened 4 times in the past 30 days. The fix is modifier 59 which tells Medicare the procedure was separately justified.',
    action: 'Add modifier 59 to all in-office procedure codes billed same-day as an E&M. Resubmit the 4 denied claims.',
  },
  {
    id: 5, severity: 'high' as const, type: 'eligibility_failure',
    title: 'Insurance eligibility could not be verified',
    patient: 'T. Larsson', claimId: null, payer: 'United Healthcare',
    dollarAtRisk: 185, daysInQueue: 1, deadline: null,
    denialCode: null,
    plainEnglish: "Patient's insurance could not be verified. The member ID on file returned an error. If the claim goes out with unverified insurance, it will be denied.",
    action: 'Call patient before appointment to confirm current insurance. Update member ID in Athena patient demographics.',
  },
  {
    id: 6, severity: 'medium' as const, type: 'demographic_mismatch',
    title: 'Name mismatch — claim will be rejected',
    patient: 'B. Nwosu', claimId: 'CLM-29341', payer: 'Medicaid',
    dollarAtRisk: 94, daysInQueue: 2, deadline: null,
    denialCode: null,
    plainEnglish: "Patient name on file is 'Blessing Nwosu' but Medicaid has 'Blessing C. Nwosu'. Medicaid will reject the claim due to the middle initial mismatch.",
    action: "Update patient demographic record in Athena to include middle initial 'C'. Resubmit after correction.",
  },
]

// ── Section: Unreviewed lab results ──────────────────────────
const unreviewedLabs = [
  {
    id: 1, severity: 'high' as const,
    patient: 'D. Patel', patientId: 'P009',
    test: 'HbA1c', result: '9.2%', flag: 'HIGH',
    normalRange: '< 5.7%', resultedAt: '2 hours ago',
    orderedDaysAgo: 3,
    action: 'Critical value — patient must be notified today. Consider medication adjustment.',
  },
  {
    id: 2, severity: 'high' as const,
    patient: 'R. Okonkwo', patientId: 'P001',
    test: 'Lipid Panel', result: 'LDL 187 mg/dL', flag: 'HIGH',
    normalRange: '< 100 mg/dL', resultedAt: '4 hours ago',
    orderedDaysAgo: 1,
    action: 'Elevated LDL in patient with T2DM. Review statin dosing at next visit or call patient.',
  },
  {
    id: 3, severity: 'medium' as const,
    patient: 'F. Adeola', patientId: 'P013',
    test: 'CBC', result: 'WBC 11.2 K/uL', flag: 'HIGH',
    normalRange: '4.5–11.0', resultedAt: '1 day ago',
    orderedDaysAgo: 2,
    action: 'Mildly elevated WBC. Review in context of clinical picture. May need follow-up.',
  },
  {
    id: 4, severity: 'low' as const,
    patient: 'M. Castillo', patientId: 'P003',
    test: 'Vitamin D', result: '18 ng/mL', flag: 'LOW',
    normalRange: '30–100 ng/mL', resultedAt: '2 days ago',
    orderedDaysAgo: 4,
    action: 'Vitamin D insufficient. Start supplementation and recheck in 3 months.',
  },
]

// ── Section: Patient balances due today ──────────────────────
const patientBalances = [
  { id: 1, patient: 'B. Nwosu',    time: '10:00 AM', balance: 145.00, daysOutstanding: 62, insurance: 'Medicaid',          severity: 'high' as const },
  { id: 2, patient: 'T. Larsson',  time: '11:30 AM', balance: 87.50,  daysOutstanding: 31, insurance: 'Commercial',        severity: 'medium' as const },
  { id: 3, patient: 'F. Adeola',   time: '2:00 PM',  balance: 220.00, daysOutstanding: 91, insurance: 'Commercial',        severity: 'high' as const },
  { id: 4, patient: 'R. Okonkwo',  time: '9:00 AM',  balance: 35.00,  daysOutstanding: 14, insurance: 'Medicare',          severity: 'low' as const },
]

// ── Section: Recall patients overdue ─────────────────────────
const recallPatients = [
  {
    id: 1, severity: 'high' as const,
    patient: 'J. Martinez', patientId: 'P006', age: 62,
    dueFor: '3-month diabetes follow-up',
    daysOverdue: 45, lastVisit: 'Jan 12, 2026',
    providerNote: 'Return in 3 months to recheck HbA1c and adjust metformin if needed',
    action: 'Call to schedule — 45 days overdue for diabetes management visit.',
  },
  {
    id: 2, severity: 'high' as const,
    patient: 'S. Huang', patientId: 'P007', age: 79,
    dueFor: 'Monthly CCM check-in',
    daysOverdue: 18, lastVisit: 'Mar 28, 2026',
    providerNote: 'CCM enrolled — monthly clinical staff contact required',
    action: 'CCM billing requires monthly contact. Call or portal message today to maintain 99490 eligibility.',
  },
  {
    id: 3, severity: 'medium' as const,
    patient: 'C. Dimitriou', patientId: 'P014', age: 61,
    dueFor: '6-month hypertension follow-up',
    daysOverdue: 22, lastVisit: 'Nov 3, 2025',
    providerNote: 'Follow up in 6 months, recheck BP and labs',
    action: 'Schedule follow-up visit. Overdue for BP recheck and lipid panel.',
  },
  {
    id: 4, severity: 'medium' as const,
    patient: 'L. Thompson', patientId: 'P008', age: 68,
    dueFor: 'Annual physical',
    daysOverdue: 31, lastVisit: 'Apr 15, 2025',
    providerNote: 'Annual physical due April 2026',
    action: 'Annual physical overdue by 31 days. Send recall notice and schedule.',
  },
]

// ── Section: Portal messages unanswered ──────────────────────
const portalMessages = [
  {
    id: 1, severity: 'high' as const,
    patient: 'D. Patel', receivedAt: '3 days ago',
    subject: 'Chest pain question',
    preview: 'I have been having some chest tightness when I walk up stairs for the past week...',
    action: 'Urgent — chest symptom reported. Provider must review and respond today.',
  },
  {
    id: 2, severity: 'medium' as const,
    patient: 'M. Castillo', receivedAt: '2 days ago',
    subject: 'Medication refill request',
    preview: 'I am running low on my methotrexate and need a refill sent to CVS...',
    action: 'Refill request — review medication list and authorize if appropriate.',
  },
  {
    id: 3, severity: 'medium' as const,
    patient: 'R. Okonkwo', receivedAt: '1 day ago',
    subject: 'Question about gabapentin side effects',
    preview: 'I started the gabapentin and I am feeling very dizzy especially in the morning...',
    action: 'Side effect concern on new medication. Provider should call or message back today.',
  },
  {
    id: 4, severity: 'low' as const,
    patient: 'F. Adeola', receivedAt: '4 days ago',
    subject: 'Request for medical records',
    preview: 'I need my records sent to a specialist at Duke...',
    action: 'Records release request. Route to front desk for processing.',
  },
]

// ── Section: Unconfirmed appointments ────────────────────────
const unconfirmed = [
  { id: 1, patient: 'B. Nwosu',    time: '10:00 AM', type: 'New patient',    noShowRisk: 82, contacted: false, severity: 'high' as const },
  { id: 2, patient: 'T. Larsson',  time: '11:30 AM', type: 'Sick visit',     noShowRisk: 71, contacted: false, severity: 'high' as const },
  { id: 3, patient: 'F. Adeola',   time: '2:00 PM',  type: 'Annual physical',noShowRisk: 22, contacted: true,  severity: 'low' as const },
]

// ── UI helpers ────────────────────────────────────────────────
const severityDot: Record<string, string> = { critical: '#ef4444', high: '#f87171', medium: '#fbbf24', low: '#60a5fa' }
const severityBadge = { critical: 'red', high: 'red', medium: 'amber', low: 'blue' } as const

function SectionHeader({ title, count, countVariant, subtitle }: {
  title: string; count: number; countVariant: 'red'|'amber'|'blue'|'green'; subtitle: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1e2533', margin: '0 0 2px', letterSpacing: '-0.01em' }}>{title}</h2>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{subtitle}</p>
      </div>
      <Badge label={`${count} items`} variant={countVariant} />
    </div>
  )
}

function IssueCard({ children, severity }: { children: React.ReactNode; severity: 'critical'|'high'|'medium'|'low' }) {
  const isUrgent = severity === 'critical' || severity === 'high'
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isUrgent ? '#ffe0e0' : '#e4e8ef'}`,
      borderRadius: '10px', marginBottom: '8px', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(15,21,32,0.04)',
    }}>
      {children}
    </div>
  )
}

function ActionButtons() {
  return (
    <div style={{ display: 'flex', gap: '7px', marginTop: '12px' }}>
      <button style={{ padding: '6px 14px', background: '#2d5de8', color: '#fff', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>Mark in progress</button>
      <button style={{ padding: '6px 14px', background: '#f0faf4', color: '#1a7a45', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: '1px solid #dcf4e8', cursor: 'pointer' }}>Resolved</button>
      <button style={{ padding: '6px 14px', background: '#fff', color: '#9aa3b2', fontSize: '12px', borderRadius: '7px', border: '1px solid #e4e8ef', cursor: 'pointer' }}>Dismiss</button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PulsePage() {
  const [activeTab, setActiveTab] = useState<'billing'|'labs'|'balances'|'recalls'|'messages'|'schedule'>('billing')

  const tabs = [
    { key: 'billing',  label: 'Billing issues',   count: billingIssues.length,  color: '#c9302c' },
    { key: 'labs',     label: 'Unreviewed labs',  count: unreviewedLabs.length,  color: '#c9302c' },
    { key: 'balances', label: 'Balances due',     count: patientBalances.length, color: '#b45309' },
    { key: 'recalls',  label: 'Overdue recalls',  count: recallPatients.length,  color: '#b45309' },
    { key: 'messages', label: 'Portal messages',  count: portalMessages.length,  color: '#b45309' },
    { key: 'schedule', label: 'Unconfirmed',      count: unconfirmed.filter(u => !u.contacted).length, color: '#c9302c' },
  ] as const

  const totalIssues = tabs.reduce((s, t) => s + t.count, 0)
  const totalAtRisk = billingIssues.reduce((s, i) => s + i.dollarAtRisk, 0) +
    patientBalances.reduce((s, i) => s + i.balance, 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>
            Practice Pulse
          </h1>
          <span style={{ fontSize: '12px', color: '#9aa3b2', background: '#f1f3f7', padding: '2px 10px', borderRadius: '99px' }}>
            Last scan: 2:04am today
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>
          AI office manager — scans your practice nightly across billing, labs, recalls, messages, and schedule.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total issues', value: `${totalIssues}`, sub: 'Across all categories', accent: 'default' },
          { label: 'Revenue at risk', value: `$${totalAtRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'Billing + patient balances', accent: 'danger' },
          { label: 'Needs action today', value: `${billingIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length + unreviewedLabs.filter(l => l.severity === 'high').length + portalMessages.filter(m => m.severity === 'high').length}`, sub: 'High + critical items', accent: 'warning' },
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

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#f1f3f7', padding: '4px', borderRadius: '10px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '7px 4px', fontSize: '12px', fontWeight: activeTab === tab.key ? '600' : '400',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#1e2533' : '#6b7585',
              border: 'none', borderRadius: '7px', cursor: 'pointer',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(15,21,32,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            <span style={{
              marginLeft: '5px', fontSize: '11px', fontWeight: '600',
              background: activeTab === tab.key ? '#fff5f5' : 'transparent',
              color: tab.color, padding: activeTab === tab.key ? '1px 6px' : '0', borderRadius: '99px',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── BILLING ISSUES ── */}
      {activeTab === 'billing' && (
        <div>
          <SectionHeader title="Billing issues" count={billingIssues.length} countVariant="red" subtitle="Claim holds, denials, eligibility failures, and aged AR" />
          {billingIssues.map(issue => (
            <IssueCard key={issue.id} severity={issue.severity}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: issue.severity === 'critical' || issue.severity === 'high' ? '#fff5f5' : '#fafbfc', borderBottom: '1px solid #f1f3f7' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: severityDot[issue.severity], flexShrink: 0 }} />
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e2533', flex: 1 }}>{issue.title}</span>
                {issue.dollarAtRisk > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: '#c9302c' }}>${issue.dollarAtRisk}</span>}
                <Badge label={issue.severity} variant={severityBadge[issue.severity]} />
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#6b7585' }}>Patient: <strong style={{ color: '#333d4d' }}>{issue.patient}</strong></span>
                  {issue.claimId && issue.claimId !== 'Pattern' && <span style={{ fontSize: '12px', color: '#6b7585' }}>Claim: <strong style={{ fontFamily: 'DM Mono, monospace', color: '#333d4d' }}>{issue.claimId}</strong></span>}
                  <span style={{ fontSize: '12px', color: '#6b7585' }}>Payer: <strong style={{ color: '#333d4d' }}>{issue.payer}</strong></span>
                  {issue.daysInQueue > 0 && <span style={{ fontSize: '12px', color: '#6b7585' }}>Age: <strong style={{ color: issue.daysInQueue > 45 ? '#c9302c' : '#333d4d' }}>{issue.daysInQueue} days</strong></span>}
                  {issue.denialCode && <span style={{ fontSize: '12px', color: '#6b7585' }}>Code: <strong style={{ fontFamily: 'DM Mono, monospace', color: '#c9302c' }}>{issue.denialCode}</strong></span>}
                </div>
                <div style={{ padding: '10px 12px', background: '#f8f9fb', borderRadius: '7px', marginBottom: '8px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>What happened</p>
                  <p style={{ fontSize: '12.5px', color: '#4a5366', margin: 0, lineHeight: '1.6' }}>{issue.plainEnglish}</p>
                </div>
                <div style={{ padding: '10px 12px', background: '#f0f4ff', borderRadius: '7px', border: '1px solid #dce6ff' }}>
                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Exact fix</p>
                  <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0, lineHeight: '1.6' }}>{issue.action}</p>
                </div>
                <ActionButtons />
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* ── UNREVIEWED LABS ── */}
      {activeTab === 'labs' && (
        <div>
          <SectionHeader title="Unreviewed lab results" count={unreviewedLabs.length} countVariant="red" subtitle="Results received but not yet reviewed or communicated to patient" />
          {unreviewedLabs.map(lab => (
            <IssueCard key={lab.id} severity={lab.severity}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ padding: '10px 14px', background: lab.flag === 'HIGH' ? '#fff5f5' : '#f0f4ff', borderRadius: '8px', textAlign: 'center', flexShrink: 0, minWidth: '90px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', margin: '0 0 3px', textTransform: 'uppercase' }}>{lab.test}</p>
                    <p style={{ fontSize: '16px', fontWeight: '700', color: lab.flag === 'HIGH' ? '#c9302c' : '#1e4acc', margin: '0 0 2px' }}>{lab.result}</p>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: lab.flag === 'HIGH' ? '#c9302c' : '#1e4acc', background: lab.flag === 'HIGH' ? '#ffe0e0' : '#dce6ff', padding: '1px 6px', borderRadius: '99px' }}>{lab.flag}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{lab.patient}</span>
                      <Badge label={lab.severity} variant={severityBadge[lab.severity]} />
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9aa3b2' }}>Resulted {lab.resultedAt}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7585', margin: '0 0 8px' }}>Normal range: <strong style={{ color: '#333d4d' }}>{lab.normalRange}</strong> · Ordered {lab.orderedDaysAgo} {lab.orderedDaysAgo === 1 ? 'day' : 'days'} ago</p>
                    <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '7px', border: '1px solid #dce6ff' }}>
                      <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0, lineHeight: '1.5' }}>{lab.action}</p>
                    </div>
                    <ActionButtons />
                  </div>
                </div>
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* ── PATIENT BALANCES ── */}
      {activeTab === 'balances' && (
        <div>
          <SectionHeader
            title="Patient balances due today"
            count={patientBalances.length}
            countVariant="amber"
            subtitle={`$${patientBalances.reduce((s, b) => s + b.balance, 0).toFixed(0)} total collectible at check-in today`}
          />
          <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f3f7', background: '#fafbfc' }}>
                  {['Patient', 'Appt time', 'Balance', 'Days outstanding', 'Insurance', 'Action'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: i >= 2 && i <= 3 ? 'right' : 'left', fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patientBalances.sort((a, b) => b.balance - a.balance).map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: i < patientBalances.length - 1 ? '1px solid #f8f9fb' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e2533' }}>{b.patient}</td>
                    <td style={{ padding: '12px 16px', color: '#4a5366' }}>{b.time}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: b.balance > 100 ? '#c9302c' : '#1e2533' }}>${b.balance.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: b.daysOutstanding > 60 ? '#c9302c' : '#b45309' }}>{b.daysOutstanding} days</td>
                    <td style={{ padding: '12px 16px', color: '#6b7585' }}>{b.insurance}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button style={{ padding: '4px 12px', background: '#f0f4ff', color: '#2d5de8', fontSize: '12px', fontWeight: '500', borderRadius: '6px', border: '1px solid #dce6ff', cursor: 'pointer' }}>
                        Collect at check-in
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f3f7', background: '#fafbfc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Flag these patients for front desk at check-in</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e2533' }}>Total: ${patientBalances.reduce((s, b) => s + b.balance, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── RECALL PATIENTS ── */}
      {activeTab === 'recalls' && (
        <div>
          <SectionHeader title="Overdue recall patients" count={recallPatients.length} countVariant="amber" subtitle="Patients told to follow up who have not yet scheduled" />
          {recallPatients.map(r => (
            <IssueCard key={r.id} severity={r.severity}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ padding: '8px 12px', background: r.daysOverdue > 30 ? '#fff5f5' : '#fffbf0', borderRadius: '8px', textAlign: 'center', flexShrink: 0, minWidth: '80px' }}>
                    <p style={{ fontSize: '22px', fontWeight: '700', color: r.daysOverdue > 30 ? '#c9302c' : '#b45309', margin: '0 0 2px' }}>{r.daysOverdue}</p>
                    <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>days overdue</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{r.patient}</span>
                      <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Age {r.age}</span>
                      <Badge label={r.severity} variant={severityBadge[r.severity]} />
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#333d4d', margin: '0 0 5px' }}>{r.dueFor}</p>
                    <p style={{ fontSize: '12px', color: '#9aa3b2', margin: '0 0 8px' }}>
                      Last visit: {r.lastVisit} · Provider note: <em>"{r.providerNote}"</em>
                    </p>
                    <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '7px', border: '1px solid #dce6ff' }}>
                      <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0 }}>{r.action}</p>
                    </div>
                    <ActionButtons />
                  </div>
                </div>
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* ── PORTAL MESSAGES ── */}
      {activeTab === 'messages' && (
        <div>
          <SectionHeader title="Unanswered portal messages" count={portalMessages.length} countVariant="amber" subtitle="Patient messages awaiting provider response" />
          {portalMessages.map(msg => (
            <IssueCard key={msg.id} severity={msg.severity}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dce6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#2d5de8', flexShrink: 0 }}>
                    {msg.patient.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{msg.patient}</span>
                      <Badge label={msg.severity} variant={severityBadge[msg.severity]} />
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9aa3b2' }}>{msg.receivedAt}</span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#333d4d', margin: '0 0 4px' }}>{msg.subject}</p>
                    <p style={{ fontSize: '12.5px', color: '#6b7585', margin: '0 0 10px', fontStyle: 'italic' }}>"{msg.preview}"</p>
                    <div style={{ padding: '8px 12px', background: msg.severity === 'high' ? '#fff5f5' : '#f0f4ff', borderRadius: '7px', border: `1px solid ${msg.severity === 'high' ? '#ffe0e0' : '#dce6ff'}` }}>
                      <p style={{ fontSize: '12.5px', color: msg.severity === 'high' ? '#c9302c' : '#1e4acc', margin: 0 }}>{msg.action}</p>
                    </div>
                    <ActionButtons />
                  </div>
                </div>
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* ── UNCONFIRMED APPOINTMENTS ── */}
      {activeTab === 'schedule' && (
        <div>
          <SectionHeader title="Unconfirmed appointments" count={unconfirmed.filter(u => !u.contacted).length} countVariant="red" subtitle="Patients who have not confirmed today's appointment" />
          {unconfirmed.map(appt => (
            <IssueCard key={appt.id} severity={appt.severity}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ textAlign: 'center', width: '60px', flexShrink: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#333d4d', margin: '0 0 2px' }}>{appt.time}</p>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>{appt.type}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{appt.patient}</span>
                    <Badge label={appt.contacted ? 'Confirmed' : 'Not confirmed'} variant={appt.contacted ? 'green' : 'red'} />
                    <Badge label={`${appt.noShowRisk}% no-show risk`} variant={appt.noShowRisk > 60 ? 'red' : appt.noShowRisk > 30 ? 'amber' : 'green'} />
                  </div>
                  <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>
                    {appt.contacted ? 'Patient confirmed via portal' : 'No response to automated reminder — manual contact recommended'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                  <button style={{ padding: '7px 14px', background: '#2d5de8', color: '#fff', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>
                    Call patient
                  </button>
                  <button style={{ padding: '7px 14px', background: '#f0faf4', color: '#1a7a45', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: '1px solid #dcf4e8', cursor: 'pointer' }}>
                    Mark confirmed
                  </button>
                </div>
              </div>
            </IssueCard>
          ))}
          <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f0f4ff', borderRadius: '10px', border: '1px solid #dce6ff' }}>
            <p style={{ fontSize: '12.5px', color: '#2d5de8', margin: 0 }}>
              <strong>Tip:</strong> Both unconfirmed slots (10:00am and 11:30am) also have high no-show risk scores. Consider reaching out personally rather than via automated reminder.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '24px', padding: '14px 18px', background: '#f8f9fb', borderRadius: '10px', border: '1px solid #e4e8ef' }}>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: '0 0 3px', fontWeight: '600' }}>How Practice Pulse works</p>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0, lineHeight: '1.6' }}>
          Nightly at 2am, CodeCompanion scans your Athena account across billing, lab results, patient balances, recall queues, portal messages, and appointment confirmations.
          All issues are prioritized by urgency and dollar impact. When connected to live Athena data, this list reflects your actual practice in real time.
        </p>
      </div>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/pulse/page.tsx (full tabbed office manager)"

echo ""
echo "✅ Phase 6 complete!"
echo ""
echo "Run this SQL in Supabase:"
echo "  supabase/migrations/003_office_manager.sql"
echo ""
echo "Then: npm run dev — click Practice Pulse in sidebar"
echo "You'll see 6 tabs: Billing · Labs · Balances · Recalls · Messages · Unconfirmed"
echo ""
echo "Next: git add . && git commit -m 'Phase 6: full Practice Pulse office manager'"