import type { Queryable } from './sql'

/**
 * Does the database actually enforce tenant isolation? Postgres exempts a
 * table's owner from row-level security unless the table is FORCED, and a role
 * with BYPASSRLS or superuser skips it entirely — so policies alone prove
 * nothing. This reads the catalog and says whether RLS is load-bearing for the
 * role the app is connected as. With real PHI allowed, lib/db/sql.ts refuses to
 * run any tenant or service transaction until this is clean; `npm run db:check`
 * prints the same report for a human.
 */

export interface IsolationReport {
  /** The role the app is connected as. */
  role: string
  superuser: boolean
  bypassRls: boolean
  /** Every RLS-enabled table in `public`. */
  rlsTables: string[]
  /** RLS-enabled tables without FORCE ROW LEVEL SECURITY (the owner is exempt on these). */
  unforcedTables: string[]
  /** RLS-enabled tables the runtime role owns (an owner can disable RLS at will). */
  ownedTables: string[]
  /** RLS-enabled tables with no policy at all (unreachable for everyone once forced). */
  policylessTables: string[]
  /** app_is_service() exists — the service context for the bootstrap paths (migration 014). */
  serviceContext: boolean
}

interface WhoRow { role: string; superuser: boolean; bypassrls: boolean }
interface TableRow { name: string; forced: boolean; owned: boolean; has_policy: boolean }

export async function isolationReport(db: Queryable): Promise<IsolationReport> {
  const who = (await db.query(
    `select current_user::text as role, r.rolsuper as superuser, r.rolbypassrls as bypassrls
       from pg_roles r where r.rolname = current_user`,
  )).rows[0] as WhoRow | undefined
  const tables = (await db.query(
    `select c.relname::text as name,
            c.relforcerowsecurity as forced,
            (c.relowner = (select oid from pg_roles where rolname = current_user)) as owned,
            exists (select 1 from pg_policy p where p.polrelid = c.oid) as has_policy
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      order by c.relname`,
  )).rows as TableRow[]
  const fn = await db.query(
    `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'app_is_service'`,
  )
  return {
    role: who?.role ?? 'unknown',
    superuser: Boolean(who?.superuser),
    bypassRls: Boolean(who?.bypassrls),
    rlsTables: tables.map((t) => t.name),
    unforcedTables: tables.filter((t) => !t.forced).map((t) => t.name),
    ownedTables: tables.filter((t) => t.owned).map((t) => t.name),
    policylessTables: tables.filter((t) => !t.has_policy).map((t) => t.name),
    serviceContext: fn.rows.length > 0,
  }
}

/** What stops RLS from being load-bearing for this connection. Empty = enforced. */
export function isolationProblems(r: IsolationReport): string[] {
  const p: string[] = []
  if (r.rlsTables.length === 0) p.push('no row-level-security tables found — wrong database, or the migrations have not been applied (npm run db:migrate)')
  if (r.superuser) p.push(`the runtime role ${r.role} is a superuser — row-level security never applies to it`)
  if (r.bypassRls) p.push(`the runtime role ${r.role} has BYPASSRLS — row-level security never applies to it`)
  if (r.unforcedTables.length > 0) p.push(`row-level security is not forced on ${r.unforcedTables.length} table(s) (${list(r.unforcedTables)}) — apply migration 014`)
  if (!r.serviceContext) p.push('app_is_service() is missing — apply migration 014')
  if (r.policylessTables.length > 0) p.push(`${r.policylessTables.length} RLS table(s) have no policy (${list(r.policylessTables)}) — apply migration 014`)
  if (r.ownedTables.length > 0) p.push(`the runtime role ${r.role} owns ${r.ownedTables.length} RLS table(s) — an owner can switch RLS off; connect the app as a member of codecompanion_app and keep the owner for migrations only (COMPLIANCE.md, "Database isolation")`)
  return p
}

function list(names: string[]): string {
  return names.length <= 6 ? names.join(', ') : `${names.slice(0, 6).join(', ')}, …`
}

/** Throws, with every reason, unless isolation is enforced for this connection. */
export async function assertIsolationEnforced(db: Queryable): Promise<IsolationReport> {
  const report = await isolationReport(db)
  const problems = isolationProblems(report)
  if (problems.length > 0) {
    throw new Error(`Refusing to touch real patient data — the database does not enforce tenant isolation for this connection: ${problems.join('; ')}.`)
  }
  return report
}
