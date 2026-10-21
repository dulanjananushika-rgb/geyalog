# GeyaLog project progress

Updated: 2026-10-11

## Phase 0 — Project foundation

The existing Expo SDK 57 + TypeScript foundation, company-scoped project creation, organization membership model, and project RLS migration are preserved. Phase 1 changes the authenticated landing route but keeps the existing Phase 0 project screens and their data code intact behind authenticated navigation.

## Phase 1 — Authentication and user management

### Implemented locally

- Premium welcome, sign-in, sign-up, email-verification instructions, resend verification with a 45-second cooldown, forgot-password, and password-reset screens.
- Supabase email/password sign-up and sign-in, confirmation redirect handling for PKCE code and token-based links, and recovery-link callback handling.
- Session restoration, Supabase foreground/background token refresh, protected Expo Router groups, duplicate-submit guards, and sign-out.
- Native auth storage moved from AsyncStorage to Expo SecureStore (Android Keystore / iOS Keychain); an existing Phase 0 session is migrated on first read. Web preview keeps using browser storage.
- Authenticated temporary home, profile display, profile editing, and English/Sinhala/Tamil preferred-language selection.
- `profiles` migration with Auth-user foreign key, account creation timestamps, signup trigger plus existing-account backfill, updated-at trigger, self-only RLS, and column-level grants that prohibit editing profile identity/timestamps or email.
- Added a small language registry as the starting point for feature-by-feature translations.

### Security boundaries

- The app uses only `EXPO_PUBLIC_SUPABASE_URL` and a publishable/anon client key; no service-role key is read by app code.
- UI route protection is for navigation only. The `profiles` table remains protected by PostgreSQL RLS and column permissions.
- A new profile is created in the same database transaction as the Auth user by a constrained `SECURITY DEFINER` trigger. Existing Auth users are backfilled without fabricating names.
- Email is read from the Auth session and is not part of the editable profile update payload.
- Company registration, staff management, new project functionality, customer access, and financial/labour/material modules were not added as Phase 1 work. Existing Phase 0 files are preserved.

### Connectivity and local database verification — 2026-10-11

- The local `.env` has the Supabase project URL and public publishable key configured. Credential values are intentionally not recorded in this document.
- Read-only remote checks passed: Supabase Auth settings returned HTTP 200 and a zero-row Projects REST query returned HTTP 200. No production data was written or fetched.
- Remote schema inspection found `profiles`, `organizations`, `organization_members`, and `projects`; RLS is enabled on all four. The remote database currently exposes no Phase 3–6 tables such as customers, contracts, receipts, workers, or materials.
- Remote migration tracking is not initialized: `supabase_migrations.schema_migrations` is absent and the Dashboard migration page says “Run your first migration.” Remote policy names differ from the local migration definitions. Because equivalence is not established, no remote migration repair, push, reset, or schema change was performed.
- Docker Desktop and the pinned Supabase CLI were used to start a local Supabase stack. Both repository migrations applied locally in timestamp order: `20261011000100_phase_01_foundation.sql` and `20261011000200_phase_1_auth_profiles.sql`.
- Added `tests/supabase-local.integration.test.mjs`. Against the local database only, the integration test passed for Auth-created profiles, own-profile access, cross-profile denial, organization creation, Company A/B project isolation, cross-company insert denial, and self-promotion denial. Synthetic local users/organizations were removed by the test cleanup.
- Passed after restoring exact dependencies from `package-lock.json` without changing the lockfile: `npm run typecheck`, `npm run lint`, `npm test` (4 passed; the local integration test is skipped unless explicitly enabled), Expo web export, and `npx expo install --check` using Expo's local SDK map. Expo could not reach its online compatibility endpoint; the local map reports dependencies up to date.
- Not verified: remote sign-up/login with a real user, confirmation/recovery email delivery, device deep links, profile writes on the remote project, or remote multi-user RLS behavior. No dedicated remote test account/inbox was available, so no remote test records were created.
- This checkout initially contained only Phase 0/1 data modules and no Expo Router `app/` routes, despite the earlier progress summary describing those routes. A minimal welcome/sign-in/sign-up/email-verification route scaffold is now restored; recovery, full profile editing, and on-device deep-link flows still need implementation and verification.
- This workspace has no `.git` directory, so `git status` and `git diff --check` cannot be run here.

## Phase 2 — Company management and role access (local implementation; remote deployment blocked)

- Added migration `20261011000300_phase_2_company_management.sql` for company profile fields, membership statuses/roles, secure invitations, and guarded database RPCs.
- Added organization data operations, centralized role/permission constants, company setup and switching, team list/invitation UI, invitation acceptance deep link, and a server-side email Edge Function.
- Added `PHASE_2_COMPANY_MANAGEMENT.md` with setup, permissions, and migration safety notes.
- Company onboarding, switching, team, profile/settings and invitations routes exist locally. Database authorization tests have not run against this migration in this session because Docker CLI is unavailable in the execution environment.
- Remote migration is **not applied**. The live project migration history and policy mismatch remain unresolved; do not describe this backend as production-ready or deployed.

## Phase 3 — Projects and contracts (local implementation; DB integration unverified)

- Added local migration `20261011000400_phase_3_projects_contracts.sql`, project/customer/contract services and screens for project list/create/detail, planning, and variations.
- Draft project creation supports full/labour/hybrid contract types and fixed/unit-rate/cost-plus pricing. Scope responsibilities and variable payment term planning have domain validation.
- TypeScript, ESLint and unit validation tests pass. No live or local Postgres execution has verified the migration or RLS in this session. Contract screens have not received mobile-device QA.

## Phase 4 — Customer payments (local implementation; financial DB integration unverified)

- Added local migration `20261011000500_phase_4_customer_payments.sql`, payment service/validation and overview, add receipt, history and receipt detail screens.
- Schema uses NUMERIC amounts, receipt allocations, verification status, refunds/reversals and audit records. This is locally authored SQL, not deployed to Supabase in this session.
- Unit validation tests pass; transactional database tests, receipt PDF export/share, and device/email/payment-provider integrations have not been verified. Phase 4 should not be treated as production-ready.

## Phase 5 — Workforce and labour (local implementation; database verification pending)

- Added `20261011000600_phase_5_labour_management.sql` and `20261011000800_phase_5_subcontractor_workflows.sql` for workers, assignments, dated rates, attendance/earnings, tasks, advances, settlements, subcontractor agreements/work, payments and audit history.
- Added worker creation/directory, project assignment, rate history, attendance capture/review, task work approval, advances and wage settlement/payment, and subcontractor work/payment screens.
- Critical wage state transitions use database RPCs; historical rates and money use PostgreSQL NUMERIC with decimal strings in client forms.
- Added `20261011001000_phase_5_labour_reporting.sql` for finance-authorized labour cost summaries, worker financial history and subcontractor advances. The workforce screens include project labour summary/history and subcontractor advance entry. Database calculation/concurrency/RLS tests and worker profile editing/inactivation remain incomplete.

## Phase 6 — Materials and procurement (local workflows; database verification pending)

- Added `20261011000700_phase_6_materials_procurement.sql` for suppliers, material catalogue, requisitions, purchase orders, goods receipts, stock movements, supplier invoices/payments and audit history.
- Added `20261011000900_phase_6_requisition_order_limits.sql` so a PO linked to a material request must use its approved request lines and cannot exceed the remaining approved quantity.
- Added `20261011001100_phase_6_receipt_reversal.sql` with an audited, guarded full goods-receipt reversal; purchase-order detail now lists receipts and allows authorized reversal only when received stock remains available. Partial returns and broader stock adjustment/transfer UX remain incomplete.
- Added materials/supplier directory, requisition create/list/quantity approval, purchase order create/approve/receive, stock issue, supplier invoice and payment workflows.
- Supplier payments use idempotency keys and a transactional RPC; actual inventory/payment balances have not been tested against Postgres.
- Partial supplier returns, comprehensive supplier invoice balance/reconciliation UX, broader stock adjustments/transfers, and full database integration tests remain incomplete.

## Current verification and blockers

- `npm run typecheck`: PASS.
- `npx eslint app src tests`: PASS.
- `npm test`: PASS — 25 validation/domain tests passed; 1 local Supabase integration suite skipped because the local stack was unavailable.
- `npx expo install --check`: dependency map reports up to date; online Expo version endpoint was unavailable, so this was offline validation.
- `npx expo export --platform web --output-dir .tmp/phase36-verified-export`: PASS after the latest source change.
- Docker CLI, Supabase CLI, and psql are unavailable in the current execution shell. Therefore none of the migrations 00300–01100 were executed against a database in this verification run.
- Remote Supabase migration history and policy mismatch remain unresolved. **No remote migration was pushed/repaired and no production rows were written.** The app's new DB modules cannot work against the remote database until migrations are safely reconciled, applied and verified.
- Latest source verification: `npm run typecheck`, `npm run lint`, and `npm test` passed (25 pass, 1 skipped); `npx expo export --platform web --output-dir .tmp/phase36-verified-export` passed. Phase 3–6 local workflows are not fully database/security verified or production-ready. Do not use remote production until migration history/schema comparison, staging migration, RLS tests, and device tests are complete. Remaining tasks are tracked in [PHASE_3_6_STATUS.md](./PHASE_3_6_STATUS.md).

See [DATABASE_CONNECTIVITY_VERIFICATION.md](./DATABASE_CONNECTIVITY_VERIFICATION.md), [README.md](./README.md), and [ARCHITECTURE.md](./ARCHITECTURE.md) for configuration, routes, database design, and security details.
