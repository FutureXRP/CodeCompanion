/**
 * Module registry — the toggleable sections of the app, for the Admin control
 * panel. Grouped so the integration story is explicit: Billing & RCM are
 * CodeCompanion's own rails (keep on); the Clinical & intelligence modules are
 * "delegable" — turn them off when your EHR (e.g. Athena) already provides them.
 * A module id matches its nav href (minus the leading slash).
 */

export type ModuleGroup = 'core' | 'billing' | 'clinical' | 'system'

export interface ModuleDef {
  id: string
  label: string
  href: string
  group: ModuleGroup
  /** Cannot be turned off (system / the cockpit). */
  locked?: boolean
  /** Could be delegated to the EHR instead of CodeCompanion. */
  delegable?: boolean
  defaultOn: boolean
  desc: string
}

export const MODULE_GROUPS: { id: ModuleGroup; label: string; blurb: string }[] = [
  { id: 'core', label: 'Daily drivers', blurb: 'The office-manager cockpit.' },
  { id: 'billing', label: 'Billing & RCM', blurb: "CodeCompanion's own rails — keep these on even when Athena handles the rest." },
  { id: 'clinical', label: 'Clinical & intelligence', blurb: 'Delegable — turn off anything your EHR (e.g. Athena) already provides.' },
  { id: 'system', label: 'System', blurb: 'Always on.' },
]

export const MODULES: ModuleDef[] = [
  { id: 'command', label: 'Command Center', href: '/command', group: 'core', locked: true, defaultOn: true, desc: 'The revenue-cycle cockpit.' },
  { id: 'tasks', label: 'Follow-up Queue', href: '/tasks', group: 'core', defaultOn: true, desc: 'Owned, prioritized open work.' },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'core', defaultOn: true, desc: 'Practice overview.' },

  { id: 'eligibility', label: 'Eligibility', href: '/eligibility', group: 'billing', defaultOn: true, desc: 'Real-time 270/271 verification.' },
  { id: 'claims', label: 'Claims (RCM)', href: '/claims', group: 'billing', defaultOn: true, desc: '837 submission + lifecycle.' },
  { id: 'aging', label: 'A/R & Denials', href: '/aging', group: 'billing', defaultOn: true, desc: 'Aging + denial analytics.' },
  { id: 'billing', label: 'Patient Billing', href: '/billing', group: 'billing', defaultOn: true, desc: 'Statements + payments.' },
  { id: 'ledger', label: 'Patient Balances', href: '/ledger', group: 'billing', defaultOn: true, desc: 'The patient ledger.' },
  { id: 'found-money', label: 'Found Money', href: '/found-money', group: 'billing', defaultOn: true, desc: 'Underpayment / denial diff.' },
  { id: 'clearinghouse', label: 'Clearinghouse', href: '/clearinghouse', group: 'billing', defaultOn: true, desc: 'Stedi submission rail.' },
  { id: 'enrollments', label: 'Enrollments', href: '/enrollments', group: 'billing', defaultOn: true, desc: 'Payer transaction enrollment.' },
  { id: 'scrub', label: 'Scrubber', href: '/scrub', group: 'billing', defaultOn: true, desc: 'Pre-submission edits.' },

  { id: 'ehr', label: 'EHR Pull', href: '/ehr', group: 'clinical', delegable: true, defaultOn: true, desc: 'Pull encounters from the EHR.' },
  { id: 'coding', label: 'Coding', href: '/coding', group: 'clinical', delegable: true, defaultOn: true, desc: 'AI coding suggestions.' },
  { id: 'gaps', label: 'Care Gaps', href: '/gaps', group: 'clinical', delegable: true, defaultOn: true, desc: 'Care-gap revenue.' },
  { id: 'audit', label: 'Audit Shield', href: '/audit', group: 'clinical', delegable: true, defaultOn: true, desc: 'Coding-audit risk.' },
  { id: 'pulse', label: 'Practice Pulse', href: '/pulse', group: 'clinical', delegable: true, defaultOn: true, desc: 'Operational issues.' },
  { id: 'schedule', label: 'Schedule', href: '/schedule', group: 'clinical', delegable: true, defaultOn: true, desc: 'No-show risk.' },
  { id: 'analytics', label: 'Analytics', href: '/analytics', group: 'clinical', delegable: true, defaultOn: true, desc: 'Revenue analytics.' },
  { id: 'predict', label: 'Predict', href: '/predict', group: 'clinical', delegable: true, defaultOn: true, desc: 'Adjudication prediction (Rung 2).' },
  { id: 'corpus', label: 'Corpus', href: '/corpus', group: 'clinical', delegable: true, defaultOn: true, desc: 'De-identified behavior corpus.' },
  { id: 'upload', label: 'Upload & Test', href: '/upload', group: 'clinical', delegable: true, defaultOn: true, desc: 'Upload 837/835 to test.' },

  { id: 'admin', label: 'Admin', href: '/admin', group: 'system', locked: true, defaultOn: true, desc: 'Module control.' },
  { id: 'account', label: 'Account', href: '/account', group: 'system', locked: true, defaultOn: true, desc: 'Your account.' },
  { id: 'settings', label: 'Settings', href: '/settings', group: 'system', locked: true, defaultOn: true, desc: 'Settings.' },
]

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]))

/** Module id for a nav href ('/eligibility' -> 'eligibility'). */
export function moduleIdForHref(href: string): string {
  return href.replace(/^\//, '')
}
