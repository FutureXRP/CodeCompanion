import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Load .env.local (KEY=VALUE lines) into process.env for standalone scripts.
 * The Next.js app reads .env.local automatically; plain tsx scripts do not, so
 * the migrate/pull scripts call this to share the same single source of config.
 *
 * - Existing process.env always wins (so Cloud Run / CI / inline vars override).
 * - Split on the FIRST '=' so values containing '=' (…?sslmode=require) survive.
 * - Strips one layer of surrounding quotes; ignores blanks and # comments.
 */
export function loadEnvLocal(file = path.join(process.cwd(), '.env.local')): void {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (key && !(key in process.env)) process.env[key] = val
  }
}
