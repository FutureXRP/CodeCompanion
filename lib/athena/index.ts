import { mockClient } from './mock-client'
import { realClient } from './client'
import type { AthenaClient } from './types'

export const athenaClient: AthenaClient =
  process.env.ATHENA_USE_MOCK === 'true' ? mockClient : realClient

export * from './types'
