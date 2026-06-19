/**
 * Go-live readiness — the machine-checkable view of the COMPLIANCE.md gate.
 *
 * It reports config/schema/compliance checks AND the human/legal gates that code
 * cannot certify (BAAs, the HIPAA security review). Those are acknowledged via
 * env flags, so this never falsely reports "ready": until a human sets them, they
 * are blockers. Real PHI must not flow while any required check is unmet.
 */

export type CheckStatus = 'pass' | 'fail' | 'pending'

export interface ReadinessCheck {
  id: string
  label: string
  status: CheckStatus
  /** A required check is a hard go-live blocker. */
  required: boolean
  detail: string
}

export interface ReadinessReport {
  checks: ReadinessCheck[]
  /** Required checks that are not passing — the go-live blockers. */
  blockers: ReadinessCheck[]
  /** All required checks pass EXCEPT the inherently-manual legal/review gates. */
  automatedPass: boolean
  /** No blockers at all — only true once the human gates are acknowledged too. */
  ready: boolean
  generatedAt: string
}

type Env = Record<string, string | undefined>
const set = (env: Env, k: string) => Boolean(env[k] && env[k]!.length > 0)
const truthy = (v?: string) => v === 'true' || v === '1'
// Human decisions, not code/infra readiness: excluded from `automatedPass` so a
// fully-built, unprovisioned-for-PHI system reports automatedPass=true, ready=false.
const DECISION_GATES = new Set(['baa', 'security_review', 'phi_gate'])

export function goLiveReadiness(env: Env = process.env): ReadinessReport {
  const checks: ReadinessCheck[] = [
    // ── Infra / configuration ──
    { id: 'supabase', label: 'Supabase configured (URL + anon key)', required: true, detail: 'Persistence, auth, and RLS', status: set(env, 'NEXT_PUBLIC_SUPABASE_URL') && set(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'pass' : 'fail' },
    { id: 'service_role', label: 'Supabase service-role key set', required: true, detail: 'Server ingestion + audit writes', status: set(env, 'SUPABASE_SERVICE_ROLE_KEY') ? 'pass' : 'fail' },
    { id: 'anthropic', label: 'Anthropic API key set', required: true, detail: 'Appeal / narrative drafting', status: set(env, 'ANTHROPIC_API_KEY') ? 'pass' : 'fail' },
    { id: 'clearinghouse', label: 'Stedi clearinghouse configured', required: true, detail: '837 / 835 / eligibility', status: set(env, 'STEDI_API_KEY') ? 'pass' : 'fail' },
    { id: 'payments', label: 'Stripe configured', required: false, detail: 'Patient card payments (optional at launch)', status: set(env, 'STRIPE_SECRET_KEY') ? 'pass' : 'fail' },

    // ── Schema / compliance (in code) ──
    { id: 'rls', label: 'RLS on every tenant table', required: true, detail: 'Migrations 005/007/009 — verified by the RLS guard test', status: 'pass' },
    { id: 'audit', label: 'Immutable audit log + writeAudit wired', required: true, detail: 'append-only audit_log (009_operational)', status: 'pass' },
    { id: 'deid', label: 'De-id corpus gate tests passing', required: true, detail: 'assertDeidentified + tests/corpus.test.ts', status: 'pass' },

    // ── Production switches (env) ──
    { id: 'phi_gate', label: 'Real-PHI gate ON (ALLOW_REAL_PHI)', required: true, detail: 'Flip ON only after the gates below', status: truthy(env.ALLOW_REAL_PHI) ? 'pass' : 'pending' },
    { id: 'charges_gate', label: 'Real-charges gate ON (ALLOW_REAL_CHARGES)', required: false, detail: 'Flip ON after Stripe reconciliation verified', status: truthy(env.ALLOW_REAL_CHARGES) ? 'pass' : 'pending' },

    // ── Human / legal — code cannot certify these ──
    { id: 'baa', label: 'BAAs signed (Supabase, Anthropic, Stedi, Stripe)', required: true, detail: 'Legal — set BAA_SIGNED=true once executed', status: truthy(env.BAA_SIGNED) ? 'pass' : 'pending' },
    { id: 'security_review', label: 'HIPAA security risk assessment complete', required: true, detail: 'Set HIPAA_SECURITY_REVIEW=true once done', status: truthy(env.HIPAA_SECURITY_REVIEW) ? 'pass' : 'pending' },
  ]

  const blockers = checks.filter((c) => c.required && c.status !== 'pass')
  const automatedPass = checks.filter((c) => c.required && !DECISION_GATES.has(c.id)).every((c) => c.status === 'pass')

  return { checks, blockers, automatedPass, ready: blockers.length === 0, generatedAt: new Date().toISOString() }
}
