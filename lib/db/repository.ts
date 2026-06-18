import type { SupabaseClient } from '@supabase/supabase-js'
import type { Claim, Finding, Remittance } from '../canonical'
import {
  toAdjustmentRow,
  toClaimLineRow,
  toClaimRow,
  toFindingRow,
  toRemittanceLineRow,
  toRemittanceRow,
  lineMatchKey,
} from './mappers'

/**
 * Persistence repository. Writes a canonical found-money run into the normalized
 * tables and reads findings back. Works with any Supabase client: the authed
 * client (RLS enforces the tenant) or the service client (server ingestion).
 * Money stays integer cents; tenant isolation is the schema's job (RLS).
 */

export interface PersistResult {
  tenantId: string
  claims: number
  claimLines: number
  remittances: number
  findings: number
}

/** Find-or-create a tenant by name (single-practice bootstrap). */
export async function ensureTenant(db: SupabaseClient, name: string): Promise<string> {
  const found = await db.from('tenants').select('id').eq('name', name).limit(1).maybeSingle()
  if (found.error) throw found.error
  if (found.data) return found.data.id as string
  const created = await db.from('tenants').insert({ name }).select('id').single()
  if (created.error) throw created.error
  return created.data.id as string
}

/** Find-or-create a payer in the shared catalog by its external EDI id. */
export async function ensurePayer(db: SupabaseClient, externalId: string, name: string): Promise<string> {
  const found = await db.from('payers').select('id').eq('payer_id_external', externalId).limit(1).maybeSingle()
  if (found.error) throw found.error
  if (found.data) return found.data.id as string
  const created = await db.from('payers').insert({ name, payer_id_external: externalId }).select('id').single()
  if (created.error) throw created.error
  return created.data.id as string
}

/**
 * Persist a full run: claims + lines, remittances + lines + adjustments, and the
 * diff findings — wiring foreign keys as it goes. Findings reference the claim
 * line they were detected on, matched via the canonical line id.
 */
export async function persistRun(
  db: SupabaseClient,
  tenantId: string,
  input: { claims: Claim[]; remittances: Remittance[]; findings: Finding[] },
): Promise<PersistResult> {
  // 1. Payers (shared catalog)
  const payerIds = new Map<string, string>()
  for (const c of input.claims) {
    if (!payerIds.has(c.payer.externalId)) {
      payerIds.set(c.payer.externalId, await ensurePayer(db, c.payer.externalId, c.payer.name))
    }
  }

  // 2. Claims + claim lines
  const claimIdByControl = new Map<string, string>()
  const lineIdByCanonical = new Map<string, string>() // canonical `${cn}:${lineNo}` -> db uuid
  let claimLineCount = 0
  for (const claim of input.claims) {
    const payerId = payerIds.get(claim.payer.externalId) ?? null
    const cIns = await db.from('claims').insert(toClaimRow(tenantId, payerId, claim)).select('id').single()
    if (cIns.error) throw cIns.error
    const claimId = cIns.data.id as string
    claimIdByControl.set(claim.controlNumber, claimId)

    if (claim.lines.length > 0) {
      const lIns = await db
        .from('claim_lines')
        .insert(claim.lines.map((l) => toClaimLineRow(claimId, l)))
        .select('id, line_number')
      if (lIns.error) throw lIns.error
      for (const row of lIns.data as { id: string; line_number: number }[]) {
        lineIdByCanonical.set(`${claim.controlNumber}:${row.line_number}`, row.id)
      }
      claimLineCount += claim.lines.length
    }
  }

  // 3. Remittances + lines + adjustments
  let remittanceCount = 0
  for (const remit of input.remittances) {
    const claimId = claimIdByControl.get(remit.claimControlNumber) ?? null
    const payerId = payerIds.get(remit.payer.externalId) ?? null
    const rIns = await db.from('remittances').insert(toRemittanceRow(tenantId, claimId, payerId)).select('id').single()
    if (rIns.error) throw rIns.error
    const remittanceId = rIns.data.id as string
    remittanceCount += 1

    const claim = input.claims.find((c) => c.controlNumber === remit.claimControlNumber)
    for (const rl of remit.lines) {
      let claimLineId: string | null = null
      if (claim) {
        const match = claim.lines.find((cl) => lineMatchKey(cl.cptHcpcs, cl.modifiers) === lineMatchKey(rl.cptHcpcs, rl.modifiers))
        if (match) claimLineId = lineIdByCanonical.get(match.id) ?? null
      }
      const rlIns = await db.from('remittance_lines').insert(toRemittanceLineRow(remittanceId, claimLineId, rl)).select('id').single()
      if (rlIns.error) throw rlIns.error
      if (rl.adjustments.length > 0) {
        const aIns = await db.from('adjustments').insert(rl.adjustments.map((a) => toAdjustmentRow(rlIns.data.id as string, a)))
        if (aIns.error) throw aIns.error
      }
    }
  }

  // 4. Findings (reference the claim line they were found on)
  let findingCount = 0
  const findingRows = input.findings.map((f) => toFindingRow(tenantId, lineIdByCanonical.get(f.claimLineId) ?? null, f))
  if (findingRows.length > 0) {
    const fIns = await db.from('findings').insert(findingRows)
    if (fIns.error) throw fIns.error
    findingCount = findingRows.length
  }

  return {
    tenantId,
    claims: input.claims.length,
    claimLines: claimLineCount,
    remittances: remittanceCount,
    findings: findingCount,
  }
}

interface FindingJoinRow {
  id: string
  type: string
  expected_cents: number
  actual_cents: number
  delta_cents: number
  appealable: boolean
  status: string
  claim_lines: { cpt_hcpcs: string | null } | { cpt_hcpcs: string | null }[] | null
}

export interface StoredFinding {
  id: string
  type: string
  cptHcpcs: string | null
  expectedCents: number
  actualCents: number
  deltaCents: number
  appealable: boolean
  status: string
}

/** Read persisted findings for a tenant, ranked by recoverable delta. */
export async function loadFindings(db: SupabaseClient, tenantId: string): Promise<StoredFinding[]> {
  const res = await db
    .from('findings')
    .select('id, type, expected_cents, actual_cents, delta_cents, appealable, status, claim_lines(cpt_hcpcs)')
    .eq('tenant_id', tenantId)
    .order('delta_cents', { ascending: false })
  if (res.error) throw res.error

  const rows = (res.data ?? []) as unknown as FindingJoinRow[]
  return rows.map((r) => {
    const cl = r.claim_lines
    const cptHcpcs = Array.isArray(cl) ? cl[0]?.cpt_hcpcs ?? null : cl?.cpt_hcpcs ?? null
    return {
      id: r.id,
      type: r.type,
      cptHcpcs,
      expectedCents: r.expected_cents,
      actualCents: r.actual_cents,
      deltaCents: r.delta_cents,
      appealable: r.appealable,
      status: r.status,
    }
  })
}
