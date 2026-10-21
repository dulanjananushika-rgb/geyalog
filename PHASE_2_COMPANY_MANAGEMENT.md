# Phase 2 — Company Management & Role Access

Status: implementation underway; remote schema and end-to-end invitation delivery are not verified.

## What is in this checkout

- Company profile fields and an organization creation RPC that creates the company and its first Owner membership in one database transaction.
- Active/suspended/removed membership status, multi-company memberships, Owner/Admin/Site Supervisor/Accountant roles, and a restricted legacy `viewer` role for existing rows.
- Database-backed helpers and RPCs for member role changes, suspension/removal, invitation creation/acceptance/revocation, and active company membership.
- An invitation table stores only a SHA-256 token hash. The one-time raw token is returned by the authorized RPC to the trusted Edge Function; invitation emails are sent server-side and never reported sent if delivery fails.
- Company setup, workspace selection, team list, invitation form, invitation deep link, and a minimal company workspace screen.

## Migration

`supabase/migrations/20261011000300_phase_2_company_management.sql` extends the existing Phase 0 schema. It expects both Phase 0 and Phase 1 migrations to have been applied first, including `public.profiles`.

Remote migration history/schema reconciliation is unresolved. **Do not run `supabase db push` or manually paste this migration into the production SQL Editor yet.** The previously inspected remote project had no migration tracking table, and its organization policies did not match this repository. This migration has not been applied remotely or validated against the current local Docker database in this shell.

After schema equivalence and safe staging are established, apply the migration to local/staging first and run `npm run test:supabase:local`. Only then prepare and review a production migration plan.

## Invitation delivery setup

Deploy `supabase/functions/organization-invitations` with JWT verification enabled. Configure server-side function secrets (never `EXPO_PUBLIC_` variables):

```powershell
npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY GEYALOG_EMAIL_FROM="GeyaLog <verified-sender@your-domain.lk>" GEYALOG_INVITE_URL="geyalog://invite"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are expected from the Supabase Edge Function runtime. Verify the sender domain with Resend (or replace the mail transport with another trusted provider). Invite links must open `geyalog://invite?token=...`; add the app callback and invite URLs to the Supabase Auth Redirect URL allow-list. New users must verify the invited email, sign in, then accept the invitation. Existing users must sign in with the exact invited address.

No SMTP/email credentials are present in the app. Email delivery is not configured or verified in this checkout.

## Access rules

| Action | Owner | Admin | Site Supervisor | Accountant |
| --- | --- | --- | --- | --- |
| Edit company profile | Yes | Yes | No | No |
| View team | Yes | Yes | Self only | Self only |
| Invite staff | All supported non-Owner roles | Supervisor/Accountant | No | No |
| Assign Admin role | Yes | No | No | No |
| Change/remove Owner | No in this phase | No | No | No |
| Manage projects/contracts/payments | Future modules | Future modules | Future modules | Future modules |

These UI rules supplement database checks. Organization/company data remains behind RLS and membership helper functions. No `service_role` key is used by the mobile client. Full role-specific access for future business tables still needs feature migrations and RLS tests.

## Known gaps

- The Edge Function has not been deployed or tested with a verified sender/domain.
- Database migration has not run in the current shell; local Docker CLI was unavailable on PATH.
- Team screens currently provide basic invite/list/removal flows; fine-grained profile editing and complete role-change controls still need refinement.
- There is no Phase 3 project/contract or Phase 4–6 business module implementation in this checkout.
- Current checkout does not yet restore every previously documented Phase 1 screen. Auth routes are being rebuilt as part of making this app runnable; do not treat email recovery, full profile editing, or on-device link delivery as verified.
