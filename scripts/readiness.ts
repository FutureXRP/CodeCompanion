/**
 * Print the go-live readiness checklist.
 *   npm run readiness
 * Reflects the current environment + the code-side compliance state. Exit code 1
 * while any required check is unmet, so it can gate a deploy.
 */
import { goLiveReadiness } from '../lib/config/readiness'

const r = goLiveReadiness()
const mark = (s: string) => (s === 'pass' ? '✓' : s === 'fail' ? '✗' : '○')

console.log('\nCodeCompanion — go-live readiness\n' + '─'.repeat(48))
for (const c of r.checks) {
  const req = c.required ? '' : '  (optional)'
  console.log(`  ${mark(c.status)} ${c.label}${req}`)
  if (c.status !== 'pass') console.log(`      → ${c.detail}`)
}
console.log('─'.repeat(48))
console.log(`  Automated checks: ${r.automatedPass ? 'PASS' : 'incomplete'}`)
console.log(`  Blockers: ${r.blockers.length === 0 ? 'none' : r.blockers.map((b) => b.id).join(', ')}`)
console.log(`  GO-LIVE: ${r.ready ? 'READY' : 'NOT READY — resolve blockers above'}\n`)

process.exit(r.ready ? 0 : 1)
