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
import { writeAudit } from './audit'
import { type Queryable, insertReturning, insertMany, upsertMany } from './sql'

/**
 * Persistence repository (Neon / Postgres). Writes a canonical found-money run into
 * the normalized tables and reads findings back. Takes a Queryable (the pool, a
 * withTenant() client, or pg-mem in tests). Money stays integer cents; tenant
 * isolation is the schema's job (RLS) plus the explicit tenant_id on every row.
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
export async function ensureTenant(db: Queryable, name: string): Promise<string> {
  const found = await db.query('select id from tenants where name = $1 limit 1', [name])
  if (found.rows[0]) return found.rows[0].id as string
  const created = await db.query('insert into tenants (name) values ($1) returning id', [name])
  return created.rows[0].id as string
}

/** Find-or-create a payer in the shared catalog by its external EDI id. */
export async function ensurePayer(db: Queryable, externalId: string, name: string): Promise<string> {
  const found = await db.query('select id from payers where payer_id_external = $1 limit 1', [externalId])
  if (found.rows[0]) return found.rows[0].id as string
  const created = await db.query('insert into payers (name, payer_id_external) values ($1, $2) returning id', [name, externalId])
  return created.rows[0].id as string
}

/**
 * Persist de-identified corpus rows (service path — the corpus has no tenant column).
 * The gate runs ONE more time at the write boundary: a row that is not de-identified
 * throws, never writes. Upserts on the behavior cell so repeat runs refine, not dupe.
 */
export async function persistCorpus(db: Queryable, rows: CorpusRow[]): Promise<number> {
  if (rows.length === 0) return 0
  for (const row of rows) assertDeidentified(row) // breach-class bug must fail loudly, not write
  const payerIds = new Map<string, string>()
  for (const r of rows) {
    if (!payerIds.has(r.payerExternalId)) {
      payerIds.set(r.payerExternalId, await ensurePayer(db, r.payerExternalId, r.payerExternalId))
    }
  }
  const dbRows = rows.map((r) => toCorpusRow(payerIds.get(r.payerExternalId) ?? null, r))
  await upsertMany(db, 'payer_behavior_corpus', dbRows, ['payer_id', 'region', 'specialty', 'cpt_hcpcs', 'modifier', 'contract_class'])
  return dbRows.length
}

/**
 * Persist a full run: claims + lines, remittances + lines + adjustments, and the
 * diff findings — wiring foreign keys as it goes. Findings reference the claim line
 * they were detected on, matched via the canonical line id.
 */
export async function persistRun(
  db: Queryable,
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
  const lineIdByCanonical = new Map<string, string>() // canonical line id -> db uuid
  let claimLineCount = 0
  for (const claim of input.claims) {
    const payerId = payerIds.get(claim.payer.externalId) ?? null
    const c = await insertReturning(db, 'claims', toClaimRow(tenantId, payerId, claim), 'id')
    const claimId = c.id as string
    claimIdByControl.set(claim.controlNumber, claimId)

    if (claim.lines.length > 0) {
      const lines = await insertMany(db, 'claim_lines', claim.lines.map((l) => toClaimLineRow(claimId, l)), 'id, line_number')
      for (const row of lines as { id: string; line_number: number }[]) {
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
    const r = await insertReturning(db, 'remittances', toRemittanceRow(tenantId, claimId, payerId), 'id')
    const remittanceId = r.id as string
    remittanceCount += 1

    const claim = input.claims.find((c) => c.controlNumber === remit.claimControlNumber)
    for (const rl of remit.lines) {
      let claimLineId: string | null = null
      if (claim) {
        const match = claim.lines.find((cl) => lineMatchKey(cl.cptHcpcs, cl.modifiers) === lineMatchKey(rl.cptHcpcs, rl.modifiers))
        if (match) claimLineId = lineIdByCanonical.get(match.id) ?? null
      }
      const rlRow = await insertReturning(db, 'remittance_lines', toRemittanceLineRow(remittanceId, claimLineId, rl), 'id')
      if (rl.adjustments.length > 0) {
        await insertMany(db, 'adjustments', rl.adjustments.map((a) => toAdjustmentRow(rlRow.id as string, a)))
      }
    }
  }

  // 4. Findings (reference the claim line they were found on)
  const findingRows = input.findings.map((f) => toFindingRow(tenantId, lineIdByCanonical.get(f.claimLineId) ?? null, f))
  let findingCount = 0
  if (findingRows.length > 0) {
    await insertMany(db, 'findings', findingRows)
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
  const ledgerRows = ledgerEntries.map((e) =>
    toLedgerEntryRow(
      tenantId,
      claimIdByControl.get(e.claimControlNumber) ?? null,
      e.claimLineId ? lineIdByCanonical.get(e.claimLineId) ?? null : null,
      e,
    ),
  )
  let ledgerEntryCount = 0
  if (ledgerRows.length > 0) {
    await insertMany(db, 'ledger_entries', ledgerRows)
    ledgerEntryCount = ledgerRows.length
  }

  // Audit the PHI write (COMPLIANCE.md). Counts only — no patient data.
  await writeAudit(db, tenantId, null, {
    action: 'write',
    resource: 'persist_run',
    detail: { claims: input.claims.length, remittances: remittanceCount, findings: findingCount, ledgerEntries: ledgerEntryCount },
  })

  return {
    tenantId,
    claims: input.claims.length,
    claimLines: claimLineCount,
    remittances: remittanceCount,
    findings: findingCount,
    ledgerEntries: ledgerEntryCount,
  }
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
export async function loadLedger(db: Queryable, tenantId: string): Promise<PatientAccount[]> {
  const res = await db.query(
    'select account_key, type, insurance_delta_cents, patient_delta_cents, carc_code, memo, source from ledger_entries where tenant_id = $1',
    [tenantId],
  )
  const entries: LedgerEntry[] = (res.rows as LedgerEntryRowRead[]).map((r, i) => ({
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

interface FindingRowRead {
  id: string
  type: string
  expected_cents: number
  actual_cents: number
  delta_cents: number
  appealable: boolean
  status: string
  cpt_hcpcs: string | null
}

/** Read persisted findings for a tenant, ranked by recoverable delta. */
export async function loadFindings(db: Queryable, tenantId: string): Promise<StoredFinding[]> {
  const res = await db.query(
    `select f.id, f.type, f.expected_cents, f.actual_cents, f.delta_cents, f.appealable, f.status, cl.cpt_hcpcs
     from findings f
     left join claim_lines cl on cl.id = f.claim_line_id
     where f.tenant_id = $1
     order by f.delta_cents desc`,
    [tenantId],
  )
  return (res.rows as FindingRowRead[]).map((r) => ({
    id: r.id,
    type: r.type,
    cptHcpcs: r.cpt_hcpcs ?? null,
    expectedCents: r.expected_cents,
    actualCents: r.actual_cents,
    deltaCents: r.delta_cents,
    appealable: r.appealable,
    status: r.status,
  }))
}
