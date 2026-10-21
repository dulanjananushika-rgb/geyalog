-- Phase 2: organization profiles, active membership roles, and secure invitations.
-- Apply only after reconciling this repository with the linked remote schema.

alter table public.organizations
  add column if not exists business_type text not null default 'individual_contractor'
    check (business_type in ('individual_contractor', 'construction_company')),
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists district text,
  add column if not exists registration_number text,
  add column if not exists description text,
  add column if not exists preferred_language text not null default 'en'
    check (preferred_language in ('en', 'si', 'ta')),
  add column if not exists updated_at timestamptz not null default now();

alter table public.organization_members
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'removed')),
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.organization_members
  add constraint organization_members_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Preserve the pre-Phase-2 roles as restricted legacy roles. Existing
-- project_manager had company-management access, so map it to admin.
alter table public.organization_members drop constraint if exists organization_members_role_check;
update public.organization_members set role = 'admin' where role = 'project_manager';
update public.organization_members set role = 'site_supervisor' where role = 'field_staff';
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'site_supervisor', 'accountant', 'viewer'));

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null check (char_length(invited_email) between 3 and 320),
  invited_role text not null check (invited_role in ('admin', 'site_supervisor', 'accountant')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organization_invitations_org_status_idx
  on public.organization_invitations (organization_id, status, created_at desc);
create index organization_invitations_email_idx
  on public.organization_invitations (lower(invited_email), status);
create unique index organization_invitations_pending_email_uidx
  on public.organization_invitations (organization_id, lower(invited_email))
  where status = 'pending';

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();
drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at before update on public.organization_invitations
  for each row execute function public.set_updated_at();

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.current_organization_role(target_organization_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
  where m.organization_id = target_organization_id
    and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

-- Replace the legacy one-argument RPC. The creation and Owner membership insert
-- happen in one Postgres transaction; clients cannot write membership rows.
drop function if exists public.create_organization(text);
create function public.create_organization(
  org_name text,
  org_business_type text,
  org_phone text,
  org_email text,
  org_address text,
  org_district text,
  org_registration_number text,
  org_description text,
  org_language text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(org_name)) not between 2 and 120 then raise exception 'Invalid company name'; end if;
  if org_business_type not in ('individual_contractor', 'construction_company') then raise exception 'Invalid business type'; end if;
  if org_language not in ('en', 'si', 'ta') then raise exception 'Invalid preferred language'; end if;
  insert into public.organizations (name, business_type, phone, email, address, district, registration_number, description, preferred_language, created_by)
  values (btrim(org_name), org_business_type, nullif(btrim(org_phone), ''), nullif(lower(btrim(org_email)), ''), nullif(btrim(org_address), ''), nullif(btrim(org_district), ''), nullif(btrim(org_registration_number), ''), nullif(btrim(org_description), ''), org_language, (select auth.uid()))
  returning id into new_id;
  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_id, (select auth.uid()), 'owner', 'active');
  return new_id;
end;
$$;

create or replace function public.change_organization_member_role(
  target_organization_id uuid, target_user_id uuid, new_role text
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_role text;
begin
  actor_role := public.current_organization_role(target_organization_id);
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'Not authorized'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'You cannot change your own role'; end if;
  if new_role not in ('admin', 'site_supervisor', 'accountant') then raise exception 'Role is not assignable'; end if;
  select role into target_role from public.organization_members
    where organization_id = target_organization_id and user_id = target_user_id and status = 'active' for update;
  if target_role is null then raise exception 'Active member not found'; end if;
  if target_role = 'owner' then raise exception 'Owner role cannot be changed here'; end if;
  if actor_role = 'admin' and (target_role = 'admin' or new_role = 'admin') then raise exception 'Admins cannot manage admin roles'; end if;
  update public.organization_members set role = new_role, updated_at = now()
    where organization_id = target_organization_id and user_id = target_user_id;
end;
$$;

create or replace function public.set_organization_member_status(
  target_organization_id uuid, target_user_id uuid, new_status text
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_role text; active_owners integer;
begin
  actor_role := public.current_organization_role(target_organization_id);
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'Not authorized'; end if;
  if target_user_id = (select auth.uid()) then raise exception 'You cannot suspend or remove yourself here'; end if;
  if new_status not in ('active', 'suspended', 'removed') then raise exception 'Invalid membership status'; end if;
  select role into target_role from public.organization_members
    where organization_id = target_organization_id and user_id = target_user_id for update;
  if target_role is null then raise exception 'Member not found'; end if;
  if target_role = 'owner' then raise exception 'Owner membership cannot be removed or suspended here'; end if;
  if actor_role = 'admin' and target_role = 'admin' then raise exception 'Admins cannot manage other admins'; end if;
  update public.organization_members set status = new_status, updated_at = now()
    where organization_id = target_organization_id and user_id = target_user_id;
  select count(*) into active_owners from public.organization_members
    where organization_id = target_organization_id and role = 'owner' and status = 'active';
  if active_owners < 1 then raise exception 'An organization must keep an active Owner'; end if;
end;
$$;

-- The raw token is returned exactly once to the trusted caller for email
-- delivery. Only its SHA-256 hash is persisted and table reads never reveal it.
create or replace function public.create_organization_invitation(
  target_organization_id uuid, target_email text, target_role text
)
returns table(invitation_id uuid, raw_token text, invitation_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor_role text; normalized_email text; generated_token text; new_invitation_id uuid; expiry timestamptz;
begin
  actor_role := public.current_organization_role(target_organization_id);
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'Not authorized'; end if;
  if actor_role = 'admin' and target_role = 'admin' then raise exception 'Admins cannot invite Admins'; end if;
  if target_role not in ('admin', 'site_supervisor', 'accountant') then raise exception 'Role is not assignable'; end if;
  normalized_email := lower(btrim(target_email));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  update public.organization_invitations set status = 'expired', updated_at = now()
    where organization_id = target_organization_id and lower(invited_email) = normalized_email
      and status = 'pending' and expires_at <= now();
  if exists (
    select 1 from public.organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = target_organization_id and lower(u.email) = normalized_email and m.status = 'active'
  ) then raise exception 'This person is already an active member'; end if;
  generated_token := encode(extensions.gen_random_bytes(32), 'hex');
  expiry := now() + interval '7 days';
  insert into public.organization_invitations (organization_id, invited_email, invited_role, invited_by, token_hash, expires_at)
  values (target_organization_id, normalized_email, target_role, (select auth.uid()), encode(extensions.digest(generated_token, 'sha256'), 'hex'), expiry)
  returning id into new_invitation_id;
  return query select new_invitation_id, generated_token, expiry;
end;
$$;

create or replace function public.accept_organization_invitation(raw_invitation_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.organization_invitations%rowtype; auth_email text; existing_status text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select lower(email) into auth_email from auth.users where id = (select auth.uid());
  select * into invite from public.organization_invitations
    where token_hash = encode(extensions.digest(raw_invitation_token, 'sha256'), 'hex') for update;
  if invite.id is null then raise exception 'Invitation is invalid'; end if;
  if invite.status = 'revoked' then raise exception 'Invitation has been revoked'; end if;
  if invite.status = 'accepted' then raise exception 'Invitation has already been used'; end if;
  if invite.expires_at <= now() then
    update public.organization_invitations set status = 'expired', updated_at = now() where id = invite.id;
    raise exception 'Invitation has expired';
  end if;
  if auth_email is null or auth_email <> lower(invite.invited_email) then raise exception 'Sign in with the invited email address'; end if;
  select status into existing_status from public.organization_members
    where organization_id = invite.organization_id and user_id = (select auth.uid()) for update;
  if existing_status = 'active' then raise exception 'Already an active member'; end if;
  if existing_status is null then
    insert into public.organization_members (organization_id, user_id, role, status, joined_at)
    values (invite.organization_id, (select auth.uid()), invite.invited_role, 'active', now());
  else
    update public.organization_members set role = invite.invited_role, status = 'active', joined_at = now(), updated_at = now()
    where organization_id = invite.organization_id and user_id = (select auth.uid());
  end if;
  update public.organization_invitations set status = 'accepted', accepted_at = now(), accepted_by = (select auth.uid()), updated_at = now()
    where id = invite.id;
  return invite.organization_id;
end;
$$;

create or replace function public.revoke_organization_invitation(target_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_org uuid; actor_role text;
begin
  select organization_id into target_org from public.organization_invitations where id = target_invitation_id;
  if target_org is null then raise exception 'Invitation not found'; end if;
  actor_role := public.current_organization_role(target_org);
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'Not authorized'; end if;
  update public.organization_invitations set status = 'revoked', updated_at = now()
    where id = target_invitation_id and status in ('pending', 'expired');
end;
$$;

alter table public.organization_invitations enable row level security;
drop policy if exists "Managers can read organization invitations" on public.organization_invitations;
create policy "Managers can read organization invitations" on public.organization_invitations
  for select to authenticated using (public.can_manage_organization(organization_id));

grant select on public.organization_invitations to authenticated;
revoke insert, update, delete on public.organization_invitations from anon, authenticated;
revoke insert, update, delete on public.organization_members from anon, authenticated;
revoke all on function public.create_organization(text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.change_organization_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.set_organization_member_status(uuid, uuid, text) from public, anon;
revoke all on function public.create_organization_invitation(uuid, text, text) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
revoke all on function public.revoke_organization_invitation(uuid) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.change_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.set_organization_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.create_organization_invitation(uuid, text, text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
revoke all on function public.current_organization_role(uuid) from public, anon;
grant execute on function public.current_organization_role(uuid) to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Company-scoped organization updates must not mutate ownership or authorization.
revoke update on public.organizations from authenticated;
grant update (name, business_type, phone, email, address, district, registration_number, description, preferred_language)
  on public.organizations to authenticated;

