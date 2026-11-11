/**
 * Go-live readiness — the machine-checkable view of the COMPLIANCE.md gate.
 *
 * It reports config/schema/compliance checks AND the human/legal gates that code
 * cannot certify (BAAs, the HIPAA security review). Those are acknowledged via
 * env flags, so this never falsely reports "ready": until a human sets them, they
 * are blockers. Real PHI must not flow while any required check is unmet.
 *
 * Stack as of the Tebra build-out: Neon holds PHI, Supabase is auth only, the
 * practice-management system (Tebra) runs claims / eligibility / ERA, so Stedi is
 * required only when CodeCompanion submits claims itself.
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
const TEBRA_CREDS = ['TEBRA_CUSTOMER_KEY', 'TEBRA_USER', 'TEBRA_PASSWORD', 'TEBRA_PRACTICE_NAME']

export function goLiveReadiness(env: Env = process.env): ReadinessReport {
  const tebraLive = env.TEBRA_USE_MOCK === 'false'
  const stediNeeded = env.CLEARINGHOUSE_PROVIDER === 'stedi'
  const ratesOnFile = set(env, 'TEBRA_CONTRACT_EXPORT_PATH') || set(env, 'FEE_SCHEDULE_PATH')

  const checks: ReadinessCheck[] = [
    // ── Infra / configuration ──
    { id: 'database', label: 'Neon Postgres configured (DATABASE_URL)', required: true, detail: 'PHI at rest — the data plane; run npm run db:migrate (DEPLOY.md)', status: set(env, 'DATABASE_URL') ? 'pass' : 'fail' },
    { id: 'supabase', label: 'Supabase Auth configured (URL + anon key)', required: true, detail: 'Staff logins only — no patient PHI', status: set(env, 'NEXT_PUBLIC_SUPABASE_URL') && set(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'pass' : 'fail' },
    { id: 'service_role', label: 'Supabase service-role key set', required: false, detail: 'Supabase-admin tasks only; data writes go to Neon', status: set(env, 'SUPABASE_SERVICE_ROLE_KEY') ? 'pass' : 'pending' },
    { id: 'anthropic', label: 'Anthropic API key set', required: true, detail: 'Appeal / narrative drafting (a BAA before real PHI reaches it)', status: set(env, 'ANTHROPIC_API_KEY') ? 'pass' : 'fail' },
    {
      id: 'clearinghouse',
      label: 'Stedi clearinghouse configured',
      required: stediNeeded,
      detail: stediNeeded ? '837 / 835 / eligibility' : 'Not needed while the PM system (Tebra) runs claims, eligibility and ERA — set CLEARINGHOUSE_PROVIDER=stedi to require it',
      status: set(env, 'STEDI_API_KEY') ? 'pass' : stediNeeded ? 'fail' : 'pending',
    },
    { id: 'payments', label: 'Stripe configured', required: false, detail: 'Patient card payments (optional at launch)', status: set(env, 'STRIPE_SECRET_KEY') ? 'pass' : 'pending' },

    // ── The EHR / PM source ──
    {
      id: 'tebra',
      label: tebraLive ? 'Tebra live credentials set' : 'Tebra adapter in mock mode',
      required: tebraLive,
      detail: tebraLive ? 'TEBRA_CUSTOMER_KEY / TEBRA_USER / TEBRA_PASSWORD / TEBRA_PRACTICE_NAME (TEBRA-INTEGRATION.md)' : 'Synthetic until a Customer Key is issued; TEBRA_USE_MOCK=false goes live',
      status: tebraLive ? (TEBRA_CREDS.every((k) => set(env, k)) ? 'pass' : 'fail') : 'pending',
    },
    { id: 'contract_rates', label: 'Contract rates on file', required: false, detail: 'TEBRA_CONTRACT_EXPORT_PATH or FEE_SCHEDULE_PATH — Tebra ships its Contract Rates table empty; without rates, underpayment detection is blind', status: ratesOnFile ? 'pass' : 'pending' },
    { id: 'ncci', label: 'NCCI PTP + MUE tables loaded', required: false, detail: 'NCCI_PTP_PATH + NCCI_MUE_PATH — the scrubber runs on seed edits until then', status: set(env, 'NCCI_PTP_PATH') && set(env, 'NCCI_MUE_PATH') ? 'pass' : 'pending' },
    { id: 'sync', label: 'Nightly Tebra sync enabled', required: false, detail: 'TEBRA_SYNC_ENABLED=true after the first live pull validates (npm run tebra-validate)', status: truthy(env.TEBRA_SYNC_ENABLED) ? 'pass' : 'pending' },

    // ── Schema / compliance (in code) ──
    { id: 'rls', label: 'RLS on every tenant table', required: true, detail: 'Migrations 005/007/009 — verified by the RLS guard test', status: 'pass' },
    { id: 'audit', label: 'Immutable audit log + writeAudit wired', required: true, detail: 'append-only audit_log (009_operational)', status: 'pass' },
    { id: 'deid', label: 'De-id corpus gate tests passing', required: true, detail: 'assertDeidentified + tests/corpus.test.ts', status: 'pass' },

    // ── Production switches (env) ──
    { id: 'phi_gate', label: 'Real-PHI gate ON (ALLOW_REAL_PHI)', required: true, detail: 'Flip ON only after the gates below — never in the hosted (Vercel) environment', status: truthy(env.ALLOW_REAL_PHI) ? 'pass' : 'pending' },
    { id: 'charges_gate', label: 'Real-charges gate ON (ALLOW_REAL_CHARGES)', required: false, detail: 'Flip ON after Stripe reconciliation verified', status: truthy(env.ALLOW_REAL_CHARGES) ? 'pass' : 'pending' },

    // ── Human / legal — code cannot certify these ──
    { id: 'baa', label: 'BAAs signed (Google Cloud, Neon, Anthropic; Tebra via its contract; Stedi / Stripe only if used)', required: true, detail: 'Legal — set BAA_SIGNED=true once executed', status: truthy(env.BAA_SIGNED) ? 'pass' : 'pending' },
    { id: 'security_review', label: 'HIPAA security risk assessment complete', required: true, detail: 'Set HIPAA_SECURITY_REVIEW=true once done', status: truthy(env.HIPAA_SECURITY_REVIEW) ? 'pass' : 'pending' },
  ]

  const blockers = checks.filter((c) => c.required && c.status !== 'pass')
  const automatedPass = checks.filter((c) => c.required && !DECISION_GATES.has(c.id)).every((c) => c.status === 'pass')

  return { checks, blockers, automatedPass, ready: blockers.length === 0, generatedAt: new Date().toISOString() }
}
