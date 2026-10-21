# GeyaLog application architecture

## Runtime and navigation

- Expo SDK 57, React Native, TypeScript, Expo Router, React Hook Form/Zod, TanStack Query, and Supabase JS v2.
- `SessionProvider` owns the Auth session state. It waits for Supabase session restoration before the root navigator enables either route group.
- `Stack.Protected` exposes `(auth)` while signed out and `(app)` while signed in. `app/index.tsx` is the single entry redirect. The email callback is a narrow public route that exchanges an Auth link before moving to the protected destination.
- `app/(app)/index.tsx` is the Phase 1 authenticated placeholder. Profile routes live below `(app)/profile` and password recovery ends at `(app)/reset-password`.
- Existing Phase 0 company and project screens remain unchanged under `(app)` to preserve that completed functionality; Phase 1 adds no business modules or new customer/worker access.
- The profile language registry currently supports `en`, `si`, and `ta`; new feature dictionaries can be added incrementally. Full interface translation has not been undertaken.

## Supabase client and session lifecycle

`src/lib/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (with the legacy anon variable accepted for existing local setups). It uses PKCE, persists sessions, and disables browser URL auto-detection because Expo Router handles callbacks.

- iOS/Android: the Supabase auth storage adapter delegates to Expo SecureStore (Keychain/Keystore). On the first read it migrates a pre-existing Phase 0 AsyncStorage auth session into SecureStore, then removes the unencrypted copy.
- Web preview: browser `localStorage` is used because SecureStore is a native-only module. This preview storage is not encrypted by Expo SecureStore.
- Native app state: token refresh starts in the foreground and stops while inactive/backgrounded.
- Provider state is driven by Supabase auth-state events and an initial persisted-session read. Secrets/passwords are not written to logs.
- Supabase publishable/anon keys are public client identifiers and rely on Postgres RLS. A service-role/secret key must only be used in trusted server environments and is never shipped in the app.

## Auth routes and flow

| Route | Access | Purpose |
| --- | --- | --- |
| `/(auth)/welcome` | Signed out | Brand landing and sign-in/create-account actions |
| `/(auth)/sign-up` | Signed out | Validated email/password registration and full-name metadata |
| `/(auth)/verify-email` | Signed out | Verification instructions and cooldown-controlled resend |
| `/(auth)/sign-in` | Signed out | Supabase email/password sign-in |
| `/(auth)/forgot-password` | Signed out | Supabase password-reset email request |
| `/auth/callback` | Deep link | PKCE-code or token callback exchange; signup/recovery routing |
| `/(app)` | Signed in | Temporary authenticated home |
| `/(app)/profile` | Signed in | Own profile, email, language and account date; logout |
| `/(app)/profile/edit` | Signed in | Full name and language update only |
| `/(app)/reset-password` | Signed in recovery session | Update password using Supabase Auth |

Supabase Auth rejects unconfirmed accounts when confirmations are enabled. The client also routes a returned unconfirmed user back to the verification screen. This client check is not a replacement for the Auth provider's confirmation setting.

## Database schema

`public.profiles` in `20261011000200_phase_1_auth_profiles.sql`:

| Column | Type | Rule |
| --- | --- | --- |
| `id` | UUID | Primary key and cascading FK to `auth.users(id)` |
| `full_name` | text | Required; max 120 characters; empty is allowed only for migrated legacy users with no metadata |
| `preferred_language` | text | `en`, `si`, or `ta`; defaults to `en` |
| `created_at` | timestamptz | Mirrors the Auth user creation time for signup/backfill |
| `updated_at` | timestamptz | Server trigger maintained |

An `AFTER INSERT` Auth trigger inserts a profile atomically using bounded `full_name` metadata; an existing-user backfill runs when the migration is applied. The trigger is `SECURITY DEFINER`, pins an empty `search_path`, and clients cannot execute it directly.

## Authorization and data boundaries

- RLS is enabled on `public.profiles`.
- SELECT and UPDATE policies constrain rows to `id = auth.uid()`.
- `anon` has no table grants. `authenticated` receives SELECT and column-level UPDATE only for `full_name` and `preferred_language`.
- Clients receive no INSERT, DELETE, or UPDATE grant for `id`, `created_at`, or `updated_at`. Profile creation is trigger-owned.
- Email is read from the Auth session; an ordinary profile update cannot change email. Email-change flow is deliberately absent.
- Route guards control rendering/navigation; they do not authorize database access. RLS and grants do.
- Organization membership and role-based tenant access remain in the existing Phase 0 migration. Future company-scoped roles should be built on that organization membership model in Phase 2; Phase 1 adds no global admin role.

## Mobile deep-link configuration

`app.json` already declares the native `geyalog` scheme. The app creates `geyalog://auth/callback` for signup and `geyalog://auth/callback?intent=recovery` for password recovery. In a Supabase project, allow both redirect URLs in **Authentication → URL Configuration** and keep email confirmation enabled. For Expo Go, allow the exact redirect URL returned by `Linking.createURL` for that development session. A native binary must be rebuilt after scheme/native-module configuration changes.

Signup and password reset use Supabase Auth PKCE email flows. The callback exchanges `code` via `exchangeCodeForSession`; a token callback with access/refresh tokens is also handled. Callback credentials are processed in memory only and never logged. Invalid, expired, or incomplete links show recovery instructions.

## Configuration and migrations

1. Copy `.env.example` to `.env` and set the project URL and publishable key.
2. Apply `20261011000100_phase_01_foundation.sql` first for a new project, then `20261011000200_phase_1_auth_profiles.sql`.
3. Enable email confirmations and allow the app callback URLs in Supabase Auth.
4. Configure SMTP for production email deliverability, then test on a device build with a real Supabase project.

No project credentials were present during the original Phase 1 implementation. A later connectivity verification is recorded in [DATABASE_CONNECTIVITY_VERIFICATION.md](./DATABASE_CONNECTIVITY_VERIFICATION.md): remote Auth/API reachability is confirmed, while remote authenticated flows and email delivery remain unverified. The remote migration tracking table is absent, and remote policy names differ from the local files, so migration history has not been repaired.

## Database verification snapshot — 2026-10-11

- The remote public schema has `profiles`, `organizations`, `organization_members`, and `projects`; RLS is enabled on these tables. Its migration history is not initialized.
- The checked-in Phase 0/1 migrations apply successfully to a local Supabase/Postgres stack and pass a local two-user tenant-isolation smoke test.
- This checkout does not contain the Phase 2–6 schema or application modules. Do not infer their deployment or readiness from the remote Auth health response.

## Phase 2 organization architecture (local implementation; remote migration not deployed)

- `organizations` holds company identity and business contact settings. `organization_members` is the source of company-specific roles and active membership status; profile metadata is not authorization data.
- `create_organization(...)` inserts the company and owner membership in one Postgres transaction. Mobile callers cannot insert membership rows directly.
- Owner/Admin company-management actions use SECURITY DEFINER RPCs with a fixed empty `search_path`, active-membership checks, non-assignable Owner role, and protected owner records.
- `organization_invitations` stores a token hash, normalized email, permitted role, status, expiry, inviter, and acceptance actor/time. Invitations are accepted only by a signed-in Auth user whose verified account email matches the invite. The one-time token is delivered via the trusted Edge Function; table SELECT never returns it.
- Client company switching caches only an active organization ID; membership is re-read through RLS. Tenant-scoped React Query keys are removed on switch. RLS remains authoritative even if a caller forges an organization ID.
- `src/lib/permissions.ts` centralizes role mappings for future project, payment, labour, and material modules. Those future permissions are not enforced by business tables until those tables exist.
- Migration `20261011000300_phase_2_company_management.sql` is local-only and has not been applied to Supabase. The production migration history/policy mismatch must be reconciled first.

See [PHASE_2_COMPANY_MANAGEMENT.md](./PHASE_2_COMPANY_MANAGEMENT.md) for database, SMTP/Resend, Edge Function, and current verification notes.

## Phases 3–6 local database additions

- Phase 3 migration adds company-scoped customers, projects, contracts, scope items, milestones, payment terms and variations. Original fixed contract amount remains separate from approved variations; unit-rate and cost-plus values may remain undetermined.
- Phase 4 migration adds customer payment obligations, immutable receipt/allocation history, refunds, reversals and financial summary functions. These are customer receipts only; they are not profit or labour/supplier costs.
- Phase 5 migrations add workers, project assignments, effective-dated rate agreements, attendance/earning snapshots, task-based work, advances, settlements and subcontractor agreements/work/payments. Follow-up migration `20261011001000_phase_5_labour_reporting.sql` adds permission-checked project labour totals, worker financial history and subcontractor advances. These SQL functions have not been executed in a test database yet.
- Phase 6 migration adds supplier/material/procurement/inventory entities, transactional requisition/PO review, receiving/issue and supplier invoice/payment flows. Migration `20261011001100_phase_6_receipt_reversal.sql` adds audited full-receipt reversal with available-stock and PO-quantity checks. Partial returns are not supported; schema/RLS and mobile end-to-end behavior remain unverified.
- Phase 5 subcontractor workflows are in `20261011000800_phase_5_subcontractor_workflows.sql`. Numeric user input is passed as strings to Postgres RPCs so money is not converted through JavaScript floating point. These local changes have not been deployed remotely.
- The ordered local migration set now extends through `20261011001100`. Do not push it to the production Supabase project: prior migration-history and policy equivalence checks remain unresolved. The current shell has no usable Docker, Supabase CLI, or `psql`, so local database and RLS verification is blocked.
- Every migration from Phase 2 onward is local source only. The remote project has not been changed. Migration history mismatch plus unavailable local Docker/Postgres execution means SQL and RLS have not been validated for those later phases. Do not enable these routes against production until migrations and authorization tests pass.

See [PHASE_3_6_STATUS.md](./PHASE_3_6_STATUS.md) for the feature-by-feature completion and verification status.
