import type { Claim } from '@/lib/canonical'
import { createAthenaSource, athenaConfigFromEnv, pullAthenaEncounters } from '@/lib/adapters/athena'
import { encounterToClaim } from '@/lib/adapters/ehr'
import { EncounterSandbox } from '@/components/ehr/EncounterSandbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The athena sandbox: pull fake encounters, edit the codes, and run the whole claim
 * lifecycle interactively — 837 out, scrub, 835/ERA back (the payer's EOB), and the
 * found-money diff. Mock athena source in the hosted app; real Preview locally.
 */
export default async function SandboxPage() {
  let claims: Claim[] = []
  try {
    const encs = await pullAthenaEncounters(createAthenaSource(athenaConfigFromEnv()), { serviceDateFrom: new Date().toISOString().slice(0, 10) })
    claims = encs.map((e) => encounterToClaim(e, 'athena'))
  } catch {
    /* leave empty — the component shows a friendly message */
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1f2d27', margin: '0 0 4px', letterSpacing: '-0.02em' }}>athena Sandbox</h1>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px', maxWidth: 760, lineHeight: 1.55 }}>
        Pick a fake athena patient, edit the codes on the encounter, and submit it. You&apos;ll watch the whole claim
        lifecycle run live: the <strong>837</strong> that goes out, the <strong>scrub</strong>, the <strong>835 / ERA</strong> the
        payer sends back (the electronic EOB), and any <strong>found money</strong>. Change a CPT, a modifier, or a charge and
        re-submit to see the adjudication move. Synthetic data — no PHI.
      </p>
      <EncounterSandbox claims={claims} />
    </div>
  )
}
