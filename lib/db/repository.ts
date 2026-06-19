import type { SupabaseClient } from '@supabase/supabase-js'
import type { Claim, Finding, Remittance } from '../canonical'
import {
  postClaimCharges,
  postRemittance,
  accountsFromEntries,
  type LedgerEntry,
  type PatientAccount,
} from '../ledger'
import { assertDeidentified, type CorpusRow } from '../corpus'
import {
  toAdjustmentRow,
  toClaimLineRow,
  toClaimRow,
  toCorpusRow,
  toFindingRow,
  toLedgerEntryRow,
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
  ledgerEntries: number
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

/**
 * Persist de-identified corpus rows (service role only — the corpus has no tenant
 * column, so it never goes through an authed/RLS client). The gate runs ONE more
 * time at the write boundary: a row that is not de-identified throws, never
 * writes. Upserts on the behavior cell so repeat runs refine rather than dupe.
 */
export async function persistCorpus(db: SupabaseClient, rows: CorpusRow[]): Promise<number> {
  if (rows.length === 0) return 0
  for (const row of rows) assertDeidentified(row) // breach-class bug must fail loudly, not write
  const payerIds = new Map<string, string>()
  for (const r of rows) {
    if (!payerIds.has(r.payerExternalId)) {
      payerIds.set(r.payerExternalId, await ensurePayer(db, r.payerExternalId, r.payerExternalId))
    }
  }
  const dbRows = rows.map((r) => toCorpusRow(payerIds.get(r.payerExternalId) ?? null, r))
  const ins = await db
    .from('payer_behavior_corpus')
    .upsert(dbRows, { onConflict: 'payer_id,region,specialty,cpt_hcpcs,modifier,contract_class' })
  if (ins.error) throw ins.error
  return dbRows.length
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

  // 5. Patient ledger — post 837 charges + 835 payments/adjustments into the
  //    append-only ledger, wiring claim + claim-line FKs from the maps above.
  const claimByControl = new Map(input.claims.map((c) => [c.controlNumber, c]))
  const ledgerEntries: LedgerEntry[] = []
  for (const claim of input.claims) ledgerEntries.push(...postClaimCharges(claim))
  for (const remit of input.remittances) {
    ledgerEntries.push(...postRemittance(remit, claimByControl.get(remit.claimControlNumber)))
  }
  let ledgerEntryCount = 0
  const ledgerRows = ledgerEntries.map((e) =>
    toLedgerEntryRow(
      tenantId,
      claimIdByControl.get(e.claimControlNumber) ?? null,
      e.claimLineId ? lineIdByCanonical.get(e.claimLineId) ?? null : null,
      e,
    ),
  )
  if (ledgerRows.length > 0) {
    const lgIns = await db.from('ledger_entries').insert(ledgerRows)
    if (lgIns.error) throw lgIns.error
    ledgerEntryCount = ledgerRows.length
  }

  return {
    tenantId,
    claims: input.claims.length,
    claimLines: claimLineCount,
    remittances: remittanceCount,
    findings: findingCount,
    ledgerEntries: ledgerEntryCount,
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

interface LedgerEntryRowRead {
  account_key: string
  type: LedgerEntry['type']
  insurance_delta_cents: number
  patient_delta_cents: number
  carc_code: string | null
  memo: string | null
  source: LedgerEntry['source'] | null
}

/**
 * Read the persisted ledger for a tenant, grouped into accounts with derived
 * balances. Patient names are not stored on the ledger (PHI minimization), so
 * accounts are keyed by account_key; balances reuse the same engine as the
 * in-memory ledger, so the numbers are identical.
 */
export async function loadLedger(db: SupabaseClient, tenantId: string): Promise<PatientAccount[]> {
  const res = await db
    .from('ledger_entries')
    .select('account_key, type, insurance_delta_cents, patient_delta_cents, carc_code, memo, source')
    .eq('tenant_id', tenantId)
  if (res.error) throw res.error

  const rows = (res.data ?? []) as unknown as LedgerEntryRowRead[]
  const entries: LedgerEntry[] = rows.map((r, i) => ({
    id: `db:${i}`,
    type: r.type,
    claimControlNumber: '',
    accountKey: r.account_key,
    insuranceDeltaCents: r.insurance_delta_cents,
    patientDeltaCents: r.patient_delta_cents,
    carcCode: r.carc_code ?? undefined,
    memo: r.memo ?? '',
    source: r.source ?? 'manual',
    postedAt: '',
  }))
  return accountsFromEntries(entries)
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
