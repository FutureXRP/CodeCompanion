import { MODULES, MODULE_BY_ID } from './modules'

/** The runtime override store (a cookie). Defined here (pure) so edge middleware can import it. */
export const FLAGS_COOKIE = 'cc_modules'

/** moduleId -> enabled. */
export type FlagMap = Record<string, boolean>

/** Every module at its registry default. */
export function defaultFlags(): FlagMap {
  const f: FlagMap = {}
  for (const m of MODULES) f[m.id] = m.defaultOn
  return f
}

/**
 * Resolve persisted overrides onto the defaults. Locked modules (only Admin) are
 * ALWAYS on regardless of any override — so you can always reach this panel and
 * re-enable anything. Every other module is fully toggleable.
 */
export function resolveFlags(overrides: Partial<FlagMap> = {}): FlagMap {
  const f = defaultFlags()
  for (const m of MODULES) {
    if (m.locked) { f[m.id] = true; continue }
    const v = overrides[m.id]
    if (typeof v === 'boolean') f[m.id] = v
  }
  return f
}

export function isEnabled(flags: FlagMap, id: string): boolean {
  return flags[id] !== false
}

/** Disabled (and non-locked) module ids — what the nav hides. */
export function disabledIds(flags: FlagMap): string[] {
  return MODULES.filter((m) => !m.locked && flags[m.id] === false).map((m) => m.id)
}

/** Parse the persisted overrides JSON defensively (cookie or DB). */
export function parseOverrides(raw: string | null | undefined): Partial<FlagMap> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: FlagMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean' && MODULE_BY_ID.has(k)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/** Serialize overrides (drop values equal to the module default + locked ones). */
export function serializeOverrides(flags: FlagMap): string {
  const out: FlagMap = {}
  for (const m of MODULES) {
    if (m.locked) continue
    if (flags[m.id] === false) out[m.id] = false
    else if (flags[m.id] === true && m.defaultOn === false) out[m.id] = true
  }
  return JSON.stringify(out)
}

export type PresetId = 'all' | 'rcm' | 'clinical'

/**
 * One-click configurations for the two integration shapes:
 * - `rcm` delegates the clinical modules to the EHR (CodeCompanion runs billing).
 * - `clinical` delegates billing to the EHR (e.g. Athena runs billing and won't
 *   permit a third-party biller), keeping CodeCompanion's clinical/intelligence.
 */
export const PRESETS: Record<PresetId, { label: string; desc: string }> = {
  all: { label: 'Everything on', desc: 'Enable every module.' },
  rcm: { label: 'Billing & RCM only', desc: 'Keep billing/RCM; turn off clinical modules (delegate them to your EHR).' },
  clinical: { label: 'Clinical only (EHR billing)', desc: 'Turn off billing & RCM — for when Athena (or your EHR) runs billing.' },
}

export function applyPreset(preset: PresetId): FlagMap {
  const f = defaultFlags()
  for (const m of MODULES) {
    if (m.locked) { f[m.id] = true; continue }
    if (preset === 'all') f[m.id] = true
    else if (preset === 'rcm') f[m.id] = m.group !== 'clinical'
    else f[m.id] = m.group !== 'billing' // 'clinical' — the EHR owns billing
  }
  return f
}
