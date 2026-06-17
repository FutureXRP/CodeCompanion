# DATA-MODEL.md — Canonical Schema

The canonical model is the single source of truth. Adapters normalize into it; everything downstream reads only from it. Schema is Postgres (Supabase). Money is **integer cents**. Every tenant-scoped table has a `tenant_id` and an RLS policy.

PHI classification on every table below: **[PHI]** = contains protected health information, hard-locked by RLS; **[REF]** = shared reference data, no PHI; **[CORPUS]** = de-identified aggregate, no tenant, no patient — *the gate.*

---

## Tenant-scoped entities [PHI / tenant-isolated]

### tenants
```
id            uuid pk
name          text
created_at    timestamptz
```

### providers [PHI-adjacent]
```
id            uuid pk
tenant_id     uuid fk -> tenants
npi           text
name          text
specialty     text
```

### patients [PHI] — keep minimal; this is the most sensitive table
```
id            uuid pk
tenant_id     uuid fk -> tenants
external_ref  text          -- opaque ref to source EHR, never an SSN/MRN in cleartext if avoidable
created_at    timestamptz
```

### encounters [PHI]
```
id                uuid pk
tenant_id         uuid fk
patient_id        uuid fk -> patients
provider_id       uuid fk -> providers
date_of_service   date
place_of_service  text
```

### claims [PHI]
```
id                uuid pk
tenant_id         uuid fk
encounter_id      uuid fk -> encounters
payer_id          uuid fk -> payers
control_number    text          -- 837 claim control number
total_billed_cents bigint
submitted_at      timestamptz
source_adapter    text          -- 'athena' | 'edi' | 'fhir'
```

### claim_lines [PHI]
```
id                uuid pk
claim_id          uuid fk -> claims
cpt_hcpcs         text
modifiers         text[]
units             int
dx_pointers       int[]
billed_cents      bigint
```

### remittances [PHI]
```
id                uuid pk
tenant_id         uuid fk
claim_id          uuid fk -> claims
payer_id          uuid fk -> payers
check_eft_ref     text          -- 835 trace/EFT number
paid_at           date
```

### remittance_lines [PHI]
```
id                    uuid pk
remittance_id         uuid fk -> remittances
claim_line_id         uuid fk -> claim_lines
allowed_cents         bigint
paid_cents            bigint
patient_resp_cents    bigint
```

### adjustments [PHI] — the machine-readable "why" behind every reduction/denial
```
id                uuid pk
remittance_line_id uuid fk -> remittance_lines
group_code        text          -- CO, PR, OA, PI (claim adjustment group)
carc_code         text          -- Claim Adjustment Reason Code
rarc_code         text          -- Remittance Advice Remark Code
amount_cents      bigint
```

### findings [PHI] — diff engine output (Rung 0)
```
id                uuid pk
tenant_id         uuid fk
claim_line_id     uuid fk -> claim_lines
type              text          -- 'underpayment' | 'denial' | 'undercoding'
expected_cents    bigint
actual_cents      bigint
delta_cents       bigint
appealable        boolean
status            text          -- 'open' | 'appealing' | 'recovered' | 'terminal'
detected_at       timestamptz
```

---

## Contract / reference entities [REF or tenant-scoped]

### payers [REF] — shared catalog of payers
```
id                uuid pk
name              text
payer_id_external text          -- the payer's EDI ID
```

### payer_contracts [PHI/tenant — a practice's specific contract]
```
id                uuid pk
tenant_id         uuid fk
payer_id          uuid fk -> payers
effective_date    date
expiry_date       date
```

### fee_schedule_lines [tenant]
```
id                uuid pk
contract_id       uuid fk -> payer_contracts
cpt_hcpcs         text
modifier          text
contracted_cents  bigint
```
> **Acquisition note:** populating contracted rates cleanly is the hardest data problem on the platform. Athena may already hold the practice's contracted rates — start there for the first clinic. Treat fee-schedule ingestion as a first-class adapter concern, not a manual import.

---

## The de-identification gate [CORPUS — no tenant_id, no patient]

### payer_behavior_corpus [CORPUS]
The moat. Populated **only** through the one-way de-id transform. No foreign key to any tenant-scoped table. No patient identifier may ever reach this table.
```
id                uuid pk
payer_id          uuid fk -> payers        -- payer is not PHI
region            text                     -- coarse geography only (e.g. state); never address
specialty         text
cpt_hcpcs         text
modifier          text
contract_class    text                     -- bucketed, not a specific contract id
allowed_stat      jsonb                    -- distribution stats, not raw values
paid_stat         jsonb
days_to_pay_stat  jsonb
denial_rate       numeric
sample_n          int                      -- suppress / withhold when sample_n is small
updated_at        timestamptz
```

**Gate rules (enforced in `lib/corpus/`):**
1. The transform reads tenant data, emits only aggregate statistics keyed by non-identifying dimensions.
2. Output rows carry **no** `tenant_id`, `patient_id`, `encounter_id`, `claim_id`, dates of service, or free text.
3. Small-cell suppression: do not emit a corpus row below a minimum `sample_n` (prevents re-identification by inference).
4. The transform has dedicated tests asserting that no identifier column is ever populated.

---

## RLS pattern

Every `[PHI]` and tenant-scoped table:
```sql
alter table <t> enable row level security;
create policy tenant_isolation on <t>
  using (tenant_id = current_tenant_id());
```
- `current_tenant_id()` resolves from the authenticated session. **Settled (2026-06): Supabase Auth.** Implemented in `supabase/migrations/005_canonical_model.sql` as a `SECURITY DEFINER` function that maps `auth.uid()` to a tenant via the `tenant_users` membership table (one tenant per user for now; multi-practice users would move to an active-tenant JWT claim). Tenant isolation is verified by `supabase/tests/rls_isolation_test.sql`.
- `[CORPUS]` tables have **no** tenant policy because they have no tenant column; read access is granted only to the prediction service role, and only aggregate columns are exposed.
- Reference views (e.g. `active_*`) should be `security_invoker = true` so they respect the caller's RLS.

---

## Build order for the schema

1. `payers`, `tenants`, `providers` (reference + scaffolding).
2. `patients`, `encounters`, `claims`, `claim_lines` (the 837 side).
3. `remittances`, `remittance_lines`, `adjustments` (the 835 side).
4. `payer_contracts`, `fee_schedule_lines` (the contracted-rate side).
5. `findings` (diff output).
6. `payer_behavior_corpus` + de-id transform — **last**, and only with its gate tests in place.
