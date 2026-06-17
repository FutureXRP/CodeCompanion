# RLS tests

Verifies tenant isolation on the canonical model (`../migrations/005_canonical_model.sql`).
The test simulates two users by setting `request.jwt.claims` and asserts each
tenant sees only its own rows — and that a cross-tenant write is rejected by
`WITH CHECK`. A successful run prints `RLS ISOLATION TESTS PASSED`; any policy
gap raises and aborts (run psql with `-v ON_ERROR_STOP=1`).

## Plain Postgres

Supabase provides the `auth` schema, helper functions, and the
`anon`/`authenticated`/`service_role` roles; on a plain Postgres, stub them first:

```sh
psql "$DB" -v ON_ERROR_STOP=1 -f auth_stub.sql
psql "$DB" -v ON_ERROR_STOP=1 -f ../migrations/005_canonical_model.sql
psql "$DB" -v ON_ERROR_STOP=1 -f rls_isolation_test.sql
```

## Supabase

The `auth` schema and roles already exist — skip `auth_stub.sql`. Apply the
migration, then run `rls_isolation_test.sql`.
