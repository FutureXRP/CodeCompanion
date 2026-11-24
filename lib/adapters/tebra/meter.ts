/**
 * The monthly API call meter. Tebra confirmed (Nov 2026) that the practice
 * tier includes the Web Services API for up to 10,000 calls a month. Every
 * attempt the live client sends is counted here; non-essential callers (the
 * pages) are refused once the month's count reaches the budget minus a reserve
 * kept for the nightly sync, which runs as `essential` and may use the reserve.
 *
 * The count is per process (a Cloud Run instance) — a tripwire, not a ledger;
 * the read-through cache (cache.ts) is what keeps real usage low. Month rolls
 * over on the UTC calendar month.
 */

export interface MeterSnapshot {
  /** YYYY-MM (UTC). */
  month: string
  calls: number
  budget: number
  reserve: number
  byOperation: Record<string, number>
  essentialActive: boolean
}

export class TebraBudgetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TebraBudgetError'
  }
}

export interface MeterOptions {
  /** Calls allowed per month (the account's cap). */
  budget: number
  /** Calls held back for essential work (the nightly sync). */
  reserve: number
  now?: () => Date
}

export class TebraCallMeter {
  private month = ''
  private calls = 0
  private byOperation: Record<string, number> = {}
  private essentialDepth = 0
  private readonly now: () => Date

  constructor(private readonly opts: MeterOptions) {
    this.now = opts.now ?? (() => new Date())
  }

  private rollover(): void {
    const month = this.now().toISOString().slice(0, 7)
    if (month !== this.month) {
      this.month = month
      this.calls = 0
      this.byOperation = {}
    }
  }

  /** Count one request attempt, or refuse it when the month's budget is spent. */
  record(operation: string): void {
    this.rollover()
    const essential = this.essentialDepth > 0
    const limit = essential ? this.opts.budget : Math.max(0, this.opts.budget - this.opts.reserve)
    if (this.calls >= limit) {
      throw new TebraBudgetError(
        `Tebra API monthly budget: ${this.calls} of ${this.opts.budget} calls used in ${this.month}` +
          (essential ? '' : ` (${this.opts.reserve} held in reserve for the nightly sync)`) +
          ' — the pages read the cache until the month rolls over. Raise TEBRA_MONTHLY_CALL_BUDGET only if Tebra raised the cap.',
      )
    }
    this.calls += 1
    this.byOperation[operation] = (this.byOperation[operation] ?? 0) + 1
  }

  /** Run `fn` with access to the reserve (the sync). Nested calls are fine. */
  async essential<T>(fn: () => Promise<T>): Promise<T> {
    this.essentialDepth += 1
    try {
      return await fn()
    } finally {
      this.essentialDepth -= 1
    }
  }

  snapshot(): MeterSnapshot {
    this.rollover()
    return {
      month: this.month,
      calls: this.calls,
      budget: this.opts.budget,
      reserve: this.opts.reserve,
      byOperation: { ...this.byOperation },
      essentialActive: this.essentialDepth > 0,
    }
  }

  /** Tests. */
  reset(): void {
    this.month = ''
    this.calls = 0
    this.byOperation = {}
  }
}

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function meterFromEnv(env: Record<string, string | undefined> = process.env): TebraCallMeter {
  const budget = positive(env.TEBRA_MONTHLY_CALL_BUDGET, 10_000) || 10_000
  const reserve = Math.min(positive(env.TEBRA_CALL_RESERVE, 1_000), budget)
  return new TebraCallMeter({ budget, reserve })
}

/** The process-wide meter every live client shares. */
export const tebraCallMeter = meterFromEnv()

/** Mark a stretch of work (the sync) as essential: it may use the reserve. */
export function withEssentialCalls<T>(fn: () => Promise<T>): Promise<T> {
  return tebraCallMeter.essential(fn)
}
