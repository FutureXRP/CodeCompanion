import type { EhrEncounter } from '../ehr'
import { fhirBundleToEncounters } from './to-canonical'
import type { FhirBundle } from './types'

export * from './types'
export { fhirBundleToEncounters } from './to-canonical'

/**
 * Ingest a FHIR bundle into canonical EHR encounters. Pure: it normalizes a bundle
 * the caller already has. Pulling a bundle from a *real* FHIR endpoint moves PHI
 * and is gated by COMPLIANCE.md (ALLOW_REAL_PHI) at the fetch boundary — the mock
 * EHR (lib/mock-ehr) is synthetic and needs no gate.
 */
export function ingestFhirBundle(bundle: FhirBundle): EhrEncounter[] {
  return fhirBundleToEncounters(bundle)
}
