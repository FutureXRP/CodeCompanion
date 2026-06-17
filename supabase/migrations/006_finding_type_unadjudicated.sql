-- 006_finding_type_unadjudicated.sql
-- Adds the 'unadjudicated' finding type: an 837 was submitted but no 835 line
-- ever came back (the claim was never adjudicated, or the payer dropped a line).
-- These are deterministic, recoverable dollars at risk of a timely-filing
-- write-off. Append-only: relaxes the CHECK constraint defined in 005.

alter table findings drop constraint if exists findings_type_check;

alter table findings
  add constraint findings_type_check
  check (type in ('underpayment', 'denial', 'undercoding', 'unadjudicated'));
