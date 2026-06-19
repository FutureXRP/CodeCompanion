/**
 * Corpus de-id demo. Shows (1) the one-way transform stripping PHI from real
 * canonical claims, and (2) the aggregate corpus with small-cell suppression.
 *   npm run corpus-demo
 */
import { loadSampleClaims, loadSampleRemittances } from '../lib/adapters/edi'
import { observe, aggregate, MIN_SAMPLE_N } from '../lib/corpus'
import { sampleObservations } from '../lib/corpus/sample'

const PHI = ['1EG4TE5MK73', 'DOE', 'JOHN', '19500101', 'PATIENT001', '20260115']

console.log('— De-identification gate —')
const obs = observe(loadSampleClaims(), loadSampleRemittances(), { region: 'OK', specialty: 'family_medicine' })
const serialized = JSON.stringify(obs)
const leaked = PHI.filter((p) => serialized.includes(p))
console.log(`observed ${obs.length} adjudicated lines from real claims`)
console.log(`PHI strings present in observations: ${leaked.length === 0 ? 'none ✓' : leaked.join(', ') + ' ✗'}`)

console.log(`\n— Behavioral corpus (suppression floor = ${MIN_SAMPLE_N}) —`)
const { rows, suppressed, observations } = aggregate(sampleObservations())
console.log(`${observations} observations → ${rows.length} cells published, ${suppressed} suppressed (too small)`)
for (const r of rows) {
  const days = r.daysToPayStat ? `${r.daysToPayStat.p50}d` : '—'
  console.log(
    `  ${r.payerExternalId} ${r.region} ${r.cptHcpcs} ${r.contractClass}: ` +
      `allowed≈$${(r.allowedStat.p50 / 100).toFixed(2)} paid≈$${(r.paidStat.p50 / 100).toFixed(2)} ` +
      `days≈${days} denial=${Math.round(r.denialRate * 100)}% (n=${r.sampleN})`,
  )
}
