/**
 * Module registry — the toggleable sections of the app, for the Admin control
 * panel. You own the backend: every module can be switched off except Admin,
 * which stays pinned so you can always get back to this panel. Modules are
 * grouped by role. Billing & RCM are CodeCompanion's rails — but an EHR like
 * Athena runs billing itself (and won't permit a third-party biller), so when
 * you integrate you turn that whole group off. Clinical & intelligence modules
 * are marked "delegable" for the same reason: turn off whatever your EHR already
 * provides. A module id matches its nav href (minus the leading slash).
 */

export type ModuleGroup = 'core' | 'billing' | 'clinical' | 'system'

export interface ModuleDef {
  id: string
  label: string
  href: string
  group: ModuleGroup
  /** Pinned on — only Admin, so you can always reach this panel. */
  locked?: boolean
  /** Your EHR may already provide this — safe to turn off / delegate. */
  delegable?: boolean
  defaultOn: boolean
  desc: string
}

export const MODULE_GROUPS: { id: ModuleGroup; label: string; blurb: string }[] = [
  { id: 'core', label: 'Daily drivers', blurb: 'The office-manager cockpit and overview.' },
  { id: 'billing', label: 'Billing & RCM', blurb: 'Turn these off when Athena (or your EHR) runs billing for you.' },
  { id: 'clinical', label: 'Clinical & intelligence', blurb: 'Turn off anything your EHR already provides.' },
  { id: 'system', label: 'System', blurb: 'Admin stays on so you can always get back here.' },
]

export const MODULES: ModuleDef[] = [
  { id: 'command', label: 'Command Center', href: '/command', group: 'core', defaultOn: true, desc: 'The revenue-cycle cockpit.' },
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

  { id: 'admin', label: 'Admin', href: '/admin', group: 'system', locked: true, defaultOn: true, desc: 'Module control (always on).' },
  { id: 'account', label: 'Account', href: '/account', group: 'system', defaultOn: true, desc: 'Your account.' },
  { id: 'settings', label: 'Settings', href: '/settings', group: 'system', defaultOn: true, desc: 'Settings.' },
]

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]))

/** Module id for a nav href ('/eligibility' -> 'eligibility'). */
export function moduleIdForHref(href: string): string {
  return href.replace(/^\//, '')
}
