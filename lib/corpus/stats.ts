import type { CorpusStat } from './types'

/**
 * Distribution summary for a set of integer values (cents or days). Stores stats,
 * never the raw values — the corpus keeps "how the payer behaves", not the claims.
 * Deterministic and pure.
 */
export function distribution(values: number[]): CorpusStat {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return { n: 0, mean: 0, p25: 0, p50: 0, p75: 0, min: 0, max: 0 }
  const sum = sorted.reduce((s, v) => s + v, 0)
  const pct = (p: number): number => sorted[Math.min(n - 1, Math.round(p * (n - 1)))]
  return {
    n,
    mean: Math.round(sum / n),
    p25: pct(0.25),
    p50: pct(0.5),
    p75: pct(0.75),
    min: sorted[0],
    max: sorted[n - 1],
  }
}
