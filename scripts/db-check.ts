/**
 * Does the database enforce tenant isolation for the role the app connects as?
 *
 *   npm run db:check            # against DATABASE_URL (the app's runtime role)
 *
 * Prints the catalog facts (lib/db/isolation.ts) and every problem; exit 1 when
 * anything would stop row-level security from being load-bearing. With real PHI
 * allowed, lib/db/sql.ts runs the same check before the first transaction and
 * refuses to proceed until it is clean — this is the human-readable version.
 */
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()

import { getPool, closePool } from '../lib/db/sql'
import { isolationReport, isolationProblems } from '../lib/db/isolation'
import { phiHostingProblems } from '../lib/compliance/gate'

async function main(): Promise<void> {
  const client = await getPool().connect()
  try {
    const r = await isolationReport(client)
    console.log('CodeCompanion — database isolation check\n' + '─'.repeat(48))
    console.log(`  connected as:        ${r.role}${r.superuser ? '  (SUPERUSER)' : ''}${r.bypassRls ? '  (BYPASSRLS)' : ''}`)
    console.log(`  RLS tables:          ${r.rlsTables.length}`)
    console.log(`  forced:              ${r.rlsTables.length - r.unforcedTables.length} / ${r.rlsTables.length}`)
    console.log(`  owned by this role:  ${r.ownedTables.length}`)
    console.log(`  without any policy:  ${r.policylessTables.length}`)
    console.log(`  service context:     ${r.serviceContext ? 'app_is_service() present' : 'MISSING'}`)
    const problems = isolationProblems(r)
    const hosting = process.env.ALLOW_REAL_PHI === 'true' ? phiHostingProblems() : []
    console.log('')
    if (problems.length === 0 && hosting.length === 0) {
      console.log('  ✓ isolation is enforced for this connection' + (process.env.ALLOW_REAL_PHI === 'true' ? ' and the deployment is safe for real PHI.' : '.'))
      return
    }
    for (const p of problems) console.log(`  ✗ ${p}`)
    for (const p of hosting) console.log(`  ✗ ${p}`)
    process.exitCode = 1
  } finally {
    client.release()
    await closePool()
  }
}

main().catch((e) => {
  console.error('db:check failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
