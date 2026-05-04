#!/bin/bash
# PracticeCompanion — Phase 9 Setup Script
# Adds Unpostables tab to Practice Pulse
# Run from repo root: bash setup-phase9.sh

set -e
echo "🏗️  Building Phase 9 — Unpostables module..."

# ── Supabase migration 004 ────────────────────────────────────
cat > supabase/migrations/004_unpostables.sql << 'EOF'
-- PracticeCompanion — Unpostables migration
-- Run after 003_office_manager.sql

create table unpostable_encounters (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,

  -- Encounter reference
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  encounter_type text,

  -- Block details
  encounter_status text not null check (encounter_status in ('OPEN', 'REVIEW', 'HOLD')),
  block_reason text not null check (block_reason in (
    'no_diagnosis', 'note_unsigned', 'insurance_unverified',
    'billing_hold', 'missing_provider', 'orders_pending', 'other'
  )),
  days_outstanding int not null default 0,
  dollar_at_risk numeric(10,2) default 0,

  -- AI translation
  plain_english text,
  recommended_action text,
  filing_deadline date,

  -- Payer info
  payer_name text,

  -- Status
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'dismissed')),

  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_unpostables_practice on unpostable_encounters(practice_id, status);
create index idx_unpostables_days on unpostable_encounters(practice_id, days_outstanding desc);

alter table unpostable_encounters enable row level security;
create policy "own practice only" on unpostable_encounters
  for all using (practice_id = get_user_practice_id());
EOF
echo "✓ supabase/migrations/004_unpostables.sql"

# ── Full Practice Pulse page with Unpostables tab ────────────
cat > "app/(dashboard)/pulse/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

// ── Billing issues ────────────────────────────────────────────
const billingIssues = [
  { id: 1, severity: 'critical' as const, type: 'hold_bucket', title: 'Claim stuck in hold queue — 47 days', patient: 'R. Okonkwo', claimId: 'CLM-28841', payer: 'Medicare', dollarAtRisk: 211, daysInQueue: 47, deadline: 'Jun 15, 2026', denialCode: null, plainEnglish: "This claim was submitted 47 days ago and has not been processed. It is sitting in Athena's hold queue flagged for 'provider not found.' Medicare has a 12-month filing limit.", action: 'Verify NPI number on the claim matches Medicare enrollment. Correct and resubmit via Athena Collector.' },
  { id: 2, severity: 'high' as const, type: 'denial_actionable', title: 'Denial: CO-4 — incorrect modifier', patient: 'D. Patel', claimId: 'CLM-29102', payer: 'Blue Cross', dollarAtRisk: 168, daysInQueue: 12, deadline: 'Aug 3, 2026', denialCode: 'CO-4', plainEnglish: 'Blue Cross denied this claim because modifier 25 needs to be on the injection code, not the E&M.', action: 'Move modifier 25 from CPT 99214 to the injection procedure code. Resubmit as a corrected claim.' },
  { id: 3, severity: 'high' as const, type: 'aged_ar_60', title: 'Unpaid claim — 63 days outstanding', patient: 'M. Castillo', claimId: 'CLM-27990', payer: 'Aetna', dollarAtRisk: 142, daysInQueue: 63, deadline: 'Jul 28, 2026', denialCode: null, plainEnglish: 'This claim was accepted by Aetna 63 days ago but payment has not been received.', action: 'Call Aetna provider services to check claim status. Reference claim ID CLM-27990.' },
  { id: 4, severity: 'high' as const, type: 'denial_pattern', title: 'Recurring denial pattern — CO-97 bundling', patient: 'Multiple patients', claimId: 'Pattern', payer: 'Medicare', dollarAtRisk: 624, daysInQueue: 0, deadline: null, denialCode: 'CO-97', plainEnglish: 'CO-97 means Medicare is bundling a procedure with the office visit. This has happened 4 times in the past 30 days.', action: 'Add modifier 59 to all in-office procedure codes billed same-day as an E&M. Resubmit the 4 denied claims.' },
  { id: 5, severity: 'high' as const, type: 'eligibility_failure', title: 'Insurance eligibility could not be verified', patient: 'T. Larsson', claimId: null, payer: 'United Healthcare', dollarAtRisk: 185, daysInQueue: 1, deadline: null, denialCode: null, plainEnglish: "Patient's insurance could not be verified. The member ID on file returned an error.", action: 'Call patient before appointment to confirm current insurance. Update member ID in Athena.' },
  { id: 6, severity: 'medium' as const, type: 'demographic_mismatch', title: 'Name mismatch — claim will be rejected', patient: 'B. Nwosu', claimId: 'CLM-29341', payer: 'Medicaid', dollarAtRisk: 94, daysInQueue: 2, deadline: null, denialCode: null, plainEnglish: "Patient name on file is 'Blessing Nwosu' but Medicaid has 'Blessing C. Nwosu'.", action: "Update patient demographic record to include middle initial 'C'. Resubmit after correction." },
]

// ── Unpostables ───────────────────────────────────────────────
const unpostables = [
  {
    id: 1, severity: 'high' as const,
    encounterId: 'ENC-4798', patient: 'S. Huang', patientId: 'P007',
    encounterDate: 'Apr 29, 2026', encounterType: 'Office Visit',
    status: 'OPEN' as const, blockReason: 'note_unsigned',
    daysOutstanding: 4, dollarAtRisk: 174, payer: 'Medicare',
    plainEnglish: "This encounter from 4 days ago has never been locked. The note is still in 'Open' status in Athena, which means no claim has been generated. Every day this sits open is a day you are not getting paid.",
    action: 'Log into Athena, open encounter ENC-4798 for S. Huang, review the note, and lock/sign it. The claim will generate automatically within minutes of locking.',
    filingDeadline: 'Apr 29, 2027',
  },
  {
    id: 2, severity: 'high' as const,
    encounterId: 'ENC-4801', patient: 'J. Martinez', patientId: 'P006',
    encounterDate: 'Apr 30, 2026', encounterType: 'Follow-up',
    status: 'REVIEW' as const, blockReason: 'no_diagnosis',
    daysOutstanding: 3, dollarAtRisk: 142, payer: 'Medicare',
    plainEnglish: "The note is locked but no diagnosis codes were added before locking. Athena has placed this encounter in 'Review' status and will not generate a claim until at least one ICD-10 code is attached.",
    action: 'Open encounter ENC-4801 in Athena billing. Add the appropriate ICD-10 codes — at minimum I10 (hypertension) and E78.5 (hyperlipidemia) based on the patient problem list. Save and post the claim.',
    filingDeadline: 'Apr 30, 2027',
  },
  {
    id: 3, severity: 'high' as const,
    encounterId: 'ENC-4812', patient: 'F. Adeola', patientId: 'P013',
    encounterDate: 'May 1, 2026', encounterType: 'Annual Physical',
    status: 'REVIEW' as const, blockReason: 'insurance_unverified',
    daysOutstanding: 2, dollarAtRisk: 185, payer: 'Cigna',
    plainEnglish: "The annual physical was completed but Cigna insurance could not be verified at the time of the visit. Athena is holding the claim in Review until eligibility is confirmed. If the claim goes out with unverified insurance it will be denied.",
    action: "Run eligibility verification now in Athena for F. Adeola's Cigna policy. If verification passes, release the claim. If it fails, call the patient to confirm current insurance details before posting.",
    filingDeadline: 'May 1, 2027',
  },
  {
    id: 4, severity: 'medium' as const,
    encounterId: 'ENC-4815', patient: 'C. Dimitriou', patientId: 'P014',
    encounterDate: 'May 2, 2026', encounterType: 'Follow-up',
    status: 'HOLD' as const, blockReason: 'billing_hold',
    daysOutstanding: 1, dollarAtRisk: 142, payer: 'Medicare',
    plainEnglish: "A manual billing hold was placed on this encounter — possibly by front desk during check-in due to an outstanding patient balance. The claim cannot be submitted while the hold is active.",
    action: 'Check if the outstanding balance ($87.50) was collected at check-in. If yes, remove the billing hold in Athena Collector and post the claim. If no, confirm collection plan before releasing.',
    filingDeadline: 'May 2, 2027',
  },
  {
    id: 5, severity: 'medium' as const,
    encounterId: 'ENC-4819', patient: 'L. Thompson', patientId: 'P008',
    encounterDate: 'May 2, 2026', encounterType: 'Office Visit',
    status: 'OPEN' as const, blockReason: 'orders_pending',
    daysOutstanding: 1, dollarAtRisk: 128, payer: 'Commercial',
    plainEnglish: "This encounter has an unsigned lab order that is preventing the note from being locked. Athena requires all orders to be signed and acknowledged before an encounter can be closed.",
    action: 'Open encounter ENC-4819. Go to the Orders section and sign the pending lab order (lipid panel). Once all orders are signed, lock the note to generate the claim.',
    filingDeadline: 'May 2, 2027',
  },
]

// ── Unreviewed labs ───────────────────────────────────────────
const unreviewedLabs = [
  { id: 1, severity: 'high' as const, patient: 'D. Patel', test: 'HbA1c', result: '9.2%', flag: 'HIGH', normalRange: '< 5.7%', resultedAt: '2 hours ago', orderedDaysAgo: 3, action: 'Critical value — patient must be notified today. Consider medication adjustment.' },
  { id: 2, severity: 'high' as const, patient: 'R. Okonkwo', test: 'Lipid Panel', result: 'LDL 187 mg/dL', flag: 'HIGH', normalRange: '< 100 mg/dL', resultedAt: '4 hours ago', orderedDaysAgo: 1, action: 'Elevated LDL in patient with T2DM. Review statin dosing at next visit or call patient.' },
  { id: 3, severity: 'medium' as const, patient: 'F. Adeola', test: 'CBC', result: 'WBC 11.2 K/uL', flag: 'HIGH', normalRange: '4.5–11.0', resultedAt: '1 day ago', orderedDaysAgo: 2, action: 'Mildly elevated WBC. Review in context of clinical picture.' },
  { id: 4, severity: 'low' as const, patient: 'M. Castillo', test: 'Vitamin D', result: '18 ng/mL', flag: 'LOW', normalRange: '30–100 ng/mL', resultedAt: '2 days ago', orderedDaysAgo: 4, action: 'Vitamin D insufficient. Start supplementation and recheck in 3 months.' },
]

// ── Patient balances ──────────────────────────────────────────
const patientBalances = [
  { id: 1, patient: 'B. Nwosu',   time: '10:00 AM', balance: 145.00, daysOutstanding: 62, insurance: 'Medicaid',    severity: 'high' as const },
  { id: 2, patient: 'T. Larsson', time: '11:30 AM', balance: 87.50,  daysOutstanding: 31, insurance: 'Commercial',  severity: 'medium' as const },
  { id: 3, patient: 'F. Adeola',  time: '2:00 PM',  balance: 220.00, daysOutstanding: 91, insurance: 'Commercial',  severity: 'high' as const },
  { id: 4, patient: 'R. Okonkwo', time: '9:00 AM',  balance: 35.00,  daysOutstanding: 14, insurance: 'Medicare',   severity: 'low' as const },
]

// ── Recall patients ───────────────────────────────────────────
const recallPatients = [
  { id: 1, severity: 'high' as const, patient: 'J. Martinez', age: 62, dueFor: '3-month diabetes follow-up', daysOverdue: 45, lastVisit: 'Jan 12, 2026', action: 'Call to schedule — 45 days overdue for diabetes management visit.' },
  { id: 2, severity: 'high' as const, patient: 'S. Huang', age: 79, dueFor: 'Monthly CCM check-in', daysOverdue: 18, lastVisit: 'Mar 28, 2026', action: 'CCM billing requires monthly contact. Call or portal message today.' },
  { id: 3, severity: 'medium' as const, patient: 'C. Dimitriou', age: 61, dueFor: '6-month hypertension follow-up', daysOverdue: 22, lastVisit: 'Nov 3, 2025', action: 'Schedule follow-up visit. Overdue for BP recheck and lipid panel.' },
]

// ── Portal messages ───────────────────────────────────────────
const portalMessages = [
  { id: 1, severity: 'high' as const, patient: 'D. Patel', receivedAt: '3 days ago', subject: 'Chest pain question', preview: 'I have been having some chest tightness when I walk up stairs...', action: 'Urgent — chest symptom reported. Provider must review and respond today.' },
  { id: 2, severity: 'medium' as const, patient: 'M. Castillo', receivedAt: '2 days ago', subject: 'Medication refill request', preview: 'I am running low on my methotrexate and need a refill...', action: 'Refill request — review medication list and authorize if appropriate.' },
  { id: 3, severity: 'medium' as const, patient: 'R. Okonkwo', receivedAt: '1 day ago', subject: 'Question about gabapentin side effects', preview: 'I started the gabapentin and I am feeling very dizzy...', action: 'Side effect concern on new medication. Provider should call or message today.' },
]

// ── Unconfirmed appointments ──────────────────────────────────
const unconfirmed = [
  { id: 1, patient: 'B. Nwosu',   time: '10:00 AM', type: 'New patient',    noShowRisk: 82, contacted: false, severity: 'high' as const },
  { id: 2, patient: 'T. Larsson', time: '11:30 AM', type: 'Sick visit',     noShowRisk: 71, contacted: false, severity: 'high' as const },
  { id: 3, patient: 'F. Adeola',  time: '2:00 PM',  type: 'Annual physical', noShowRisk: 22, contacted: true,  severity: 'low' as const },
]

// ── UI helpers ────────────────────────────────────────────────
const severityDot: Record<string, string> = { critical: '#ef4444', high: '#f87171', medium: '#fbbf24', low: '#60a5fa' }
const severityBadge = { critical: 'red', high: 'red', medium: 'amber', low: 'blue' } as const

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:   { label: 'Open',   color: '#c9302c', bg: '#ffe0e0' },
  REVIEW: { label: 'Review', color: '#b45309', bg: '#fef3d0' },
  HOLD:   { label: 'Hold',   color: '#1e4acc', bg: '#dce6ff' },
}

const blockLabel: Record<string, string> = {
  note_unsigned:       'Note not locked',
  no_diagnosis:        'Missing diagnosis codes',
  insurance_unverified:'Insurance unverified',
  billing_hold:        'Billing hold',
  missing_provider:    'Missing provider',
  orders_pending:      'Unsigned orders',
  other:               'Other block',
}

function SectionHeader({ title, count, countVariant, subtitle }: { title: string; count: number; countVariant: 'red'|'amber'|'blue'|'green'|'gray'; subtitle: string }) {
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
    <div style={{ background: '#fff', border: `1px solid ${isUrgent ? '#ffe0e0' : '#e4e8ef'}`, borderRadius: '10px', marginBottom: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }}>
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
  const [activeTab, setActiveTab] = useState<'billing'|'unpostables'|'labs'|'balances'|'recalls'|'messages'|'schedule'>('billing')

  const tabs = [
    { key: 'billing',     label: 'Billing',       count: billingIssues.length,   color: '#c9302c' },
    { key: 'unpostables', label: 'Unpostables',   count: unpostables.length,     color: '#c9302c' },
    { key: 'labs',        label: 'Unrev. labs',   count: unreviewedLabs.length,  color: '#c9302c' },
    { key: 'balances',    label: 'Balances',       count: patientBalances.length, color: '#b45309' },
    { key: 'recalls',     label: 'Recalls',        count: recallPatients.length,  color: '#b45309' },
    { key: 'messages',    label: 'Messages',       count: portalMessages.length,  color: '#b45309' },
    { key: 'schedule',    label: 'Unconfirmed',    count: unconfirmed.filter(u => !u.contacted).length, color: '#c9302c' },
  ] as const

  const totalAtRisk = billingIssues.reduce((s, i) => s + i.dollarAtRisk, 0) +
    unpostables.reduce((s, i) => s + i.dollarAtRisk, 0) +
    patientBalances.reduce((s, i) => s + i.balance, 0)

  const urgentCount = billingIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length +
    unpostables.filter(i => i.severity === 'high').length +
    unreviewedLabs.filter(l => l.severity === 'high').length +
    portalMessages.filter(m => m.severity === 'high').length

  const totalIssues = tabs.reduce((s, t) => s + t.count, 0)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e2533', margin: 0, letterSpacing: '-0.02em' }}>Practice Pulse</h1>
          <span style={{ fontSize: '12px', color: '#9aa3b2', background: '#f1f3f7', padding: '2px 10px', borderRadius: '99px' }}>Last scan: 2:04am today</span>
        </div>
        <p style={{ fontSize: '13px', color: '#9aa3b2', margin: 0 }}>AI office manager — nightly scan across billing, unpostables, labs, balances, recalls, messages, and schedule.</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total issues', value: `${totalIssues}`, sub: 'Across all categories', accent: 'default' },
          { label: 'Revenue at risk', value: `$${totalAtRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: 'Billing + unpostables + balances', accent: 'danger' },
          { label: 'Needs action today', value: `${urgentCount}`, sub: 'Critical + high severity', accent: 'warning' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.accent === 'danger' ? '#fff5f5' : s.accent === 'warning' ? '#fffbf0' : '#fff', border: `1px solid ${s.accent === 'danger' ? '#ffe0e0' : s.accent === 'warning' ? '#fef3d0' : '#e4e8ef'}`, borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,21,32,0.05)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 4px', color: s.accent === 'danger' ? '#c9302c' : s.accent === 'warning' ? '#b45309' : '#1e2533' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '20px', background: '#f1f3f7', padding: '4px', borderRadius: '10px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: '7px 6px', fontSize: '11.5px', fontWeight: activeTab === tab.key ? '600' : '400', background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#1e2533' : '#6b7585', border: 'none', borderRadius: '7px', cursor: 'pointer', boxShadow: activeTab === tab.key ? '0 1px 3px rgba(15,21,32,0.08)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {tab.label}
            <span style={{ marginLeft: '4px', fontSize: '11px', fontWeight: '600', color: tab.color }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── BILLING ── */}
      {activeTab === 'billing' && (
        <div>
          <SectionHeader title="Billing issues" count={billingIssues.length} countVariant="red" subtitle="Claim holds, denials, eligibility failures, and aged AR" />
          {billingIssues.map(issue => (
            <IssueCard key={issue.id} severity={issue.severity}>
              <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: issue.severity === 'critical' || issue.severity === 'high' ? '#fff5f5' : '#fafbfc', borderBottom: '1px solid #f1f3f7' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: severityDot[issue.severity], flexShrink: 0 }} />
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e2533', flex: 1 }}>{issue.title}</span>
                {issue.dollarAtRisk > 0 && <span style={{ fontSize: '13px', fontWeight: '700', color: '#c9302c' }}>${issue.dollarAtRisk}</span>}
                <Badge label={issue.severity} variant={severityBadge[issue.severity]} />
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
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

      {/* ── UNPOSTABLES ── */}
      {activeTab === 'unpostables' && (
        <div>
          <SectionHeader
            title="Unpostable encounters"
            count={unpostables.length}
            countVariant="red"
            subtitle={`$${unpostables.reduce((s, u) => s + u.dollarAtRisk, 0).toFixed(0)} in unbilled revenue — encounters that cannot be claimed until fixed`}
          />
          {unpostables.map(u => {
            const sl = statusLabel[u.status]
            return (
              <IssueCard key={u.id} severity={u.severity}>
                <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: u.severity === 'high' ? '#fff5f5' : '#fffbf0', borderBottom: '1px solid #f1f3f7' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: severityDot[u.severity], flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e2533', flex: 1 }}>
                    {u.patient} — {u.encounterType}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', background: sl.bg, color: sl.color, padding: '2px 8px', borderRadius: '5px', fontWeight: '600' }}>{sl.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#c9302c' }}>${u.dollarAtRisk}</span>
                  <Badge label={`${u.daysOutstanding}d outstanding`} variant={u.daysOutstanding >= 3 ? 'red' : 'amber'} />
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Encounter: <strong style={{ fontFamily: 'DM Mono, monospace', color: '#333d4d' }}>{u.encounterId}</strong></span>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Date: <strong style={{ color: '#333d4d' }}>{u.encounterDate}</strong></span>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Payer: <strong style={{ color: '#333d4d' }}>{u.payer}</strong></span>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Block: <strong style={{ color: '#b45309' }}>{blockLabel[u.blockReason]}</strong></span>
                    <span style={{ fontSize: '12px', color: '#6b7585' }}>Filing deadline: <strong style={{ color: '#333d4d' }}>{u.filingDeadline}</strong></span>
                  </div>
                  <div style={{ padding: '10px 12px', background: '#f8f9fb', borderRadius: '7px', marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Why it's blocked</p>
                    <p style={{ fontSize: '12.5px', color: '#4a5366', margin: 0, lineHeight: '1.6' }}>{u.plainEnglish}</p>
                  </div>
                  <div style={{ padding: '10px 12px', background: '#f0f4ff', borderRadius: '7px', border: '1px solid #dce6ff' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#2d5de8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Exact fix</p>
                    <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0, lineHeight: '1.6' }}>{u.action}</p>
                  </div>
                  <ActionButtons />
                </div>
              </IssueCard>
            )
          })}
          <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f0f4ff', borderRadius: '10px', border: '1px solid #dce6ff' }}>
            <p style={{ fontSize: '12.5px', color: '#2d5de8', margin: 0, lineHeight: '1.5' }}>
              <strong>How unpostables are detected:</strong> Every night at 2am, PracticeCompanion pulls all encounters with status OPEN, REVIEW, or HOLD from Athena that are more than 24 hours old. Any encounter that should have been billed but hasn't appears here with a specific fix.
            </p>
          </div>
        </div>
      )}

      {/* ── LABS ── */}
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
                    <p style={{ fontSize: '12px', color: '#6b7585', margin: '0 0 8px' }}>Normal range: <strong style={{ color: '#333d4d' }}>{lab.normalRange}</strong></p>
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

      {/* ── BALANCES ── */}
      {activeTab === 'balances' && (
        <div>
          <SectionHeader title="Patient balances due today" count={patientBalances.length} countVariant="amber" subtitle={`$${patientBalances.reduce((s, b) => s + b.balance, 0).toFixed(0)} total collectible at check-in`} />
          <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,21,32,0.04)' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f3f7', background: '#fafbfc' }}>
                  {['Patient', 'Appt time', 'Balance', 'Days', 'Insurance', 'Action'].map((h, i) => (
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
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: b.daysOutstanding > 60 ? '#c9302c' : '#b45309' }}>{b.daysOutstanding}d</td>
                    <td style={{ padding: '12px 16px', color: '#6b7585' }}>{b.insurance}</td>
                    <td style={{ padding: '12px 16px' }}><button style={{ padding: '4px 12px', background: '#f0f4ff', color: '#2d5de8', fontSize: '12px', fontWeight: '500', borderRadius: '6px', border: '1px solid #dce6ff', cursor: 'pointer' }}>Collect at check-in</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid #e4e8ef', background: '#fafbfc' }}>
                  <td colSpan={2} style={{ padding: '10px 16px', fontWeight: '600', color: '#1e2533' }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: '#1a7a45' }}>${patientBalances.reduce((s, b) => s + b.balance, 0).toFixed(2)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── RECALLS ── */}
      {activeTab === 'recalls' && (
        <div>
          <SectionHeader title="Overdue recall patients" count={recallPatients.length} countVariant="amber" subtitle="Patients told to follow up who have not yet scheduled" />
          {recallPatients.map(r => (
            <IssueCard key={r.id} severity={r.severity}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ padding: '8px 12px', background: r.daysOverdue > 30 ? '#fff5f5' : '#fffbf0', borderRadius: '8px', textAlign: 'center', flexShrink: 0, minWidth: '70px' }}>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: r.daysOverdue > 30 ? '#c9302c' : '#b45309', margin: '0 0 2px' }}>{r.daysOverdue}</p>
                  <p style={{ fontSize: '11px', color: '#9aa3b2', margin: 0 }}>days over</p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e2533' }}>{r.patient}</span>
                    <span style={{ fontSize: '12px', color: '#9aa3b2' }}>Age {r.age}</span>
                    <Badge label={r.severity} variant={severityBadge[r.severity]} />
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: '#333d4d', margin: '0 0 8px' }}>{r.dueFor}</p>
                  <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '7px', border: '1px solid #dce6ff' }}>
                    <p style={{ fontSize: '12.5px', color: '#1e4acc', margin: 0 }}>{r.action}</p>
                  </div>
                  <ActionButtons />
                </div>
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* ── MESSAGES ── */}
      {activeTab === 'messages' && (
        <div>
          <SectionHeader title="Unanswered portal messages" count={portalMessages.length} countVariant="amber" subtitle="Patient messages awaiting provider response" />
          {portalMessages.map(msg => (
            <IssueCard key={msg.id} severity={msg.severity}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dce6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#2d5de8', flexShrink: 0 }}>
                    {msg.patient.split(' ').map((n: string) => n[0]).join('')}
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

      {/* ── UNCONFIRMED ── */}
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
                  <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0 }}>{appt.contacted ? 'Patient confirmed via portal' : 'No response to automated reminder — manual contact recommended'}</p>
                </div>
                <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                  <button style={{ padding: '7px 14px', background: '#2d5de8', color: '#fff', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>Call patient</button>
                  <button style={{ padding: '7px 14px', background: '#f0faf4', color: '#1a7a45', fontSize: '12px', fontWeight: '500', borderRadius: '7px', border: '1px solid #dcf4e8', cursor: 'pointer' }}>Mark confirmed</button>
                </div>
              </div>
            </IssueCard>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '24px', padding: '14px 18px', background: '#f8f9fb', borderRadius: '10px', border: '1px solid #e4e8ef' }}>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: '0 0 3px', fontWeight: '600' }}>How Practice Pulse works</p>
        <p style={{ fontSize: '12px', color: '#9aa3b2', margin: 0, lineHeight: '1.6' }}>
          Nightly at 2am, PracticeCompanion scans your Athena account across billing, unpostable encounters, lab results, patient balances, recall queues, portal messages, and appointment confirmations. All issues prioritized by dollar impact. Connected to live Athena data, this reflects your actual practice in real time.
        </p>
      </div>
    </div>
  )
}
EOF
echo "✓ app/(dashboard)/pulse/page.tsx (Unpostables tab added)"

echo ""
echo "✅ Phase 9 complete!"
echo ""
echo "Run this SQL in Supabase SQL editor:"
echo "  supabase/migrations/004_unpostables.sql"
echo ""
echo "Then: npm run dev — click Practice Pulse → Unpostables tab"
echo ""
echo "git add . && git commit -m 'Phase 9: Unpostables tab in Practice Pulse'"