# COMPLIANCE.md — HIPAA Posture & PHI Gate

This platform handles protected health information. Compliance here is **architecture, not a checklist bolted on at the end.** Read this before writing anything that could touch PHI.

---

## The hard gate: no real PHI until the BAA path is closed

The platform must not process real patient data until all of the following are true:

1. **BAAs signed** with every vendor in the PHI path — including hosting (Supabase), the model provider (Anthropic), any clearinghouse, and any subprocessor that could see PHI.
2. **Audit logging** live on every PHI access.
3. **RLS** enforced on every tenant-scoped table (see `DATA-MODEL.md`).
4. **De-id gate tests** passing for the corpus transform.

Until then, **everything runs on synthetic or de-identified test data.** This mirrors the existing `ATHENA_USE_MOCK=true` pattern — keep that posture as the default across all adapters:

- `ATHENA_USE_MOCK=true`
- `EDI_USE_SAMPLE_FILES=true`
- `ALLOW_REAL_PHI=false`  ← the master switch; stays false until the gate above is closed.

Claude Code: if a task implies flowing real patient data while `ALLOW_REAL_PHI=false`, stop and flag it rather than wiring it.

---

## PHI minimization

- Collect the minimum necessary. The `patients` table stays as thin as possible (see DATA-MODEL).
- Avoid storing SSN/MRN in cleartext where an opaque `external_ref` will do.
- The **behavioral corpus never sees a patient.** A patient identifier reaching a corpus table is a breach-class bug — refuse to write that path.

---

## The de-identification boundary (restated, because it matters most)

- Individual claims: tenant-isolated, PHI, RLS-locked.
- Corpus: de-identified aggregates only — payer behavior, not people.
- The transform is one-way and tested. Small-cell suppression (`sample_n` floor) prevents re-identification by inference.

Properly de-identified aggregate statistics can be shared across tenants without violating HIPAA — that is the legal basis for the network effect. The whole moat depends on this line being clean.

---

## Audit & access

- Immutable audit log on every read/write of PHI: who, what, when.
- Least-privilege service roles. The prediction service reads only aggregate corpus columns, never raw claims.
- Reference views use `security_invoker = true` so they respect the caller's RLS rather than the definer's.

---

## What this document is not

This is engineering guidance to keep the build compliant-by-construction. It is **not** legal advice and not a substitute for a HIPAA compliance review, a security risk assessment, or counsel. Before real PHI flows, get a qualified HIPAA/security review and proper legal sign-off on BAAs. Matt should treat the BAA path and a formal risk assessment as gating business tasks that run in parallel with Phase 0/1 engineering.

---

## Practical sequencing

The good news on timing: the CMS FHIR mandate (Jan 2027) reduces payer data fragmentation right as the platform would be scaling — design the `fhir` adapter slot now, build it then. Use the runway before real-PHI scale to get the compliance gate genuinely closed, not improvised under load.
