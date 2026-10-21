# GeyaLog Phases 3–6: Implementation and verification status

Updated: 2026-10-11

## Current result

This document separates local source implementation from verified Supabase behavior. New Phase 5/6 screens, services and migrations are present in the workspace. The database has **not** been migrated or exercised in the current environment. Do not use the new Phase 3–6 workflows against the production project until the migrations are reviewed, applied to staging and tested.

## Phase 3 — Projects and contracts

Local project/customer/contract schema, RLS policies, project services, creation/detail/planning/variation screens, and domain validation are present. Full, labour-only and hybrid contracts; fixed, unit-rate and cost-plus pricing; scopes, payment terms, milestones and variations are represented. TypeScript and domain validation pass. PostgreSQL execution, multi-user RLS, real Supabase persistence and device QA remain unverified.

## Phase 4 — Customer receipts

Local receipt/obligation/allocation/refund/reversal schema and UI/services are present. Amounts use PostgreSQL NUMERIC and decimal strings. The screen distinguishes receipt records from planned obligations. Transaction locking, organization RLS, receipt-sharing/PDF behavior and actual remote integration remain unverified.

## Phase 5 — Workforce and labour

Implemented locally:

- Worker directory and worker creation.
- Project assignments and effective-dated wage rate changes.
- Attendance submission, owner/admin approval, correction history and daily/weekly rate earning snapshots.
- Unit-rate/fixed-task work creation, reported quantity approval and earnings entry creation.
- Advance, settlement draft/advance offsets, partial payment, verification and reversal workflows.
- Subcontractor directory, project agreements, work submission/approval, partial work payments, payment verification and reversal.
- Organization/role-scoped queries and local validation tests.

New local database migrations: `20261011000800_phase_5_subcontractor_workflows.sql` adds trusted RPCs and grants for subcontractor agreement/work/payment operations; `20261011001000_phase_5_labour_reporting.sql` adds finance-authorized project labour summaries, worker financial history, and idempotent subcontractor advances.

Worker financial history, project labour-cost summary and subcontractor advance entry are implemented locally. Remaining: worker profile editing/inactivation UX, settlement/advance reconciliation review, review of all SQL in a disposable Postgres database, automated two-company/two-role RLS tests, and device interaction testing. Current UI test coverage validates domain input only; it does not prove database accounting correctness.

## Phase 6 — Materials, procurement and suppliers

Implemented locally:

- Supplier and material catalogue screens.
- Site requisition creation, listing, per-line approval quantities, and reject workflow.
- Purchase order draft, approval, ordered-state and goods receiving.
- Project stock issue, inventory balance view, supplier invoice and payment history, payment confirmation/reversal.
- Decimal validation and idempotent supplier-payment RPC.

Schema and trusted operations are in `supabase/migrations/20261011000700_phase_6_materials_procurement.sql`. Migration `20261011000900_phase_6_requisition_order_limits.sql` adds request-line links and enforces approved quantity limits transactionally for linked purchase orders; general stock orders remain supported.

Migration `20261011001100_phase_6_receipt_reversal.sql` adds a guarded full goods-receipt reversal with stock-availability checks, PO quantity restoration and audit metadata. Receipt history and reversal controls are now present on the purchase-order detail screen. Remaining: partial returns, comprehensive supplier invoice balance/reconciliation UX, broader stock adjustment/transfer screens, attachment support, staging database tests for concurrency/RLS, and mobile QA. Supplier payments are procurement records and are not a full expense/profit accounting system.

## Verification run in this workspace

- `npm run typecheck`: PASS.
- `npx eslint app src tests`: PASS after removing a synchronous state-update effect from requisition detail.
- `npm test`: 25 PASS, 0 FAIL, 1 SKIP. The skipped test is the local Supabase integration suite; the passing tests are validation/domain tests only.
- `npx expo export --platform web --output-dir .tmp/phase36-verified-export`: PASS; web bundle exported after the latest source change.
- `npx expo install --check`: local Expo SDK bundled dependency map reports dependencies up to date; network access was disabled, so the online compatibility endpoint was not checked.
- Docker CLI, Supabase CLI, and `psql` are unavailable on this execution shell. No local Postgres migration test could be run. `npx expo install --check` used the offline bundled package map and reported dependencies up to date; the online compatibility endpoint was unreachable.
- No remote migrations were pushed, repaired, reset, or applied. Earlier read-only inspection documented that remote migration history is absent and some remote policies differ from local migration source; schema equivalence remains unproven.
- No real Supabase write, company/customer financial record, worker payment or inventory transaction was tested.

## Required safe next steps

1. Restore Docker/Supabase CLI in the development shell (Docker Desktop being open is not enough if the CLI executable is absent from that shell's PATH), or provide another disposable Postgres/Supabase test environment.
2. Apply migrations `20261011000400` through `20261011001100` to a clean local database in timestamp order; fix and rerun until clean.
3. Add database integration tests using synthetic organizations/users for membership roles, cross-company access, payments, reversals, settlements, supplier balances and stock concurrency.
4. Compare live schema and policy definitions before considering remote migration history repair. Never reset the production database or run a blind push.
5. Apply reviewed migrations to staging, test Auth/email/deep links on device, then plan production rollout with backup and rollback steps.

**Readiness:** Source work for Phases 3–6 is present, and Phase 5/6 workflows have been expanded. But the database migrations, transaction rules and RLS have not been executed in the current environment. Therefore Phase 3–6 are **not fully verified, not production-ready, and not ready to mark complete**. Phase 7 must not start until database and security verification is complete.
