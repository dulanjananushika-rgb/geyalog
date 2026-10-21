-- Phase 3: customers, project lifecycle, contract terms, milestones, scope and variations.
-- Depends on Phase 2 company membership and profile migrations.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 32),
  email text check (email is null or char_length(email) <= 320),
  address text check (address is null or char_length(address) <= 500),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index customers_org_name_idx on public.customers (organization_id, lower(name));

alter table public.projects
  add column project_reference text,
  add column customer_id uuid,
  add column description text,
  add column district text,
  add column project_type text not null default 'other' check (project_type in ('new_house', 'renovation', 'extension', 'commercial', 'other')),
  add column status text not null default 'planned' check (status in ('draft', 'planned', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  add column archived_at timestamptz,
  add column created_by_supervisor uuid references auth.users(id) on delete set null;
alter table public.projects add constraint projects_org_id_id_unique unique (organization_id, id);
alter table public.projects add constraint projects_customer_same_org_fk
  foreign key (organization_id, customer_id) references public.customers(organization_id, id);
create unique index projects_org_reference_uidx on public.projects (organization_id, project_reference) where project_reference is not null;
create index projects_org_status_date_idx on public.projects (organization_id, status, created_at desc);

create table public.project_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_role text not null default 'site_supervisor' check (assignment_role in ('site_supervisor')),
  active boolean not null default true,
  assigned_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (organization_id, project_id, user_id),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade
);
create index project_assignments_user_active_idx on public.project_assignments (user_id, active);

create table public.project_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null unique,
  contract_reference text,
  contract_date date,
  contract_scope text,
  agreed_value numeric(18,2) check (agreed_value is null or agreed_value >= 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  cost_plus_formula text,
  payment_terms text,
  retention_terms text,
  warranty_notes text,
  additional_conditions text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade,
  unique (organization_id, project_id)
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  position integer not null check (position >= 0),
  planned_start_date date,
  planned_end_date date,
  weight numeric(7,4) check (weight is null or weight between 0 and 100),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade,
  unique (organization_id, project_id, id),
  unique (organization_id, project_id, position),
  check (planned_start_date is null or planned_end_date is null or planned_end_date >= planned_start_date)
);
create index project_milestones_order_idx on public.project_milestones (organization_id, project_id, position);

create table public.project_payment_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  milestone_id uuid,
  description text not null check (char_length(btrim(description)) between 1 and 240),
  payment_type text not null check (payment_type in ('advance', 'milestone', 'progress', 'weekly', 'monthly', 'unit_rate', 'final_settlement', 'retention')),
  planned_amount numeric(18,2) check (planned_amount is null or planned_amount >= 0),
  planned_percentage numeric(7,4) check (planned_percentage is null or planned_percentage between 0 and 100),
  expected_date date,
  trigger_condition text,
  notes text,
  sequence integer not null default 0 check (sequence >= 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade,
  foreign key (organization_id, project_id, milestone_id) references public.project_milestones(organization_id, project_id, id),
  unique (organization_id, project_id, id),
  check (planned_amount is not null or planned_percentage is not null or payment_type in ('progress', 'unit_rate'))
);
create index project_payment_terms_date_idx on public.project_payment_terms (organization_id, project_id, expected_date, sequence);

create table public.project_scope_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 240),
  inclusion text not null check (inclusion in ('included', 'excluded')),
  material_responsibility text not null check (material_responsibility in ('contractor', 'customer', 'third_party', 'not_applicable')),
  labour_responsibility text not null check (labour_responsibility in ('contractor', 'customer', 'third_party', 'not_applicable')),
  notes text,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade,
  unique (organization_id, project_id, position)
);

create table public.project_variations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  variation_reference text not null default ('VAR-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10))),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  reason text,
  proposed_cost_adjustment numeric(18,2),
  proposed_schedule_days integer check (proposed_schedule_days is null or proposed_schedule_days between -3650 and 3650),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  approval_notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade,
  unique (organization_id, project_id, variation_reference),
  check ((status = 'approved') = (approved_at is not null and approved_by is not null))
);
create index project_variations_project_status_idx on public.project_variations (organization_id, project_id, status, created_at desc);

-- Backfill each legacy project's customer and preserve the previously entered
-- contract amount as the original agreement, without counting variations.
insert into public.customers (organization_id, name, phone, created_by)
select p.organization_id, p.customer_name, p.customer_contact, p.created_by from public.projects p;
update public.projects p set customer_id = c.id
from public.customers c
where c.organization_id = p.organization_id and c.name = p.customer_name and p.customer_id is null
  and c.created_by = p.created_by;
update public.projects set project_reference = 'GL-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10))
where project_reference is null;
alter table public.projects alter column project_reference set default ('GL-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10)));
alter table public.projects alter column project_reference set not null;
insert into public.project_contracts (organization_id, project_id, agreed_value, currency_code, status, created_by)
select organization_id, id, contract_value, currency_code, 'draft', created_by from public.projects
on conflict (project_id) do nothing;

create view public.project_contract_summary with (security_invoker = true) as
select c.organization_id, c.project_id, c.contract_reference, c.contract_date, c.agreed_value,
  coalesce(sum(v.proposed_cost_adjustment) filter (where v.status = 'approved'), 0)::numeric(18,2) as approved_variation_total,
  case when c.agreed_value is null then null else (c.agreed_value + coalesce(sum(v.proposed_cost_adjustment) filter (where v.status = 'approved'), 0))::numeric(18,2) end as revised_agreed_value,
  c.currency_code, c.cost_plus_formula, c.status
from public.project_contracts c
left join public.project_variations v on v.organization_id = c.organization_id and v.project_id = c.project_id
group by c.organization_id, c.project_id, c.contract_reference, c.contract_date, c.agreed_value, c.currency_code, c.cost_plus_formula, c.status;
grant select on public.project_contract_summary to authenticated;

create or replace function public.can_access_project(target_organization_id uuid, target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and (m.role in ('owner', 'admin', 'accountant', 'viewer')
        or (m.role = 'site_supervisor' and exists (
          select 1 from public.project_assignments a
          where a.organization_id = target_organization_id and a.project_id = target_project_id
            and a.user_id = m.user_id and a.active
        )))
  );
$$;

create or replace function public.can_manage_project(target_organization_id uuid, target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_read_contract(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin', 'accountant')
  );
$$;

create or replace function public.create_project_with_contract(
  target_organization_id uuid,
  target_customer_id uuid,
  customer_name_input text,
  customer_phone_input text,
  customer_email_input text,
  customer_address_input text,
  project_name_input text,
  project_description_input text,
  project_location_input text,
  project_district_input text,
  project_type_input text,
  project_contract_type_input text,
  project_pricing_model_input text,
  project_start_input date,
  project_end_input date,
  contract_reference_input text,
  contract_date_input date,
  agreed_value_input numeric,
  contract_scope_input text,
  cost_plus_formula_input text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare customer_row public.customers%rowtype; project_id uuid;
begin
  if not public.can_manage_organization(target_organization_id) then raise exception 'Not authorized'; end if;
  if char_length(btrim(project_name_input)) not between 1 and 160 then raise exception 'Project name is required'; end if;
  if project_type_input not in ('new_house', 'renovation', 'extension', 'commercial', 'other') then raise exception 'Invalid project type'; end if;
  if project_contract_type_input not in ('full', 'labour_only', 'hybrid') then raise exception 'Invalid contract type'; end if;
  if project_pricing_model_input not in ('fixed_price', 'unit_rate', 'cost_plus') then raise exception 'Invalid pricing model'; end if;
  if project_end_input is not null and project_start_input is not null and project_end_input < project_start_input then raise exception 'End date must follow start date'; end if;
  if agreed_value_input is not null and agreed_value_input < 0 then raise exception 'Agreed value cannot be negative'; end if;
  if target_customer_id is null then
    if char_length(btrim(customer_name_input)) not between 1 and 160 then raise exception 'Customer name is required'; end if;
    insert into public.customers (organization_id, name, phone, email, address, created_by)
    values (target_organization_id, btrim(customer_name_input), nullif(btrim(customer_phone_input), ''), nullif(lower(btrim(customer_email_input)), ''), nullif(btrim(customer_address_input), ''), (select auth.uid()))
    returning * into customer_row;
  else
    select * into customer_row from public.customers where id = target_customer_id and organization_id = target_organization_id for share;
    if customer_row.id is null then raise exception 'Customer not found in this company'; end if;
  end if;
  insert into public.projects (organization_id, customer_id, name, customer_name, customer_contact, location, district, description, project_type, contract_type, pricing_model, payment_arrangement, expected_start_date, expected_end_date, status, created_by)
  values (target_organization_id, customer_row.id, btrim(project_name_input), customer_row.name, customer_row.phone, btrim(project_location_input), nullif(btrim(project_district_input), ''), nullif(btrim(project_description_input), ''), project_type_input, project_contract_type_input, project_pricing_model_input, 'as_agreed', project_start_input, project_end_input, 'draft', (select auth.uid()))
  returning id into project_id;
  insert into public.project_contracts (organization_id, project_id, contract_reference, contract_date, contract_scope, agreed_value, currency_code, cost_plus_formula, status, created_by)
  values (target_organization_id, project_id, nullif(btrim(contract_reference_input), ''), contract_date_input, nullif(btrim(contract_scope_input), ''), agreed_value_input, 'LKR', nullif(btrim(cost_plus_formula_input), ''), 'draft', (select auth.uid()));
  if project_pricing_model_input = 'cost_plus' and cost_plus_formula_input is not null and char_length(btrim(cost_plus_formula_input)) > 1200 then
    raise exception 'Cost-plus formula is too long';
  end if;
  return project_id;
end;
$$;

create or replace function public.assign_project_supervisor(target_organization_id uuid, target_project_id uuid, target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_project(target_organization_id, target_project_id) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = target_organization_id
      and m.user_id = target_user_id and m.role = 'site_supervisor' and m.status = 'active') then
    raise exception 'An active Site Supervisor membership is required';
  end if;
  insert into public.project_assignments (organization_id, project_id, user_id, assigned_by, active)
  values (target_organization_id, target_project_id, target_user_id, (select auth.uid()), true)
  on conflict (organization_id, project_id, user_id) do update set active = true, assigned_by = (select auth.uid()), assigned_at = now();
  update public.projects set created_by_supervisor = target_user_id where organization_id = target_organization_id and id = target_project_id;
end;
$$;

create or replace function public.decide_project_variation(target_variation_id uuid, decision text, decision_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare variation public.project_variations%rowtype;
begin
  select * into variation from public.project_variations where id = target_variation_id for update;
  if variation.id is null or not public.can_manage_project(variation.organization_id, variation.project_id) then raise exception 'Not authorized'; end if;
  if variation.status <> 'submitted' then raise exception 'Only submitted variations can be decided'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  if decision = 'approved' and variation.created_by = (select auth.uid()) then raise exception 'A variation author cannot approve their own request'; end if;
  update public.project_variations set status = decision, approval_notes = decision_notes,
    approved_by = case when decision = 'approved' then (select auth.uid()) else null end,
    approved_at = case when decision = 'approved' then now() else null end, updated_at = now()
  where id = target_variation_id;
end;
$$;

create or replace function public.enforce_project_status_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> old.status and not (
    (old.status = 'draft' and new.status in ('planned', 'cancelled')) or
    (old.status = 'planned' and new.status in ('active', 'on_hold', 'cancelled')) or
    (old.status = 'active' and new.status in ('on_hold', 'completed', 'cancelled')) or
    (old.status = 'on_hold' and new.status in ('active', 'cancelled')) or
    (old.status in ('completed', 'cancelled') and new.status = 'archived')
  ) then raise exception 'Invalid project status transition: % to %', old.status, new.status; end if;
  if new.status = 'archived' and old.status <> 'archived' then new.archived_at := now(); end if;
  if new.status <> 'archived' then new.archived_at := null; end if;
  return new;
end;
$$;
create trigger projects_status_transition before update of status on public.projects
  for each row execute function public.enforce_project_status_transition();

create or replace function public.protect_approved_contract()
returns trigger language plpgsql set search_path = '' as $$
declare contract_price_model text;
begin
  if old.status <> 'draft' and (
    new.contract_reference is distinct from old.contract_reference or new.contract_date is distinct from old.contract_date or
    new.contract_scope is distinct from old.contract_scope or new.agreed_value is distinct from old.agreed_value or
    new.currency_code is distinct from old.currency_code or new.cost_plus_formula is distinct from old.cost_plus_formula or
    new.payment_terms is distinct from old.payment_terms or new.retention_terms is distinct from old.retention_terms or
    new.warranty_notes is distinct from old.warranty_notes or new.additional_conditions is distinct from old.additional_conditions
  ) then raise exception 'Approved contract terms must be changed through a variation'; end if;
  select pricing_model into contract_price_model from public.projects where organization_id = new.organization_id and id = new.project_id;
  if contract_price_model = 'cost_plus' and new.status = 'active' and coalesce(btrim(new.cost_plus_formula), '') = '' then
    raise exception 'Cost-plus charging formula is required before activating the contract';
  end if;
  return new;
end;
$$;
create trigger project_contracts_protect_agreement before update on public.project_contracts
  for each row execute function public.protect_approved_contract();

create or replace function public.require_draft_contract_for_scope()
returns trigger language plpgsql set search_path = '' as $$
declare target_org uuid; target_project uuid; contract_status text;
begin
  target_org := coalesce(new.organization_id, old.organization_id);
  target_project := coalesce(new.project_id, old.project_id);
  select status into contract_status from public.project_contracts
    where organization_id = target_org and project_id = target_project;
  if contract_status is not null and contract_status <> 'draft' then
    raise exception 'Approved project scope must be changed through a variation';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger project_scope_draft_only before insert or update or delete on public.project_scope_items
  for each row execute function public.require_draft_contract_for_scope();

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.project_contracts
  for each row execute function public.set_updated_at();
create trigger milestones_set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();
create trigger payment_terms_set_updated_at before update on public.project_payment_terms
  for each row execute function public.set_updated_at();
create trigger scope_items_set_updated_at before update on public.project_scope_items
  for each row execute function public.set_updated_at();
create trigger variations_set_updated_at before update on public.project_variations
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.project_assignments enable row level security;
alter table public.project_contracts enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_payment_terms enable row level security;
alter table public.project_scope_items enable row level security;
alter table public.project_variations enable row level security;

drop policy if exists "Members can read organization projects" on public.projects;
create policy "Authorized members can read project" on public.projects for select to authenticated
  using (public.can_access_project(organization_id, id));
drop policy if exists "Managers can create organization projects" on public.projects;
create policy "Managers can create projects" on public.projects for insert to authenticated
  with check (public.can_manage_project(organization_id, id) and created_by = (select auth.uid()));
drop policy if exists "Managers can update organization projects" on public.projects;
create policy "Managers can update projects" on public.projects for update to authenticated
  using (public.can_manage_project(organization_id, id)) with check (public.can_manage_project(organization_id, id));
drop policy if exists "Owners and admins can delete organization projects" on public.projects;
create policy "Owners and admins can delete draft projects" on public.projects for delete to authenticated
  using (public.can_manage_project(organization_id, id) and status = 'draft');

create policy "Members can read customers for accessible projects" on public.customers for select to authenticated
  using (public.is_organization_member(organization_id) and (
    public.current_organization_role(organization_id) in ('owner', 'admin', 'accountant', 'viewer') or exists (
      select 1 from public.projects p where p.organization_id = customers.organization_id and p.customer_id = customers.id
        and public.can_access_project(p.organization_id, p.id)
    )));
create policy "Managers can create customers" on public.customers for insert to authenticated
  with check (public.can_manage_organization(organization_id) and created_by = (select auth.uid()));
create policy "Managers can update customers" on public.customers for update to authenticated
  using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));

create policy "Members can read own project assignments" on public.project_assignments for select to authenticated
  using (public.is_organization_member(organization_id) and (user_id = (select auth.uid()) or public.can_manage_project(organization_id, project_id)));
create policy "Managers can assign project staff" on public.project_assignments for all to authenticated
  using (public.can_manage_project(organization_id, project_id)) with check (public.can_manage_project(organization_id, project_id));

create policy "Authorized members can read contracts" on public.project_contracts for select to authenticated
  using (public.can_read_contract(organization_id));
create policy "Managers can create draft contracts" on public.project_contracts for insert to authenticated
  with check (public.can_manage_project(organization_id, project_id) and status = 'draft');
create policy "Managers can update contracts" on public.project_contracts for update to authenticated
  using (public.can_manage_project(organization_id, project_id)) with check (public.can_manage_project(organization_id, project_id));

create policy "Authorized members can read milestones" on public.project_milestones for select to authenticated
  using (public.can_access_project(organization_id, project_id));
create policy "Managers can manage milestones" on public.project_milestones for all to authenticated
  using (public.can_manage_project(organization_id, project_id)) with check (public.can_manage_project(organization_id, project_id));

create policy "Authorized finance roles can read payment terms" on public.project_payment_terms for select to authenticated
  using (public.can_read_contract(organization_id));
create policy "Managers can manage payment terms" on public.project_payment_terms for all to authenticated
  using (public.can_manage_project(organization_id, project_id)) with check (public.can_manage_project(organization_id, project_id));

create policy "Authorized members can read project scope" on public.project_scope_items for select to authenticated
  using (public.can_access_project(organization_id, project_id));
create policy "Managers can manage project scope" on public.project_scope_items for all to authenticated
  using (public.can_manage_project(organization_id, project_id)) with check (public.can_manage_project(organization_id, project_id));

create policy "Authorized finance roles can read variations" on public.project_variations for select to authenticated
  using (public.can_read_contract(organization_id));
create policy "Managers can create draft variations" on public.project_variations for insert to authenticated
  with check (public.can_manage_project(organization_id, project_id) and created_by = (select auth.uid()) and status = 'draft');
create policy "Authors can update their draft variations" on public.project_variations for update to authenticated
  using (created_by = (select auth.uid()) and status = 'draft' and public.can_manage_project(organization_id, project_id))
  with check (created_by = (select auth.uid()) and status in ('draft', 'submitted') and public.can_manage_project(organization_id, project_id));

-- Keep legacy amount private. Variable contract agreements live in the
-- permission-protected project_contracts relation.
revoke select on public.projects from authenticated;
grant select (id, organization_id, name, customer_name, customer_contact, location, contract_type, pricing_model, payment_arrangement, currency_code, expected_start_date, expected_end_date, created_by, created_at, updated_at, project_reference, customer_id, description, district, project_type, status, archived_at, created_by_supervisor) on public.projects to authenticated;
revoke insert, update on public.projects from authenticated;
grant insert (organization_id, name, customer_name, customer_contact, location, contract_type, pricing_model, payment_arrangement, expected_start_date, expected_end_date, currency_code, created_by, project_reference, customer_id, description, district, project_type, status) on public.projects to authenticated;
grant update (name, customer_name, customer_contact, location, contract_type, pricing_model, payment_arrangement, expected_start_date, expected_end_date, currency_code, project_reference, customer_id, description, district, project_type, status) on public.projects to authenticated;
revoke delete on public.projects from authenticated;
grant select, insert, update on public.customers, public.project_assignments, public.project_contracts, public.project_milestones, public.project_payment_terms, public.project_scope_items, public.project_variations to authenticated;
revoke delete on public.customers, public.project_assignments, public.project_contracts, public.project_milestones, public.project_payment_terms, public.project_scope_items, public.project_variations from authenticated;
revoke update on public.project_variations from authenticated;
grant update (description, reason, proposed_cost_adjustment, proposed_schedule_days, status, updated_at) on public.project_variations to authenticated;

revoke all on function public.can_access_project(uuid, uuid) from public, anon;
revoke all on function public.can_manage_project(uuid, uuid) from public, anon;
revoke all on function public.can_read_contract(uuid) from public, anon;
revoke all on function public.create_project_with_contract(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, date, numeric, text, text) from public, anon;
revoke all on function public.assign_project_supervisor(uuid, uuid, uuid) from public, anon;
revoke all on function public.decide_project_variation(uuid, text, text) from public, anon;
revoke all on function public.enforce_project_status_transition() from public, anon, authenticated;
revoke all on function public.protect_approved_contract() from public, anon, authenticated;
revoke all on function public.require_draft_contract_for_scope() from public, anon, authenticated;
grant execute on function public.can_access_project(uuid, uuid) to authenticated;
grant execute on function public.can_manage_project(uuid, uuid) to authenticated;
grant execute on function public.can_read_contract(uuid) to authenticated;
grant execute on function public.create_project_with_contract(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, date, date, text, date, numeric, text, text) to authenticated;
grant execute on function public.assign_project_supervisor(uuid, uuid, uuid) to authenticated;
grant execute on function public.decide_project_variation(uuid, text, text) to authenticated;

