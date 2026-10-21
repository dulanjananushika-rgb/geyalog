# GeyaLog database connectivity verification

Checked: 2026-10-11

## Remote Supabase — read-only checks from this run

- The configured Supabase Auth settings endpoint returned HTTP 200. The project's public endpoint and publishable key can reach Supabase.
- A read-only REST request for `projects` using `select=id&limit=0` returned HTTP 200. No project rows were fetched.
- Read-only REST checks for `customers`, `project_contracts`, `customer_receipts`, `workers`, `material_items`, and `suppliers` returned HTTP 404. The Phase 3–6 feature tables are not exposed/present in the remote API schema.
- `profiles`, `organizations`, and `organization_members` checks without a signed-in user JWT returned HTTP 401. This is not an authenticated RLS test and does not prove per-user access behavior.
- No customer, project, profile, payment, worker, supplier, or inventory rows were read or written. No remote schema or migration history was modified.
- Prior inspection documented missing remote migration tracking and policy-name differences from local migrations. Those are unresolved; do not push or repair production migration history based only on these REST checks.

## Local Supabase tooling in this execution shell

- This shell cannot find Docker CLI, Supabase CLI, or `psql`; Docker Desktop's local executable path is not visible here. Therefore local migrations and RLS integration tests could not be run from this execution shell.
- Previously documented local Phase 0/1 database tests were run in another environment/session. They have not been re-run here and do not verify Phases 3–6.

## Current application checks

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test` — PASS: 25 passed, 1 skipped. The skipped test is the local Supabase integration suite; unit tests validate input/domain behavior only.
- `npx expo export --platform web --output-dir .tmp/phase36-verified-export` — PASS.
- `npx expo install --check` — local Expo SDK dependency map says up to date; online compatibility endpoint was unavailable in offline mode.

## Conclusion

Connectivity to the Supabase Auth endpoint is confirmed, and the remote Projects REST endpoint responds. The remote database does **not** currently expose the Phase 3–6 tables, so those modules cannot persist their records there yet. Authenticated RLS, real transaction flows, and production migration behavior remain unverified. The next safe database verification requires a disposable local/staging Supabase environment, followed by schema/policy comparison; do not use production for these tests.
