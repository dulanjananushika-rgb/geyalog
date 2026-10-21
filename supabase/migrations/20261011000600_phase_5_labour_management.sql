-- Phase 5: workforce directory, project assignments, attendance, task work,
-- labour advances, settlements, and subcontractors. No materials/profit module.

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone text check (phone is null or char_length(phone) <= 32),
  skill_category text not null check (char_length(btrim(skill_category)) between 2 and 80),
  address text,
  emergency_contact text,
  engagement_type text not null check (engagement_type in ('employee', 'daily_worker', 'subcontractor_individual', 'other')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index workers_org_name_idx on public.workers (organization_id, lower(full_name));

create table public.worker_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid not null,
  work_role text not null check (char_length(btrim(work_role)) between 2 and 120),
  start_date date not null,
  end_date date,
  assigned_supervisor_id uuid references auth.users(id) on delete set null,
  earning_method text not null check (earning_method in ('daily_rate', 'weekly_rate', 'task_quantity')),
  payment_schedule text not null check (payment_schedule in ('daily', 'weekly', 'milestone', 'task_completion', 'custom')),
  status text not null default 'active' check (status in ('active', 'ended', 'suspended')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, worker_id) references public.workers(organization_id, id) on delete restrict,
  unique (organization_id, id),
  unique (organization_id, project_id, id),
  unique (organization_id, project_id, id, worker_id),
  check (end_date is null or end_date >= start_date)
);
create index worker_assignments_project_status_idx on public.worker_project_assignments (organization_id, project_id, status);
create index worker_assignments_worker_dates_idx on public.worker_project_assignments (organization_id, worker_id, start_date, end_date);

create table public.worker_rate_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  assignment_id uuid not null,
  worker_id uuid not null,
  earning_method text not null check (earning_method in ('daily_rate', 'weekly_rate', 'task_quantity')),
  rate numeric(18,4) not null check (rate > 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  unit_name text,
  half_day_factor numeric(6,5) not null default 0.50000 check (half_day_factor between 0 and 1),
  weekly_work_days numeric(3,1) not null default 6 check (weekly_work_days between 1 and 7),
  effective_from date not null,
  effective_to date,
  calculation_notes text,
  agreed_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id, assignment_id, worker_id) references public.worker_project_assignments(organization_id, project_id, id, worker_id) on delete restrict,
  unique (organization_id, id),
  check (effective_to is null or effective_to >= effective_from),
  check ((earning_method = 'task_quantity') = (unit_name is not null))
);
create index worker_rates_effective_idx on public.worker_rate_agreements (organization_id, assignment_id, effective_from desc);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_assignment_id uuid not null,
  worker_id uuid not null,
  work_date date not null,
  attendance_status text not null check (attendance_status in ('present', 'half_day', 'absent', 'approved_leave', 'other')),
  hours_worked numeric(5,2) check (hours_worked is null or hours_worked between 0 and 24),
  day_fraction numeric(6,5) not null default 1 check (day_fraction between 0 and 1),
  notes text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'superseded')),
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  correction_of uuid references public.attendance_records(id) on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id, worker_assignment_id, worker_id) references public.worker_project_assignments(organization_id, project_id, id, worker_id) on delete restrict,
  unique (organization_id, id),
  check (approval_status = 'superseded' or ((approval_status = 'approved') = (approved_at is not null and approved_by is not null))),
  check ((correction_of is null) = (correction_reason is null)),
  check ((attendance_status in ('absent','approved_leave') and day_fraction = 0) or attendance_status not in ('absent','approved_leave'))
);
create unique index attendance_unique_current_assignment_day on public.attendance_records (organization_id, worker_assignment_id, work_date) where approval_status <> 'superseded';
create index attendance_project_date_idx on public.attendance_records (organization_id, project_id, work_date desc);

create table public.labour_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  assignment_id uuid not null,
  task_name text not null check (char_length(btrim(task_name)) between 2 and 180),
  payment_basis text not null check (payment_basis in ('unit_rate', 'fixed_task')),
  unit_name text,
  unit_rate numeric(18,4) check (unit_rate is null or unit_rate > 0),
  fixed_amount numeric(18,2) check (fixed_amount is null or fixed_amount >= 0),
  estimated_quantity numeric(18,4) check (estimated_quantity is null or estimated_quantity >= 0),
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id, assignment_id) references public.worker_project_assignments(organization_id, project_id, id) on delete restrict,
  unique (organization_id, project_id, id),
  check ((payment_basis='unit_rate' and unit_name is not null and unit_rate is not null and fixed_amount is null) or (payment_basis='fixed_task' and fixed_amount is not null and unit_rate is null))
);
create index labour_tasks_project_status_idx on public.labour_tasks (organization_id, project_id, status);

create table public.labour_task_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid not null,
  reported_quantity numeric(18,4) not null check (reported_quantity > 0),
  approved_quantity numeric(18,4) check (approved_quantity is null or approved_quantity between 0 and reported_quantity),
  progress_date date not null default current_date,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id, task_id) references public.labour_tasks(organization_id, project_id, id) on delete restrict,
  unique (organization_id, id),
  check ((status='approved') = (approved_by is not null and approved_at is not null and approved_quantity is not null))
);

create table public.labour_earning_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid not null,
  assignment_id uuid not null,
  rate_agreement_id uuid not null,
  attendance_id uuid references public.attendance_records(id) on delete restrict,
  task_progress_id uuid references public.labour_task_progress(id) on delete restrict,
  earning_date date not null,
  basis_quantity numeric(18,4) not null check (basis_quantity >= 0),
  rate_snapshot numeric(18,4) not null check (rate_snapshot >= 0),
  amount numeric(18,2) not null check (amount >= 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  description text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id, assignment_id, worker_id) references public.worker_project_assignments(organization_id, project_id, id, worker_id) on delete restrict,
  foreign key (organization_id, rate_agreement_id) references public.worker_rate_agreements(organization_id, id) on delete restrict,
  unique (organization_id, id)
);
create unique index labour_earning_attendance_uidx on public.labour_earning_entries (organization_id,attendance_id) where attendance_id is not null;
create unique index labour_earning_task_progress_uidx on public.labour_earning_entries (organization_id,task_progress_id) where task_progress_id is not null;

create table public.labour_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid not null,
  assignment_id uuid,
  amount numeric(18,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash','bank_transfer','cheque','other')),
  reference text,
  notes text,
  status text not null default 'confirmed' check (status in ('pending_verification','confirmed','reversed')),
  idempotency_key text not null,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, worker_id) references public.workers(organization_id, id) on delete restrict,
  foreign key (organization_id, project_id, assignment_id, worker_id) references public.worker_project_assignments(organization_id, project_id, id, worker_id) on delete restrict,
  unique (organization_id, id),
  unique (organization_id,idempotency_key),
  check ((status in ('confirmed','reversed')) = (confirmed_by is not null and confirmed_at is not null)),
  check ((status='reversed') = (reversed_by is not null and reversed_at is not null and reversal_reason is not null)),
  check (payment_method not in ('bank_transfer','cheque') or status <> 'confirmed')
);

create table public.labour_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid not null,
  assignment_id uuid not null,
  period_start date not null,
  period_end date not null,
  gross_earned numeric(18,2) not null check (gross_earned >= 0),
  advance_offset numeric(18,2) not null default 0 check (advance_offset >= 0),
  status text not null default 'draft' check (status in ('draft','approved','partially_paid','paid','cancelled')),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id, assignment_id, worker_id) references public.worker_project_assignments(organization_id, project_id, id, worker_id) on delete restrict,
  unique (organization_id, project_id, worker_id, period_start, period_end),
  unique (organization_id, id),
  check (period_end >= period_start),
  check (advance_offset <= gross_earned),
  check ((status in ('approved','partially_paid','paid')) = (approved_by is not null and approved_at is not null))
);

create table public.labour_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid,
  subcontractor_id uuid,
  settlement_id uuid,
  subcontractor_work_record_id uuid,
  payment_amount numeric(18,2) not null check (payment_amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash','bank_transfer','cheque','other')),
  payment_purpose text not null check (payment_purpose in ('wage_settlement','advance','task_payment','partial_settlement','final_settlement','approved_adjustment')),
  status text not null check (status in ('pending_verification','confirmed','reversed')),
  reference text,
  notes text,
  idempotency_key text not null,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, worker_id) references public.workers(organization_id, id) on delete restrict,
  foreign key (organization_id, settlement_id) references public.labour_settlements(organization_id, id) on delete restrict,
  unique (organization_id, idempotency_key),
  check ((worker_id is null) <> (subcontractor_id is null)),
  check ((confirmed_at is null) = (confirmed_by is null)),
  check (status <> 'confirmed' or confirmed_at is not null),
  check ((status='reversed') = (reversed_at is not null and reversed_by is not null and reversal_reason is not null)),
  check (payment_method not in ('bank_transfer','cheque') or status <> 'confirmed')
);

create table public.labour_advance_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  worker_id uuid not null,
  advance_id uuid not null,
  settlement_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, advance_id) references public.labour_advances(organization_id, id) on delete restrict,
  foreign key (organization_id, settlement_id) references public.labour_settlements(organization_id, id) on delete restrict,
  unique (organization_id, advance_id, settlement_id)
);

create table public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 180),
  contact_name text,
  phone text,
  email text,
  address text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.subcontractor_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  subcontractor_id uuid not null,
  description text not null,
  payment_basis text not null check (payment_basis in ('unit_rate','fixed_task','milestone')),
  unit_name text,
  rate numeric(18,4),
  agreed_amount numeric(18,2),
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, subcontractor_id) references public.subcontractors(organization_id, id) on delete restrict,
  unique (organization_id, id),
  unique (organization_id, project_id, id)
);

create table public.subcontractor_work_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  agreement_id uuid not null,
  work_date date not null default current_date,
  reported_quantity numeric(18,4),
  approved_quantity numeric(18,4),
  agreed_amount numeric(18,2),
  approved_amount numeric(18,2),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  submitted_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id, agreement_id) references public.subcontractor_agreements(organization_id, project_id, id) on delete restrict,
  check ((status='approved') = (approved_by is not null and approved_at is not null)),
  unique (organization_id,id)
);

alter table public.labour_payment_transactions
  add constraint labour_payments_subcontractor_fk foreign key (organization_id,subcontractor_id) references public.subcontractors(organization_id,id) on delete restrict,
  add constraint labour_payments_subcontract_work_fk foreign key (organization_id,subcontractor_work_record_id) references public.subcontractor_work_records(organization_id,id) on delete restrict;

create table public.labour_transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  entity_type text not null check (entity_type in ('advance','settlement','labour_payment','task_progress','attendance')),
  entity_id uuid not null,
  action text not null check (action in ('created','approved','paid','reversed','corrected','allocated')),
  reason text,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict
);

create or replace function public.can_manage_labour(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'));
$$;
create or replace function public.can_manage_labour_finance(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','accountant'));
$$;
create or replace function public.can_record_project_attendance(target_organization_id uuid,target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and (
    m.role in ('owner','admin') or (m.role='site_supervisor' and exists (select 1 from public.project_assignments a where a.organization_id=target_organization_id and a.project_id=target_project_id and a.user_id=(select auth.uid()) and a.active))));
$$;

create or replace function public.assign_project_worker(
  target_organization_id uuid, target_project_id uuid, target_worker_id uuid,
  assignment_role text, assignment_start_date date, target_earning_method text,
  target_payment_schedule text, target_rate numeric, target_unit_name text,
  target_half_day_factor numeric, target_rate_effective_from date, target_weekly_work_days numeric default 6
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_assignment_id uuid;
begin
  if (select auth.uid()) is null or not public.can_manage_labour(target_organization_id) then raise exception 'Not authorized'; end if;
  if target_rate is null or target_rate <= 0 or target_rate <> round(target_rate,4) then raise exception 'Invalid worker rate'; end if;
  if target_earning_method not in ('daily_rate','weekly_rate','task_quantity') then raise exception 'Invalid earning method'; end if;
  if target_earning_method='task_quantity' and nullif(btrim(target_unit_name),'') is null then raise exception 'A unit is required for quantity-based work'; end if;
  if target_half_day_factor is null or target_half_day_factor < 0 or target_half_day_factor > 1 then raise exception 'Invalid half-day factor'; end if;
  if target_weekly_work_days is null or target_weekly_work_days < 1 or target_weekly_work_days > 7 then raise exception 'Invalid weekly work-day basis'; end if;
  insert into public.worker_project_assignments (
    organization_id,project_id,worker_id,work_role,start_date,earning_method,payment_schedule,created_by
  ) values (
    target_organization_id,target_project_id,target_worker_id,btrim(assignment_role),assignment_start_date,
    target_earning_method,target_payment_schedule,(select auth.uid())
  ) returning id into created_assignment_id;
  insert into public.worker_rate_agreements (
    organization_id,project_id,assignment_id,worker_id,earning_method,rate,unit_name,half_day_factor,weekly_work_days,effective_from,agreed_by
  ) values (
    target_organization_id,target_project_id,created_assignment_id,target_worker_id,target_earning_method,
    target_rate,nullif(btrim(target_unit_name),''),target_half_day_factor,target_weekly_work_days,target_rate_effective_from,(select auth.uid())
  );
  return created_assignment_id;
end;
$$;

create or replace function public.approve_worker_attendance(target_attendance_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare row_item public.attendance_records%rowtype; rate_row public.worker_rate_agreements%rowtype; earned_quantity numeric(18,4);
begin
  select * into row_item from public.attendance_records where id=target_attendance_id for update;
  if row_item.id is null or not public.can_manage_labour(row_item.organization_id) then raise exception 'Not authorized'; end if;
  if row_item.approval_status <> 'pending' then raise exception 'Only pending attendance can be approved'; end if;
  update public.attendance_records set approval_status='approved',approved_by=(select auth.uid()),approved_at=now(),updated_at=now() where id=row_item.id;
  if row_item.attendance_status in ('present','half_day') then
    select * into rate_row from public.worker_rate_agreements r where r.organization_id=row_item.organization_id and r.assignment_id=row_item.worker_assignment_id and r.effective_from<=row_item.work_date and (r.effective_to is null or r.effective_to>=row_item.work_date) order by r.effective_from desc limit 1;
    if rate_row.id is not null and rate_row.earning_method in ('daily_rate','weekly_rate') then
      earned_quantity := case when rate_row.earning_method='weekly_rate' then row_item.day_fraction/rate_row.weekly_work_days else row_item.day_fraction end;
      insert into public.labour_earning_entries (organization_id,project_id,worker_id,assignment_id,rate_agreement_id,attendance_id,earning_date,basis_quantity,rate_snapshot,amount,description,created_by)
      values (row_item.organization_id,row_item.project_id,row_item.worker_id,row_item.worker_assignment_id,rate_row.id,row_item.id,row_item.work_date,earned_quantity,rate_row.rate,round(rate_row.rate*earned_quantity,2),case when rate_row.earning_method='weekly_rate' then 'Weekly rate prorated by configured work-day basis' else 'Approved attendance' end,(select auth.uid()));
    end if;
  end if;
end;
$$;

create or replace function public.correct_worker_attendance(
  target_attendance_id uuid, replacement_status text, replacement_hours numeric,
  replacement_fraction numeric, correction_notes text, correction_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.attendance_records%rowtype; replacement_id uuid;
begin
  select * into previous from public.attendance_records where id=target_attendance_id for update;
  if previous.id is null or not public.can_record_project_attendance(previous.organization_id,previous.project_id) then raise exception 'Not authorized'; end if;
  if previous.approval_status='superseded' then raise exception 'This attendance record was already corrected'; end if;
  if char_length(btrim(correction_reason)) not between 3 and 1000 then raise exception 'Correction reason is required'; end if;
  update public.attendance_records set approval_status='superseded',updated_at=now() where id=previous.id;
  insert into public.attendance_records (organization_id,project_id,worker_assignment_id,worker_id,work_date,attendance_status,hours_worked,day_fraction,notes,approval_status,recorded_by,correction_of,correction_reason)
  values (previous.organization_id,previous.project_id,previous.worker_assignment_id,previous.worker_id,previous.work_date,replacement_status,replacement_hours,replacement_fraction,nullif(btrim(correction_notes),''),'pending',(select auth.uid()),previous.id,btrim(correction_reason))
  returning id into replacement_id;
  return replacement_id;
end;
$$;

create or replace function public.generate_attendance_earnings(target_organization_id uuid,target_assignment_id uuid,period_start date,period_end date)
returns integer language plpgsql security definer set search_path = '' as $$
declare added_count integer;
begin
  if (select auth.uid()) is null or not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if period_start is null or period_end is null or period_end < period_start then raise exception 'Invalid earning period'; end if;
  insert into public.labour_earning_entries (organization_id,project_id,worker_id,assignment_id,rate_agreement_id,attendance_id,earning_date,basis_quantity,rate_snapshot,amount,description,created_by)
  select a.organization_id,a.project_id,a.worker_id,a.id,r.id,att.id,att.work_date,
    case when r.earning_method='weekly_rate' then att.day_fraction/r.weekly_work_days else att.day_fraction end,
    r.rate,round(r.rate * case when r.earning_method='weekly_rate' then att.day_fraction/r.weekly_work_days else att.day_fraction end,2),
    case when r.earning_method='weekly_rate' then 'Weekly rate prorated by configured work-day basis' else 'Approved attendance' end,(select auth.uid())
  from public.attendance_records att
  join public.worker_project_assignments a on a.organization_id=att.organization_id and a.project_id=att.project_id and a.id=att.worker_assignment_id
  join lateral (select rate.* from public.worker_rate_agreements rate where rate.organization_id=a.organization_id and rate.assignment_id=a.id and rate.effective_from<=att.work_date and (rate.effective_to is null or rate.effective_to>=att.work_date) order by rate.effective_from desc limit 1) r on true
  where att.organization_id=target_organization_id and att.worker_assignment_id=target_assignment_id and att.work_date between period_start and period_end and att.approval_status='approved' and att.attendance_status in ('present','half_day') and r.earning_method in ('daily_rate','weekly_rate')
  on conflict do nothing;
  get diagnostics added_count = row_count;
  return added_count;
end;
$$;

create or replace function public.approve_labour_task_progress(target_progress_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare progress public.labour_task_progress%rowtype; task public.labour_tasks%rowtype; assignment public.worker_project_assignments%rowtype; rate public.worker_rate_agreements%rowtype; amount numeric(18,2); rate_snapshot numeric(18,4); earned_id uuid; completed_quantity numeric(18,4);
begin
  select * into progress from public.labour_task_progress where id=target_progress_id for update;
  if progress.id is null or not public.can_manage_labour_finance(progress.organization_id) then raise exception 'Not authorized'; end if;
  if progress.status<>'submitted' then raise exception 'Only submitted work can be approved'; end if;
  select * into task from public.labour_tasks where organization_id=progress.organization_id and project_id=progress.project_id and id=progress.task_id for update;
  select * into assignment from public.worker_project_assignments where organization_id=task.organization_id and project_id=task.project_id and id=task.assignment_id;
  select * into rate from public.worker_rate_agreements where organization_id=task.organization_id and assignment_id=task.assignment_id and effective_from<=progress.progress_date and (effective_to is null or effective_to>=progress.progress_date) order by effective_from desc limit 1;
  if task.id is null or assignment.id is null or rate.id is null then raise exception 'Task or effective worker agreement is unavailable'; end if;
  if task.payment_basis='unit_rate' then amount:=round(progress.reported_quantity*task.unit_rate,2); rate_snapshot:=task.unit_rate;
  else
    if task.estimated_quantity is null or task.estimated_quantity<=0 then raise exception 'Fixed task needs an agreed quantity for staged earnings'; end if;
    select coalesce(sum(approved_quantity),0) into completed_quantity from public.labour_task_progress where organization_id=task.organization_id and task_id=task.id and status='approved';
    if completed_quantity+progress.reported_quantity>task.estimated_quantity then raise exception 'Approved quantity exceeds the agreed task amount'; end if;
    rate_snapshot:=round(task.fixed_amount/task.estimated_quantity,4); amount:=round(rate_snapshot*progress.reported_quantity,2);
  end if;
  update public.labour_task_progress set status='approved',approved_quantity=reported_quantity,approved_by=(select auth.uid()),approved_at=now() where id=progress.id;
  insert into public.labour_earning_entries (organization_id,project_id,worker_id,assignment_id,rate_agreement_id,task_progress_id,earning_date,basis_quantity,rate_snapshot,amount,description,created_by)
  values (task.organization_id,task.project_id,assignment.worker_id,assignment.id,rate.id,progress.id,progress.progress_date,progress.reported_quantity,rate_snapshot,amount,task.task_name,(select auth.uid())) returning id into earned_id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (task.organization_id,task.project_id,'task_progress',progress.id,'approved');
  return earned_id;
end;
$$;

create or replace function public.record_labour_advance(target_organization_id uuid,target_project_id uuid,target_worker_id uuid,target_assignment_id uuid,advance_amount numeric,advance_date date,advance_method text,advance_reference text,advance_notes text,request_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare prior public.labour_advances%rowtype; result_id uuid; state text;
begin
  if not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if advance_amount is null or advance_amount<=0 or advance_amount<>round(advance_amount,2) or char_length(btrim(request_key)) not between 8 and 160 then raise exception 'Invalid amount or request key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || ':' || request_key,0));
  select * into prior from public.labour_advances where organization_id=target_organization_id and idempotency_key=request_key;
  if prior.id is not null then
    if prior.worker_id<>target_worker_id or prior.project_id<>target_project_id or prior.amount<>advance_amount then raise exception 'Idempotency key reused with different advance details'; end if;
    return prior.id;
  end if;
  state:=case when advance_method='cash' then 'confirmed' else 'pending_verification' end;
  insert into public.labour_advances (organization_id,project_id,worker_id,assignment_id,amount,payment_date,payment_method,reference,notes,status,idempotency_key,recorded_by,confirmed_by,confirmed_at)
  values (target_organization_id,target_project_id,target_worker_id,target_assignment_id,advance_amount,advance_date,advance_method,nullif(btrim(advance_reference),''),nullif(btrim(advance_notes),''),state,request_key,(select auth.uid()),case when state='confirmed' then (select auth.uid()) end,case when state='confirmed' then now() end) returning id into result_id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (target_organization_id,target_project_id,'advance',result_id,'created');
  return result_id;
end;
$$;

create or replace function public.confirm_labour_advance(target_advance_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare advance public.labour_advances%rowtype;
begin
  select * into advance from public.labour_advances where id=target_advance_id for update;
  if advance.id is null or not public.can_manage_labour_finance(advance.organization_id) then raise exception 'Not authorized'; end if;
  if advance.status<>'pending_verification' then raise exception 'Only pending advances can be confirmed'; end if;
  update public.labour_advances set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=advance.id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (advance.organization_id,advance.project_id,'advance',advance.id,'approved');
end;
$$;

create or replace function public.create_labour_settlement(target_organization_id uuid,target_assignment_id uuid,period_start date,period_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment public.worker_project_assignments%rowtype; earned numeric(18,2); settlement_id uuid;
begin
  select * into assignment from public.worker_project_assignments where organization_id=target_organization_id and id=target_assignment_id for update;
  if assignment.id is null or not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if period_start is null or period_end is null or period_end<period_start then raise exception 'Invalid settlement period'; end if;
  if exists(select 1 from public.labour_settlements s where s.organization_id=target_organization_id and s.assignment_id=assignment.id and s.status<>'cancelled' and daterange(s.period_start,s.period_end,'[]') && daterange(period_start,period_end,'[]')) then raise exception 'Settlement period overlaps an existing settlement'; end if;
  select coalesce(sum(e.amount),0)::numeric(18,2) into earned from public.labour_earning_entries e where e.organization_id=target_organization_id and e.assignment_id=assignment.id and e.earning_date between period_start and period_end;
  if earned<=0 then raise exception 'No approved earnings exist for this period'; end if;
  insert into public.labour_settlements (organization_id,project_id,worker_id,assignment_id,period_start,period_end,gross_earned,created_by)
  values (target_organization_id,assignment.project_id,assignment.worker_id,assignment.id,period_start,period_end,earned,(select auth.uid())) returning id into settlement_id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (target_organization_id,assignment.project_id,'settlement',settlement_id,'created');
  return settlement_id;
end;
$$;

create or replace function public.approve_labour_settlement(target_settlement_id uuid,advance_items jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare settlement public.labour_settlements%rowtype; item jsonb; advance public.labour_advances%rowtype; amount numeric(18,2); total_offset numeric(18,2):=0; already_used numeric(18,2);
begin
  select * into settlement from public.labour_settlements where id=target_settlement_id for update;
  if settlement.id is null or not public.can_manage_labour_finance(settlement.organization_id) then raise exception 'Not authorized'; end if;
  if settlement.status<>'draft' then raise exception 'Only draft settlements can be approved'; end if;
  if jsonb_typeof(advance_items)<>'array' then raise exception 'Invalid advance offsets'; end if;
  for item in select value from jsonb_array_elements(advance_items) as e(value) loop
    amount:=(item->>'amount')::numeric;
    if amount<=0 or amount<>round(amount,2) then raise exception 'Advance allocation amount is invalid'; end if;
    select * into advance from public.labour_advances where organization_id=settlement.organization_id and project_id=settlement.project_id and worker_id=settlement.worker_id and id=(item->>'advanceId')::uuid for update;
    if advance.id is null or advance.status<>'confirmed' then raise exception 'Advance is unavailable'; end if;
    select coalesce(sum(a.amount),0) into already_used from public.labour_advance_allocations a join public.labour_settlements s on s.organization_id=a.organization_id and s.id=a.settlement_id where a.organization_id=settlement.organization_id and a.advance_id=advance.id and s.status in ('approved','partially_paid','paid');
    if already_used+amount>advance.amount then raise exception 'Advance allocation exceeds unrecovered balance'; end if;
    insert into public.labour_advance_allocations (organization_id,project_id,worker_id,advance_id,settlement_id,amount,created_by) values (settlement.organization_id,settlement.project_id,settlement.worker_id,advance.id,settlement.id,amount,(select auth.uid()));
    total_offset:=total_offset+amount;
  end loop;
  if total_offset>settlement.gross_earned then raise exception 'Advance offset exceeds earned wages'; end if;
  update public.labour_settlements set advance_offset=total_offset,status='approved',approved_by=(select auth.uid()),approved_at=now(),updated_at=now() where id=settlement.id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (settlement.organization_id,settlement.project_id,'settlement',settlement.id,'approved');
end;
$$;

create or replace function public.record_labour_settlement_payment(target_settlement_id uuid,payment_amount numeric,payment_date date,payment_method text,payment_reference text,payment_notes text,request_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare settlement public.labour_settlements%rowtype; reserved numeric(18,2); paid numeric(18,2); new_id uuid; state text; purpose text; prior public.labour_payment_transactions%rowtype;
begin
  select * into settlement from public.labour_settlements where id=target_settlement_id for update;
  if settlement.id is null or not public.can_manage_labour_finance(settlement.organization_id) then raise exception 'Not authorized'; end if;
  if settlement.status not in ('approved','partially_paid') or payment_amount is null or payment_amount<=0 or payment_amount<>round(payment_amount,2) or char_length(btrim(request_key)) not between 8 and 160 then raise exception 'Settlement, amount or request key is invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(settlement.organization_id::text || ':' || request_key,0));
  select * into prior from public.labour_payment_transactions p where p.organization_id=settlement.organization_id and p.idempotency_key=request_key;
  if prior.id is not null then
    if prior.settlement_id<>settlement.id or prior.payment_amount<>payment_amount or prior.payment_date<>payment_date or prior.payment_method<>payment_method then raise exception 'Idempotency key reused with different payment details'; end if;
    return prior.id;
  end if;
  select coalesce(sum(p.payment_amount),0) into reserved from public.labour_payment_transactions p where p.organization_id=settlement.organization_id and p.settlement_id=settlement.id and p.status in ('pending_verification','confirmed');
  if reserved+payment_amount>settlement.gross_earned-settlement.advance_offset then raise exception 'Payment exceeds remaining settlement'; end if;
  state:=case when payment_method='cash' then 'confirmed' else 'pending_verification' end;
  purpose:=case when reserved+payment_amount=settlement.gross_earned-settlement.advance_offset then 'final_settlement' else 'partial_settlement' end;
  insert into public.labour_payment_transactions (organization_id,project_id,worker_id,settlement_id,payment_amount,payment_date,payment_method,payment_purpose,status,reference,notes,idempotency_key,recorded_by,confirmed_by,confirmed_at)
  values (settlement.organization_id,settlement.project_id,settlement.worker_id,settlement.id,payment_amount,payment_date,payment_method,purpose,state,nullif(btrim(payment_reference),''),nullif(btrim(payment_notes),''),request_key,(select auth.uid()),case when state='confirmed' then (select auth.uid()) end,case when state='confirmed' then now() end) returning id into new_id;
  if state='confirmed' then
    select coalesce(sum(p.payment_amount),0) into paid from public.labour_payment_transactions p where p.organization_id=settlement.organization_id and p.settlement_id=settlement.id and p.status='confirmed';
    update public.labour_settlements set status=case when paid>=gross_earned-advance_offset then 'paid' else 'partially_paid' end,updated_at=now() where id=settlement.id;
  end if;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (settlement.organization_id,settlement.project_id,'labour_payment',new_id,'created');
  return new_id;
end;
$$;

create or replace function public.confirm_labour_payment(target_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.labour_payment_transactions%rowtype; settlement public.labour_settlements%rowtype; paid numeric(18,2);
begin
  select * into payment from public.labour_payment_transactions where id=target_payment_id for update;
  if payment.id is null or not public.can_manage_labour_finance(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'pending_verification' or payment.settlement_id is null then raise exception 'Payment cannot be confirmed with this operation'; end if;
  select * into settlement from public.labour_settlements where organization_id=payment.organization_id and id=payment.settlement_id for update;
  select coalesce(sum(payment_amount),0) into paid from public.labour_payment_transactions where organization_id=payment.organization_id and settlement_id=settlement.id and status='confirmed';
  if paid+payment.payment_amount>settlement.gross_earned-settlement.advance_offset then raise exception 'Confirmed payments exceed the approved settlement'; end if;
  update public.labour_payment_transactions set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=payment.id;
  paid:=paid+payment.payment_amount;
  update public.labour_settlements set status=case when paid>=gross_earned-advance_offset then 'paid' else 'partially_paid' end,updated_at=now() where id=settlement.id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action) values (payment.organization_id,payment.project_id,'labour_payment',payment.id,'paid');
end;
$$;

create or replace function public.reverse_labour_payment(target_payment_id uuid,reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.labour_payment_transactions%rowtype; settlement public.labour_settlements%rowtype; paid numeric(18,2);
begin
  select * into payment from public.labour_payment_transactions where id=target_payment_id for update;
  if payment.id is null or not public.can_manage_labour_finance(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'confirmed' or payment.settlement_id is null then raise exception 'Only confirmed settlement payments can be reversed'; end if;
  if char_length(btrim(reason)) not between 3 and 1000 then raise exception 'Reversal reason is required'; end if;
  select * into settlement from public.labour_settlements where organization_id=payment.organization_id and id=payment.settlement_id for update;
  update public.labour_payment_transactions set status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reason) where id=payment.id;
  select coalesce(sum(payment_amount),0) into paid from public.labour_payment_transactions where organization_id=payment.organization_id and settlement_id=settlement.id and status='confirmed';
  update public.labour_settlements set status=case when paid=0 then 'approved' when paid>=gross_earned-advance_offset then 'paid' else 'partially_paid' end,updated_at=now() where id=settlement.id;
  insert into public.labour_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action,reason) values (payment.organization_id,payment.project_id,'labour_payment',payment.id,'reversed',btrim(reason));
end;
$$;

create or replace function public.validate_attendance_time_limit()
returns trigger language plpgsql set search_path = '' as $$
declare total_hours numeric(6,2);
begin
  perform 1 from public.workers where organization_id=new.organization_id and id=new.worker_id for update;
  if new.hours_worked is not null and new.approval_status <> 'superseded' then
    select coalesce(sum(hours_worked),0) into total_hours from public.attendance_records
      where organization_id=new.organization_id and worker_id=new.worker_id and work_date=new.work_date
        and approval_status <> 'superseded' and id is distinct from new.id;
    if total_hours + new.hours_worked > 24 then raise exception 'Worker recorded hours across sites cannot exceed 24 per day'; end if;
  end if;
  return new;
end;
$$;
create trigger attendance_hours_cap before insert or update on public.attendance_records for each row execute function public.validate_attendance_time_limit();

create or replace function public.protect_worker_rate_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from public.worker_project_assignments where organization_id=new.organization_id and id=new.assignment_id for update;
  if tg_op='UPDATE' then
    if old.effective_to is not null or new.effective_to is null or new.effective_to<old.effective_from
      or new.organization_id is distinct from old.organization_id or new.project_id is distinct from old.project_id
      or new.assignment_id is distinct from old.assignment_id or new.worker_id is distinct from old.worker_id
      or new.earning_method is distinct from old.earning_method or new.rate is distinct from old.rate
      or new.currency_code is distinct from old.currency_code or new.unit_name is distinct from old.unit_name
      or new.half_day_factor is distinct from old.half_day_factor or new.weekly_work_days is distinct from old.weekly_work_days
      or new.effective_from is distinct from old.effective_from or new.calculation_notes is distinct from old.calculation_notes
      or new.agreed_by is distinct from old.agreed_by or new.created_at is distinct from old.created_at then
      raise exception 'Rate terms are immutable; a later effective agreement can only close the current rate period';
    end if;
    return new;
  end if;
  if exists (select 1 from public.worker_rate_agreements r where r.organization_id=new.organization_id and r.assignment_id=new.assignment_id
    and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')) then
    raise exception 'Worker rate effective dates cannot overlap';
  end if;
  return new;
end;
$$;
create trigger worker_rates_history_guard before insert or update on public.worker_rate_agreements for each row execute function public.protect_worker_rate_history();

create or replace function public.add_worker_rate_agreement(target_organization_id uuid,target_assignment_id uuid,target_method text,target_rate numeric,target_unit text,target_half_day_factor numeric,target_weekly_work_days numeric,target_effective_from date,target_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment public.worker_project_assignments%rowtype; current_rate public.worker_rate_agreements%rowtype; new_rate_id uuid;
begin
  select * into assignment from public.worker_project_assignments where organization_id=target_organization_id and id=target_assignment_id for update;
  if assignment.id is null or not public.can_manage_labour(target_organization_id) then raise exception 'Not authorized'; end if;
  if target_method not in ('daily_rate','weekly_rate','task_quantity') or target_rate is null or target_rate<=0 or target_rate<>round(target_rate,4) then raise exception 'Invalid rate agreement'; end if;
  if target_method='task_quantity' and nullif(btrim(target_unit),'') is null then raise exception 'A unit is required'; end if;
  if target_half_day_factor is null or target_half_day_factor<0 or target_half_day_factor>1 or target_weekly_work_days is null or target_weekly_work_days<1 or target_weekly_work_days>7 then raise exception 'Invalid rate calculation settings'; end if;
  select * into current_rate from public.worker_rate_agreements where organization_id=target_organization_id and assignment_id=assignment.id and effective_to is null order by effective_from desc limit 1 for update;
  if current_rate.id is not null then
    if target_effective_from<=current_rate.effective_from then raise exception 'New rate must start after the existing rate begins'; end if;
    update public.worker_rate_agreements set effective_to=target_effective_from-1 where id=current_rate.id;
  end if;
  insert into public.worker_rate_agreements (organization_id,project_id,assignment_id,worker_id,earning_method,rate,unit_name,half_day_factor,weekly_work_days,effective_from,calculation_notes,agreed_by)
  values (assignment.organization_id,assignment.project_id,assignment.id,assignment.worker_id,target_method,target_rate,nullif(btrim(target_unit),''),target_half_day_factor,target_weekly_work_days,target_effective_from,nullif(btrim(target_notes),''),(select auth.uid())) returning id into new_rate_id;
  return new_rate_id;
end;
$$;

alter table public.workers enable row level security;
alter table public.worker_project_assignments enable row level security;
alter table public.worker_rate_agreements enable row level security;
alter table public.attendance_records enable row level security;
alter table public.labour_tasks enable row level security;
alter table public.labour_task_progress enable row level security;
alter table public.labour_earning_entries enable row level security;
alter table public.labour_advances enable row level security;
alter table public.labour_settlements enable row level security;
alter table public.labour_payment_transactions enable row level security;
alter table public.labour_advance_allocations enable row level security;
alter table public.subcontractors enable row level security;
alter table public.subcontractor_agreements enable row level security;
alter table public.subcontractor_work_records enable row level security;
alter table public.labour_transaction_audit_logs enable row level security;

create policy "Authorized members read assigned workers" on public.workers for select to authenticated using (
  public.is_organization_member(organization_id) and (public.current_organization_role(organization_id) in ('owner','admin','accountant','viewer') or exists (
    select 1 from public.worker_project_assignments a where a.organization_id=workers.organization_id and a.worker_id=workers.id and a.status='active' and public.can_record_project_attendance(a.organization_id,a.project_id))));
create policy "Managers create workers" on public.workers for insert to authenticated with check (public.can_manage_labour(organization_id) and created_by=(select auth.uid()));
create policy "Managers update workers" on public.workers for update to authenticated using (public.can_manage_labour(organization_id)) with check (public.can_manage_labour(organization_id));
create policy "Authorized members read assignments" on public.worker_project_assignments for select to authenticated using (
  public.can_manage_labour_finance(organization_id) or exists (select 1 from public.workers w where w.id=worker_project_assignments.worker_id and w.organization_id=worker_project_assignments.organization_id and public.can_record_project_attendance(organization_id,project_id)));
create policy "Managers manage assignments" on public.worker_project_assignments for all to authenticated using (public.can_manage_labour(organization_id)) with check (public.can_manage_labour(organization_id));
create policy "Finance roles read worker rates" on public.worker_rate_agreements for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Managers create worker rates" on public.worker_rate_agreements for insert to authenticated with check (public.can_manage_labour(organization_id) and agreed_by=(select auth.uid()));
create policy "Assigned team reads attendance" on public.attendance_records for select to authenticated using (public.can_record_project_attendance(organization_id,project_id) or public.can_manage_labour_finance(organization_id));
create policy "Assigned supervisors submit attendance" on public.attendance_records for insert to authenticated with check (public.can_record_project_attendance(organization_id,project_id) and recorded_by=(select auth.uid()) and approval_status='pending');
create policy "Managers correct attendance" on public.attendance_records for update to authenticated using (public.can_manage_labour(organization_id)) with check (public.can_manage_labour(organization_id));
create policy "Assigned team reads task work" on public.labour_tasks for select to authenticated using (public.can_record_project_attendance(organization_id,project_id) or public.can_manage_labour_finance(organization_id));
create policy "Managers create labour tasks" on public.labour_tasks for insert to authenticated with check (public.can_manage_labour(organization_id) and created_by=(select auth.uid()));
create policy "Assigned team reads task submissions" on public.labour_task_progress for select to authenticated using (public.can_record_project_attendance(organization_id,project_id) or public.can_manage_labour_finance(organization_id));
create policy "Assigned supervisors submit task progress" on public.labour_task_progress for insert to authenticated with check (public.can_record_project_attendance(organization_id,project_id) and submitted_by=(select auth.uid()) and status='submitted' and approved_quantity is null and approved_by is null and approved_at is null);
create policy "Finance roles read earnings" on public.labour_earning_entries for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Finance roles read advances" on public.labour_advances for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Finance roles create advances" on public.labour_advances for insert to authenticated with check (public.can_manage_labour_finance(organization_id) and recorded_by=(select auth.uid()));
create policy "Finance roles read settlements" on public.labour_settlements for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Finance roles create settlements" on public.labour_settlements for insert to authenticated with check (public.can_manage_labour_finance(organization_id) and created_by=(select auth.uid()) and status='draft');
create policy "Finance roles update draft settlements" on public.labour_settlements for update to authenticated using (public.can_manage_labour_finance(organization_id) and status='draft') with check (public.can_manage_labour_finance(organization_id));
create policy "Finance roles read labour payments" on public.labour_payment_transactions for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Finance roles read advance allocations" on public.labour_advance_allocations for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Finance roles read subcontractors" on public.subcontractors for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Managers create subcontractors" on public.subcontractors for insert to authenticated with check (public.can_manage_labour(organization_id) and created_by=(select auth.uid()));
create policy "Finance roles read subcontract agreements" on public.subcontractor_agreements for select to authenticated using (public.can_manage_labour_finance(organization_id));
create policy "Managers create subcontract agreements" on public.subcontractor_agreements for insert to authenticated with check (public.can_manage_labour(organization_id) and created_by=(select auth.uid()));
create policy "Finance roles read subcontract work" on public.subcontractor_work_records for select to authenticated using (public.can_manage_labour_finance(organization_id) or public.can_record_project_attendance(organization_id,project_id));
create policy "Assigned supervisors submit subcontract work" on public.subcontractor_work_records for insert to authenticated with check (public.can_record_project_attendance(organization_id,project_id) and submitted_by=(select auth.uid()) and status='submitted' and approved_quantity is null and approved_amount is null and approved_by is null and approved_at is null);
create policy "Finance roles read labour audit" on public.labour_transaction_audit_logs for select to authenticated using (public.can_manage_labour_finance(organization_id));

grant select, insert, update on public.workers to authenticated;
grant select, insert, update on public.worker_project_assignments to authenticated;
grant select on public.worker_rate_agreements to authenticated;
revoke insert, update, delete on public.worker_rate_agreements from anon, authenticated;
grant select, insert on public.attendance_records to authenticated;
revoke update,delete on public.attendance_records from anon,authenticated;
grant select, insert on public.labour_tasks, public.labour_task_progress to authenticated;
grant select on public.labour_earning_entries, public.labour_advances, public.labour_settlements, public.labour_payment_transactions, public.labour_advance_allocations, public.subcontractors, public.subcontractor_agreements, public.subcontractor_work_records to authenticated;
grant select on public.labour_transaction_audit_logs to authenticated;
revoke delete on public.workers, public.worker_project_assignments, public.worker_rate_agreements, public.attendance_records, public.labour_tasks, public.labour_task_progress, public.labour_earning_entries, public.labour_advances, public.labour_settlements, public.labour_payment_transactions, public.labour_advance_allocations, public.subcontractors, public.subcontractor_agreements, public.subcontractor_work_records, public.labour_transaction_audit_logs from anon, authenticated;
revoke update, delete on public.worker_rate_agreements, public.labour_earning_entries, public.labour_advances, public.labour_payment_transactions, public.labour_advance_allocations, public.subcontractors, public.subcontractor_agreements, public.subcontractor_work_records from anon, authenticated;
revoke all on function public.can_manage_labour(uuid) from public, anon;
revoke all on function public.can_manage_labour_finance(uuid) from public, anon;
revoke all on function public.can_record_project_attendance(uuid,uuid) from public, anon;
revoke all on function public.validate_attendance_time_limit() from public, anon, authenticated;
revoke all on function public.protect_worker_rate_history() from public, anon, authenticated;
grant execute on function public.can_manage_labour(uuid) to authenticated;
grant execute on function public.can_manage_labour_finance(uuid) to authenticated;
grant execute on function public.can_record_project_attendance(uuid,uuid) to authenticated;
revoke all on function public.assign_project_worker(uuid,uuid,uuid,text,date,text,text,numeric,text,numeric,date,numeric) from public, anon;
grant execute on function public.assign_project_worker(uuid,uuid,uuid,text,date,text,text,numeric,text,numeric,date,numeric) to authenticated;
revoke all on function public.add_worker_rate_agreement(uuid,uuid,text,numeric,text,numeric,numeric,date,text) from public,anon;
grant execute on function public.add_worker_rate_agreement(uuid,uuid,text,numeric,text,numeric,numeric,date,text) to authenticated;
revoke all on function public.approve_worker_attendance(uuid) from public,anon;
grant execute on function public.approve_worker_attendance(uuid) to authenticated;
revoke all on function public.correct_worker_attendance(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.correct_worker_attendance(uuid,text,numeric,numeric,text,text) to authenticated;
revoke all on function public.generate_attendance_earnings(uuid,uuid,date,date) from public,anon;
grant execute on function public.generate_attendance_earnings(uuid,uuid,date,date) to authenticated;
revoke all on function public.approve_labour_task_progress(uuid) from public,anon;
grant execute on function public.approve_labour_task_progress(uuid) to authenticated;
revoke all on function public.record_labour_advance(uuid,uuid,uuid,uuid,numeric,date,text,text,text,text) from public,anon;
grant execute on function public.record_labour_advance(uuid,uuid,uuid,uuid,numeric,date,text,text,text,text) to authenticated;
revoke all on function public.confirm_labour_advance(uuid) from public,anon;
grant execute on function public.confirm_labour_advance(uuid) to authenticated;
revoke all on function public.create_labour_settlement(uuid,uuid,date,date) from public,anon;
grant execute on function public.create_labour_settlement(uuid,uuid,date,date) to authenticated;
revoke all on function public.approve_labour_settlement(uuid,jsonb) from public,anon;
grant execute on function public.approve_labour_settlement(uuid,jsonb) to authenticated;
revoke all on function public.record_labour_settlement_payment(uuid,numeric,date,text,text,text,text) from public,anon;
grant execute on function public.record_labour_settlement_payment(uuid,numeric,date,text,text,text,text) to authenticated;
revoke all on function public.confirm_labour_payment(uuid) from public,anon;
grant execute on function public.confirm_labour_payment(uuid) to authenticated;
revoke all on function public.reverse_labour_payment(uuid,text) from public,anon;
grant execute on function public.reverse_labour_payment(uuid,text) to authenticated;
