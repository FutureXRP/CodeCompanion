import Anthropic from '@anthropic-ai/sdk'

/**
 * Lazy Anthropic client (Layer 7 — language tasks ONLY, never money math).
 * Returns null when no API key is configured, so callers fall back to a
 * deterministic offline path. See ARCHITECTURE.md Layer 7 / COMPLIANCE.md.
 */
let cached: Anthropic | null | undefined

export function getAnthropicClient(): Anthropic | null {
  if (cached !== undefined) return cached
  const apiKey = process.env.ANTHROPIC_API_KEY
  cached = apiKey ? new Anthropic({ apiKey }) : null
  return cached
}

/** Default to the most capable model; override per COMPLIANCE/cost via env. */
export const APPEAL_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
