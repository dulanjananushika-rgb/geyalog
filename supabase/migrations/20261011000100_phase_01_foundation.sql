-- Phase 01: company tenancy, membership roles, and core project records.
create extension if not exists pgcrypto with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'project_manager', 'field_staff', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 160),
  customer_contact text check (customer_contact is null or char_length(customer_contact) <= 32),
  location text not null check (char_length(btrim(location)) between 1 and 240),
  contract_type text not null check (contract_type in ('full', 'labour_only', 'hybrid')),
  pricing_model text not null check (pricing_model in ('fixed_price', 'unit_rate', 'cost_plus')),
  payment_arrangement text not null check (payment_arrangement in ('advance', 'progress', 'milestone', 'on_completion', 'as_agreed')),
  contract_value numeric(14,2) check (contract_value is null or contract_value >= 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  expected_start_date date,
  expected_end_date date,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_start_date is null or expected_end_date is null or expected_end_date >= expected_start_date)
);
create index projects_org_created_idx on public.projects(organization_id, created_at desc);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'project_manager')
  );
$$;

create or replace function public.create_organization(organization_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(organization_name)) not between 2 and 120 then
    raise exception 'Company name must be between 2 and 120 characters';
  end if;
  insert into public.organizations (name, created_by)
    values (btrim(organization_name), auth.uid()) returning id into new_organization_id;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_organization_id, auth.uid(), 'owner');
  return new_organization_id;
end;
$$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
revoke all on function public.is_organization_member(uuid) from public, anon;
grant execute on function public.is_organization_member(uuid) to authenticated;
revoke all on function public.can_manage_organization(uuid) from public, anon;
grant execute on function public.can_manage_organization(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;

create policy "Members can read their organizations" on public.organizations
  for select to authenticated using (public.is_organization_member(id));
create policy "Managers can update organizations" on public.organizations
  for update to authenticated using (public.can_manage_organization(id)) with check (public.can_manage_organization(id));

create policy "Members can read organization membership" on public.organization_members
  for select to authenticated using (
    user_id = (select auth.uid()) or public.can_manage_organization(organization_id)
  );

create policy "Members can read organization projects" on public.projects
  for select to authenticated using (public.is_organization_member(organization_id));
create policy "Managers can create organization projects" on public.projects
  for insert to authenticated with check (public.can_manage_organization(organization_id) and created_by = (select auth.uid()));
create policy "Managers can update organization projects" on public.projects
  for update to authenticated using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "Owners and admins can delete organization projects" on public.projects
  for delete to authenticated using (
    exists (select 1 from public.organization_members m where m.organization_id = projects.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin'))
  );

grant select on public.organizations to authenticated;
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, delete on public.projects to authenticated;
revoke update on public.projects from authenticated;
grant update (name, customer_name, customer_contact, location, contract_type, pricing_model, payment_arrangement, contract_value, expected_start_date, expected_end_date, currency_code) on public.projects to authenticated;
