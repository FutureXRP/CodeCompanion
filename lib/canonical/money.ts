/**
 * Money is represented as integer cents everywhere in the platform.
 * Never use floats for money math. See CLAUDE.md / DATA-MODEL.md.
 */
export type Cents = number

/**
 * Parse a decimal-dollar value (e.g. "108.50", "245.5", "175") into integer
 * cents. EDI carries amounts as decimal strings; this is the single chokepoint
 * that converts them to the canonical integer-cents representation.
 */
export function dollarsToCents(input: string | number): Cents {
  if (typeof input === 'number') {
    return Math.round(input * 100)
  }
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const value = Number(trimmed)
  if (Number.isNaN(value)) {
    throw new Error(`Cannot parse money value: "${input}"`)
  }
  return Math.round(value * 100)
}

/** Format integer cents as USD, e.g. 12050 -> "$120.50". */
export function formatCents(cents: Cents): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const remainder = abs % 100
  const body = `${whole.toLocaleString('en-US')}.${remainder.toString().padStart(2, '0')}`
  return `${negative ? '-' : ''}$${body}`
}
