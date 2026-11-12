import { isLoginRequired } from '../db/config'

/**
 * The real-PHI gate, as code (COMPLIANCE.md).
 *
 * ALLOW_REAL_PHI=true is the master switch, but it is honored only on a
 * deployment real patient data may live on. Every path that would move real
 * data — the live Tebra / athena clients, the real 837/835 file loaders, the
 * appeal drafter (which sends claim details to the model), the sync — asks here
 * first, and refuses with the exact reason otherwise. Deterministic, env-only,
 * importable anywhere (no I/O).
 */

type Env = Record<string, string | undefined>

/** Why this deployment must not hold real PHI even with the switch on. Empty = safe. */
export function phiHostingProblems(env: Env = process.env): string[] {
  const problems: string[] = []
  if (env.VERCEL) {
    problems.push('this is the Vercel demo host, which has no BAA — real PHI runs only on the BAA-covered host (Cloud Run + Neon, DEPLOY.md)')
  }
  if (env.BAA_SIGNED !== 'true') {
    problems.push('BAA_SIGNED is not true — every vendor in the PHI path needs a signed BAA first (GO-LIVE.md)')
  }
  if (env.HIPAA_SECURITY_REVIEW !== 'true') {
    problems.push('HIPAA_SECURITY_REVIEW is not true — the security risk assessment comes first (GO-LIVE.md)')
  }
  const url = env.DATABASE_URL
  if (url && !/[?&]sslmode=require\b/.test(url) && !/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    problems.push('DATABASE_URL does not require TLS — add sslmode=require')
  }
  if (env.PG_SSL_STRICT === 'false') {
    problems.push('PG_SSL_STRICT=false turns off database certificate verification')
  }
  if (!isLoginRequired(env)) {
    // Unreachable while ALLOW_REAL_PHI=true forces the login gate on; kept as a tripwire.
    problems.push('the staff-login gate is off')
  }
  return problems
}

/** Real PHI may flow: the switch is on AND the deployment is safe for it. */
export function realPhiAllowed(env: Env = process.env): boolean {
  return env.ALLOW_REAL_PHI === 'true' && phiHostingProblems(env).length === 0
}

/** The refusal message for `what`, or null when real PHI is allowed. */
export function realPhiRefusal(what: string, env: Env = process.env): string | null {
  if (env.ALLOW_REAL_PHI !== 'true') {
    return `${what} moves real patient data — refused: ALLOW_REAL_PHI is not true (COMPLIANCE.md). Keep the mock / sample data until the gate is closed.`
  }
  const problems = phiHostingProblems(env)
  if (problems.length === 0) return null
  return `${what} refused — ALLOW_REAL_PHI is true but this deployment is not safe for real patient data (COMPLIANCE.md): ${problems.join('; ')}.`
}

export function assertRealPhiAllowed(what: string, env: Env = process.env): void {
  const refusal = realPhiRefusal(what, env)
  if (refusal) throw new Error(refusal)
}
