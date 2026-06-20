import type { EhrEncounter } from '../ehr'
import { athenaBundleToEhrEncounter } from './to-canonical'
import { MockAthenaSource } from './mock'
import { AthenaClient, type HttpTransport } from './client'
import type { AthenaSource, AthenaEncounterQuery } from './types'

export * from './types'
export * from './client'
export * from './mock'
export { athenaBundleToEhrEncounter, athenaDate } from './to-canonical'

/**
 * The athenahealth adapter — pull clinical encounters + charges from athena and
 * normalize them into the canonical model, so CodeCompanion's own rails (Stedi)
 * do eligibility/claims. Mock-first, like every adapter: the real client moves
 * real PHI and is gated behind ALLOW_REAL_PHI (COMPLIANCE.md).
 */

export interface AthenaConfig {
  /** Default true — synthetic mock. Set false (ATHENA_USE_MOCK=false) for the real client. */
  useMock?: boolean
  allowRealPhi?: boolean
  clientId?: string
  clientSecret?: string
  practiceId?: string
  baseUrl?: string
  /** Injectable for tests. */
  transport?: HttpTransport
}

export function createAthenaSource(config: AthenaConfig = {}): AthenaSource {
  if (config.useMock !== false) return new MockAthenaSource()
  if (!config.allowRealPhi) {
    throw new Error(
      'Athena live integration pulls real patient data from athenahealth — gated by COMPLIANCE.md. ' +
        'Set allowRealPhi=true (ALLOW_REAL_PHI) only after a BAA with athenahealth. Keep ATHENA_USE_MOCK=true for synthetic testing.',
    )
  }
  if (!config.clientId || !config.clientSecret || !config.practiceId) {
    throw new Error('Athena live integration requires ATHENA_CLIENT_ID, ATHENA_CLIENT_SECRET, and ATHENA_PRACTICE_ID.')
  }
  return new AthenaClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    practiceId: config.practiceId,
    baseUrl: config.baseUrl,
    transport: config.transport,
  })
}

export function athenaConfigFromEnv(): AthenaConfig {
  return {
    useMock: process.env.ATHENA_USE_MOCK !== 'false', // must explicitly opt into the real client
    allowRealPhi: process.env.ALLOW_REAL_PHI === 'true',
    clientId: process.env.ATHENA_CLIENT_ID,
    clientSecret: process.env.ATHENA_CLIENT_SECRET,
    practiceId: process.env.ATHENA_PRACTICE_ID,
    baseUrl: process.env.ATHENA_BASE_URL || undefined,
  }
}

/** Pull a day's encounters from Athena, normalized to canonical EhrEncounters. */
export async function pullAthenaEncounters(source: AthenaSource, query: AthenaEncounterQuery): Promise<EhrEncounter[]> {
  return (await source.getEncounterBundles(query)).map(athenaBundleToEhrEncounter)
}
