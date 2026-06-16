import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Claim, Remittance } from '../../canonical'
import { parse837 } from './parse-837'
import { parse835 } from './parse-835'

/**
 * EDI adapter — the universal ingestion path (X12 837/835).
 *
 * Honors the COMPLIANCE.md mock-first gate: sample files are used unless
 * EDI_USE_SAMPLE_FILES=false AND ALLOW_REAL_PHI=true. Reaching for real claim
 * files while the gate is closed throws rather than flowing PHI.
 */

const SAMPLES_DIR = join(process.cwd(), 'lib', 'adapters', 'edi', 'samples')
const SAMPLE_837 = join(SAMPLES_DIR, 'claim_837_sample.edi')
const SAMPLE_835 = join(SAMPLES_DIR, 'remit_835_sample.edi')

function useSampleFiles(): boolean {
  return process.env.EDI_USE_SAMPLE_FILES !== 'false'
}

function assertPhiAllowed(): void {
  if (process.env.ALLOW_REAL_PHI !== 'true') {
    throw new Error(
      'EDI_USE_SAMPLE_FILES=false implies real claim data, but ALLOW_REAL_PHI is ' +
        'not true. Refusing to read real PHI until the COMPLIANCE.md gate is closed.',
    )
  }
}

// Pure-text mappers (no filesystem) — safe to call from any runtime.
export function parseClaimsFromText(raw: string): Claim[] {
  return parse837(raw)
}
export function parseRemittancesFromText(raw: string): Remittance[] {
  return parse835(raw)
}

export function loadClaimsFromFile(path: string): Claim[] {
  return parse837(readFileSync(path, 'utf8'))
}
export function loadRemittancesFromFile(path: string): Remittance[] {
  return parse835(readFileSync(path, 'utf8'))
}

export function loadSampleClaims(): Claim[] {
  return loadClaimsFromFile(SAMPLE_837)
}
export function loadSampleRemittances(): Remittance[] {
  return loadRemittancesFromFile(SAMPLE_835)
}

/** Default claim ingestion entry. */
export function loadClaims(): Claim[] {
  if (useSampleFiles()) return loadSampleClaims()
  assertPhiAllowed()
  const path = process.env.EDI_837_PATH
  if (!path) throw new Error('EDI_837_PATH is required when EDI_USE_SAMPLE_FILES=false')
  return loadClaimsFromFile(path)
}

/** Default remittance ingestion entry. */
export function loadRemittances(): Remittance[] {
  if (useSampleFiles()) return loadSampleRemittances()
  assertPhiAllowed()
  const path = process.env.EDI_835_PATH
  if (!path) throw new Error('EDI_835_PATH is required when EDI_USE_SAMPLE_FILES=false')
  return loadRemittancesFromFile(path)
}

export { parse837, parse835 }
