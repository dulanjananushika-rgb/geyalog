-- Phase 4: customer dues, receipts, allocations, refunds, reversals and audit.
-- Depends on company/role security (Phase 2) and projects/contracts (Phase 3).

create table public.customer_payment_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  customer_id uuid not null,
  payment_term_id uuid,
  obligation_reference text not null default ('DUE-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10))),
  description text not null check (char_length(btrim(description)) between 1 and 240),
  amount numeric(18,2) not null check (amount > 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  due_date date,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id) references public.customers(organization_id, id) on delete restrict,
  foreign key (organization_id, project_id, payment_term_id) references public.project_payment_terms(organization_id, project_id, id),
  unique (organization_id, project_id, id),
  unique (organization_id, obligation_reference)
);
create index customer_obligations_due_idx on public.customer_payment_obligations (organization_id, due_date, status);
create index customer_obligations_project_idx on public.customer_payment_obligations (organization_id, project_id, created_at desc);

create table public.customer_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  customer_id uuid not null,
  receipt_number text not null default ('GRC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8))),
  amount numeric(18,2) not null check (amount > 0),
  currency_code text not null default 'LKR' check (currency_code = 'LKR'),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'cheque', 'other')),
  payment_category text not null check (payment_category in ('advance', 'progress', 'milestone', 'partial', 'final_settlement', 'retention_release', 'other')),
  payment_reference text,
  notes text,
  verification_status text not null check (verification_status in ('pending_verification', 'confirmed', 'reversed')),
  idempotency_key text,
  idempotency_payload_hash text,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id) references public.customers(organization_id, id) on delete restrict,
  unique (organization_id, project_id, id),
  unique (organization_id, receipt_number),
  unique (organization_id, idempotency_key),
  check ((confirmed_at is null) = (confirmed_by is null)),
  check (verification_status <> 'confirmed' or confirmed_at is not null),
  check ((verification_status = 'reversed') = (reversed_at is not null and reversed_by is not null and reversal_reason is not null))
);
create index customer_receipts_project_date_idx on public.customer_receipts (organization_id, project_id, payment_date desc, created_at desc);
create index customer_receipts_customer_idx on public.customer_receipts (organization_id, customer_id, payment_date desc);

create table public.customer_receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  receipt_id uuid not null,
  obligation_id uuid not null,
  amount numeric(18,2) not null check (amount > 0),
  active boolean not null default true,
  allocated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  released_by uuid references auth.users(id) on delete restrict,
  released_at timestamptz,
  release_reason text,
  foreign key (organization_id, project_id, receipt_id) references public.customer_receipts(organization_id, project_id, id) on delete restrict,
  foreign key (organization_id, project_id, obligation_id) references public.customer_payment_obligations(organization_id, project_id, id) on delete restrict,
  check ((active = false) = (released_at is not null and released_by is not null and release_reason is not null))
);
create index customer_allocations_receipt_idx on public.customer_receipt_allocations (organization_id, receipt_id, active);
create index customer_allocations_obligation_idx on public.customer_receipt_allocations (organization_id, obligation_id, active);

create table public.customer_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  receipt_id uuid not null,
  refund_reference text not null default ('REF-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10))),
  amount numeric(18,2) not null check (amount > 0),
  refund_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'cheque', 'other')),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'pending_verification' check (status in ('pending_verification', 'confirmed', 'reversed')),
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id, receipt_id) references public.customer_receipts(organization_id, project_id, id) on delete restrict,
  unique (organization_id, refund_reference),
  check ((confirmed_at is null) = (confirmed_by is null)),
  check (status <> 'confirmed' or confirmed_at is not null),
  check ((status = 'reversed') = (reversed_at is not null and reversed_by is not null and reversal_reason is not null))
);

create table public.financial_transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  entity_type text not null check (entity_type in ('customer_obligation', 'customer_receipt', 'receipt_allocation', 'customer_refund')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'allocated', 'confirmed', 'refunded', 'reversed', 'cancelled')),
  reason text,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete restrict
);
create index financial_audit_entity_idx on public.financial_transaction_audit_logs (organization_id, entity_type, entity_id, created_at desc);

create or replace function public.can_manage_customer_finance(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m where m.organization_id = target_organization_id
    and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner','admin','accountant'));
$$;

create or replace function public.cancel_customer_obligation(target_obligation_id uuid, cancellation_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare obligation public.customer_payment_obligations%rowtype;
begin
  select * into obligation from public.customer_payment_obligations where id=target_obligation_id for update;
  if obligation.id is null or not public.can_manage_customer_finance(obligation.organization_id) then raise exception 'Not authorized'; end if;
  if obligation.status <> 'open' then raise exception 'Obligation is not open'; end if;
  if exists (select 1 from public.customer_receipt_allocations where organization_id=obligation.organization_id and obligation_id=obligation.id and active) then
    raise exception 'Release or reverse receipt allocations before cancelling this obligation';
  end if;
  if char_length(btrim(cancellation_reason)) not between 3 and 1000 then raise exception 'A cancellation reason is required'; end if;
  update public.customer_payment_obligations set status='cancelled',updated_at=now() where id=obligation.id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action,reason)
  values (obligation.organization_id,obligation.project_id,'customer_obligation',obligation.id,'cancelled',btrim(cancellation_reason));
end;
$$;

create or replace function public.record_customer_receipt(
  target_organization_id uuid, target_project_id uuid, target_customer_id uuid,
  receipt_amount numeric, receipt_date date, receipt_method text, receipt_category text,
  receipt_reference text default null, receipt_notes text default null,
  receipt_status text default 'confirmed', request_idempotency_key text default null,
  allocation_items jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; previous public.customer_receipts%rowtype; row_item jsonb; request_hash text;
  allocation_total numeric(18,2) := 0; next_amount numeric(18,2); batch_obligation_total numeric(18,2); obligation public.customer_payment_obligations%rowtype;
begin
  if not public.can_manage_customer_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if receipt_amount is null or receipt_amount <= 0 or receipt_amount > 9999999999999999.99 then raise exception 'Invalid receipt amount'; end if;
  if receipt_amount <> round(receipt_amount, 2) then raise exception 'Receipt supports up to 2 decimal places'; end if;
  if receipt_method not in ('cash','bank_transfer','cheque','other') then raise exception 'Invalid payment method'; end if;
  if receipt_method in ('bank_transfer','cheque') and receipt_status = 'confirmed' then raise exception 'Bank transfers and cheques must be verified before confirmation'; end if;
  if receipt_category not in ('advance','progress','milestone','partial','final_settlement','retention_release','other') then raise exception 'Invalid payment category'; end if;
  if receipt_status not in ('pending_verification','confirmed') then raise exception 'Invalid receipt state'; end if;
  if not exists (select 1 from public.projects p where p.organization_id = target_organization_id and p.id = target_project_id and p.customer_id = target_customer_id) then
    raise exception 'Customer and project do not match this company';
  end if;
  if request_idempotency_key is not null then
    request_hash := encode(extensions.digest(jsonb_build_object('organizationId',target_organization_id,'projectId',target_project_id,'customerId',target_customer_id,'amount',receipt_amount,'date',receipt_date,'method',receipt_method,'category',receipt_category,'reference',receipt_reference,'notes',receipt_notes,'status',receipt_status,'allocations',coalesce(allocation_items,'[]'::jsonb))::text,'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text || ':' || request_idempotency_key, 0));
    select * into previous from public.customer_receipts where organization_id = target_organization_id and idempotency_key = request_idempotency_key for update;
    if previous.id is not null then
      if previous.idempotency_payload_hash is distinct from request_hash then raise exception 'Idempotency key was already used for a different payment'; end if;
      return previous.id;
    end if;
  end if;
  if receipt_status <> 'confirmed' and jsonb_array_length(coalesce(allocation_items, '[]'::jsonb)) > 0 then raise exception 'Pending verification receipts cannot be allocated'; end if;
  if jsonb_typeof(coalesce(allocation_items, '[]'::jsonb)) <> 'array' then raise exception 'Allocations must be an array'; end if;
  for row_item in select value from jsonb_array_elements(coalesce(allocation_items, '[]'::jsonb)) as e(value) order by value->>'obligationId' loop
    next_amount := (row_item->>'amount')::numeric;
    if next_amount <= 0 then raise exception 'Allocation amount must be greater than zero'; end if;
    if next_amount <> round(next_amount, 2) then raise exception 'Allocation supports up to 2 decimal places'; end if;
    select * into obligation from public.customer_payment_obligations where organization_id = target_organization_id
      and project_id = target_project_id and id = (row_item->>'obligationId')::uuid and status = 'open' for update;
    if obligation.id is null or obligation.customer_id <> target_customer_id then raise exception 'Payment obligation is invalid'; end if;
    select coalesce(sum((e.value->>'amount')::numeric),0) into batch_obligation_total
      from jsonb_array_elements(coalesce(allocation_items, '[]'::jsonb)) as e(value)
      where e.value->>'obligationId' = row_item->>'obligationId';
    if batch_obligation_total + coalesce((select sum(a.amount) from public.customer_receipt_allocations a join public.customer_receipts r on r.id = a.receipt_id
      where a.organization_id = target_organization_id and a.obligation_id = obligation.id and a.active and r.verification_status = 'confirmed'),0) > obligation.amount then
      raise exception 'Allocation exceeds remaining obligation amount';
    end if;
    allocation_total := allocation_total + next_amount;
  end loop;
  if allocation_total > receipt_amount then raise exception 'Allocation total exceeds receipt amount'; end if;
  insert into public.customer_receipts (organization_id, project_id, customer_id, amount, payment_date, payment_method, payment_category, payment_reference, notes, verification_status, idempotency_key, idempotency_payload_hash, recorded_by, confirmed_by, confirmed_at)
  values (target_organization_id, target_project_id, target_customer_id, receipt_amount, coalesce(receipt_date,current_date), receipt_method, receipt_category, nullif(btrim(receipt_reference),''), nullif(btrim(receipt_notes),''), receipt_status, request_idempotency_key, request_hash, (select auth.uid()), case when receipt_status='confirmed' then (select auth.uid()) end, case when receipt_status='confirmed' then now() end)
  returning id into new_id;
  for row_item in select value from jsonb_array_elements(coalesce(allocation_items, '[]'::jsonb)) as e(value) order by value->>'obligationId' loop
    insert into public.customer_receipt_allocations (organization_id, project_id, receipt_id, obligation_id, amount, allocated_by)
    values (target_organization_id, target_project_id, new_id, (row_item->>'obligationId')::uuid, (row_item->>'amount')::numeric, (select auth.uid()));
  end loop;
  insert into public.financial_transaction_audit_logs (organization_id, project_id, entity_type, entity_id, action, after_data)
  values (target_organization_id, target_project_id, 'customer_receipt', new_id, 'created', jsonb_build_object('amount',receipt_amount,'method',receipt_method,'status',receipt_status,'receiptDate',receipt_date));
  return new_id;
end;
$$;

create or replace function public.allocate_customer_receipt(target_receipt_id uuid, allocation_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.customer_receipts%rowtype; row_item jsonb; next_amount numeric(18,2); batch_obligation_total numeric(18,2); allocated_total numeric(18,2) := 0; obligation public.customer_payment_obligations%rowtype;
begin
  select * into receipt from public.customer_receipts where id = target_receipt_id for update;
  if receipt.id is null or not public.can_manage_customer_finance(receipt.organization_id) then raise exception 'Not authorized'; end if;
  if receipt.verification_status <> 'confirmed' then raise exception 'Only confirmed receipts can be allocated'; end if;
  if jsonb_typeof(allocation_items) <> 'array' then raise exception 'Allocations must be an array'; end if;
  for row_item in select value from jsonb_array_elements(allocation_items) as e(value) order by value->>'obligationId' loop
    next_amount := (row_item->>'amount')::numeric;
    if next_amount <= 0 then raise exception 'Allocation amount must be greater than zero'; end if;
    if next_amount <> round(next_amount, 2) then raise exception 'Allocation supports up to 2 decimal places'; end if;
    select * into obligation from public.customer_payment_obligations where organization_id = receipt.organization_id
      and project_id = receipt.project_id and id = (row_item->>'obligationId')::uuid and status = 'open' for update;
    if obligation.id is null or obligation.customer_id <> receipt.customer_id then raise exception 'Payment obligation is invalid'; end if;
    select coalesce(sum((e.value->>'amount')::numeric),0) into batch_obligation_total
      from jsonb_array_elements(allocation_items) as e(value)
      where e.value->>'obligationId' = row_item->>'obligationId';
    if batch_obligation_total + coalesce((select sum(a.amount) from public.customer_receipt_allocations a join public.customer_receipts r on r.id=a.receipt_id
      where a.organization_id=receipt.organization_id and a.obligation_id=obligation.id and a.active and r.verification_status='confirmed'),0) > obligation.amount then raise exception 'Allocation exceeds remaining obligation amount'; end if;
    allocated_total := allocated_total + next_amount;
  end loop;
  if allocated_total + coalesce((select sum(a.amount) from public.customer_receipt_allocations a where a.organization_id=receipt.organization_id and a.receipt_id=receipt.id and a.active),0)
    > receipt.amount - coalesce((select sum(f.amount) from public.customer_refunds f where f.organization_id=receipt.organization_id and f.receipt_id=receipt.id and f.status='confirmed'),0) then raise exception 'Allocation exceeds unallocated receipt credit'; end if;
  for row_item in select value from jsonb_array_elements(allocation_items) as e(value) loop
    insert into public.customer_receipt_allocations (organization_id, project_id, receipt_id, obligation_id, amount)
    values (receipt.organization_id, receipt.project_id, receipt.id, (row_item->>'obligationId')::uuid, (row_item->>'amount')::numeric);
  end loop;
  insert into public.financial_transaction_audit_logs (organization_id, project_id, entity_type, entity_id, action, after_data)
  values (receipt.organization_id, receipt.project_id, 'customer_receipt', receipt.id, 'allocated', jsonb_build_object('amount',allocated_total));
end;
$$;

create or replace function public.confirm_customer_receipt(target_receipt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.customer_receipts%rowtype;
begin
  select * into receipt from public.customer_receipts where id = target_receipt_id for update;
  if receipt.id is null or not public.can_manage_customer_finance(receipt.organization_id) then raise exception 'Not authorized'; end if;
  if receipt.verification_status <> 'pending_verification' then raise exception 'Only pending receipts can be confirmed'; end if;
  update public.customer_receipts set verification_status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now(),updated_at=now() where id=receipt.id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action)
  values (receipt.organization_id,receipt.project_id,'customer_receipt',receipt.id,'confirmed');
end;
$$;

create or replace function public.record_customer_refund(target_receipt_id uuid, refund_amount numeric, refund_reason text, refund_method text, refund_status text default 'confirmed')
returns uuid language plpgsql security definer set search_path = '' as $$
declare receipt public.customer_receipts%rowtype; refund_id uuid; available numeric(18,2);
begin
  select * into receipt from public.customer_receipts where id = target_receipt_id for update;
  if receipt.id is null or not public.can_manage_customer_finance(receipt.organization_id) then raise exception 'Not authorized'; end if;
  if receipt.verification_status <> 'confirmed' then raise exception 'Only confirmed receipts can be refunded'; end if;
  if refund_amount is null or refund_amount <= 0 or refund_status not in ('pending_verification','confirmed') then raise exception 'Invalid refund'; end if;
  if refund_amount <> round(refund_amount, 2) then raise exception 'Refund supports up to 2 decimal places'; end if;
  if refund_method not in ('cash','bank_transfer','cheque','other') then raise exception 'Invalid refund method'; end if;
  if refund_method in ('bank_transfer','cheque') and refund_status='confirmed' then raise exception 'Bank refunds and cheques must be verified before confirmation'; end if;
  available := receipt.amount - coalesce((select sum(a.amount) from public.customer_receipt_allocations a where a.organization_id=receipt.organization_id and a.receipt_id=receipt.id and a.active),0)
    - coalesce((select sum(f.amount) from public.customer_refunds f where f.organization_id=receipt.organization_id and f.receipt_id=receipt.id and f.status in ('pending_verification','confirmed')),0);
  if refund_amount > available then raise exception 'Refund exceeds unallocated customer credit'; end if;
  insert into public.customer_refunds (organization_id,project_id,receipt_id,amount,payment_method,reason,status,recorded_by,confirmed_by,confirmed_at)
  values (receipt.organization_id,receipt.project_id,receipt.id,refund_amount,refund_method,btrim(refund_reason),refund_status,(select auth.uid()),case when refund_status='confirmed' then (select auth.uid()) end,case when refund_status='confirmed' then now() end)
  returning id into refund_id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action,after_data)
  values (receipt.organization_id,receipt.project_id,'customer_refund',refund_id,'refunded',jsonb_build_object('amount',refund_amount,'reason',refund_reason,'status',refund_status));
  return refund_id;
end;
$$;

create or replace function public.reverse_customer_receipt(target_receipt_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.customer_receipts%rowtype; confirmed_refund_count integer;
begin
  select * into receipt from public.customer_receipts where id=target_receipt_id for update;
  if receipt.id is null or not public.can_manage_customer_finance(receipt.organization_id) then raise exception 'Not authorized'; end if;
  if receipt.verification_status = 'reversed' then raise exception 'Receipt already reversed'; end if;
  if char_length(btrim(reason)) not between 3 and 1000 then raise exception 'A reversal reason is required'; end if;
  select count(*) into confirmed_refund_count from public.customer_refunds where organization_id=receipt.organization_id and receipt_id=receipt.id and status in ('pending_verification','confirmed');
  if confirmed_refund_count > 0 then raise exception 'Cancel or resolve pending refunds before reversing the receipt'; end if;
  update public.customer_receipt_allocations set active=false,released_by=(select auth.uid()),released_at=now(),release_reason=btrim(reason)
    where organization_id=receipt.organization_id and receipt_id=receipt.id and active;
  update public.customer_receipts set verification_status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reason),updated_at=now() where id=receipt.id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action,reason)
  values (receipt.organization_id,receipt.project_id,'customer_receipt',receipt.id,'reversed',btrim(reason));
end;
$$;

create or replace function public.confirm_customer_refund(target_refund_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare refund public.customer_refunds%rowtype; receipt public.customer_receipts%rowtype;
begin
  select * into refund from public.customer_refunds where id=target_refund_id for update;
  if refund.id is null or not public.can_manage_customer_finance(refund.organization_id) then raise exception 'Not authorized'; end if;
  if refund.status <> 'pending_verification' then raise exception 'Only pending refunds can be confirmed'; end if;
  select * into receipt from public.customer_receipts where id=refund.receipt_id for update;
  if refund.amount > receipt.amount - coalesce((select sum(a.amount) from public.customer_receipt_allocations a where a.organization_id=refund.organization_id and a.receipt_id=receipt.id and a.active),0)
    - coalesce((select sum(f.amount) from public.customer_refunds f where f.organization_id=refund.organization_id and f.receipt_id=receipt.id and f.status='confirmed'),0) then raise exception 'Refund exceeds remaining unallocated credit'; end if;
  update public.customer_refunds set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=refund.id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action)
  values (refund.organization_id,refund.project_id,'customer_refund',refund.id,'confirmed');
end;
$$;

create or replace function public.reverse_customer_refund(target_refund_id uuid, reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare refund public.customer_refunds%rowtype;
begin
  select * into refund from public.customer_refunds where id=target_refund_id for update;
  if refund.id is null or not public.can_manage_customer_finance(refund.organization_id) then raise exception 'Not authorized'; end if;
  if refund.status <> 'pending_verification' then raise exception 'Only pending refunds can be cancelled; confirmed refunds require a compensating transaction'; end if;
  if char_length(btrim(reason)) not between 3 and 1000 then raise exception 'A cancellation reason is required'; end if;
  update public.customer_refunds set status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reason) where id=refund.id;
  insert into public.financial_transaction_audit_logs (organization_id,project_id,entity_type,entity_id,action,reason)
  values (refund.organization_id,refund.project_id,'customer_refund',refund.id,'reversed',btrim(reason));
end;
$$;

create or replace function public.customer_obligation_balances()
returns table(organization_id uuid, project_id uuid, obligation_id uuid, customer_id uuid, description text, due_date date, original_amount numeric(18,2), amount_paid numeric(18,2), outstanding_amount numeric(18,2), payment_status text)
language sql stable security invoker set search_path = '' as $$
  select o.organization_id,o.project_id,o.id,o.customer_id,o.description,o.due_date,o.amount,
    least(o.amount,coalesce(sum(a.amount) filter (where a.active and r.verification_status='confirmed'),0))::numeric(18,2) as amount_paid,
    greatest(o.amount-coalesce(sum(a.amount) filter (where a.active and r.verification_status='confirmed'),0),0)::numeric(18,2) as outstanding_amount,
    case when o.status='cancelled' then 'cancelled'
      when coalesce(sum(a.amount) filter (where a.active and r.verification_status='confirmed'),0) >= o.amount then 'paid'
      when coalesce(sum(a.amount) filter (where a.active and r.verification_status='confirmed'),0) > 0 then 'partially_paid'
      when o.due_date is null or o.due_date > current_date then 'not_due'
      when o.due_date < current_date then 'overdue' else 'due' end as payment_status
  from public.customer_payment_obligations o
  left join public.customer_receipt_allocations a on a.organization_id=o.organization_id and a.obligation_id=o.id and a.active
  left join public.customer_receipts r on r.organization_id=a.organization_id and r.id=a.receipt_id
  group by o.organization_id,o.project_id,o.id,o.customer_id,o.description,o.due_date,o.amount,o.status;
$$;

create or replace function public.customer_project_financial_summary(target_organization_id uuid, target_project_id uuid)
returns table(original_contract_value numeric(18,2), approved_variations numeric(18,2), revised_contract_value numeric(18,2), confirmed_receipts numeric(18,2), confirmed_refunds numeric(18,2), unallocated_credit numeric(18,2), total_currently_due numeric(18,2), outstanding_due numeric(18,2), remaining_contract_value numeric(18,2))
language sql stable security invoker set search_path = '' as $$
  with contract as (select c.agreed_value,coalesce(sum(v.proposed_cost_adjustment) filter(where v.status='approved'),0)::numeric(18,2) variations
    from public.project_contracts c left join public.project_variations v on v.organization_id=c.organization_id and v.project_id=c.project_id
    where c.organization_id=target_organization_id and c.project_id=target_project_id group by c.agreed_value),
  receipts as (select coalesce(sum(amount) filter(where verification_status='confirmed'),0)::numeric(18,2) gross
    from public.customer_receipts where organization_id=target_organization_id and project_id=target_project_id),
  refunds as (select coalesce(sum(f.amount) filter(where f.status='confirmed'),0)::numeric(18,2) amount from public.customer_refunds f
    where f.organization_id=target_organization_id and f.project_id=target_project_id),
  allocations as (select coalesce(sum(a.amount),0)::numeric(18,2) amount from public.customer_receipt_allocations a join public.customer_receipts r
    on r.organization_id=a.organization_id and r.id=a.receipt_id where a.organization_id=target_organization_id and a.project_id=target_project_id and a.active and r.verification_status='confirmed'),
  dues as (select coalesce(sum(b.outstanding_amount) filter(where b.due_date <= current_date and b.payment_status in ('due','overdue','partially_paid')),0)::numeric(18,2) outstanding,
    coalesce(sum(b.original_amount) filter(where b.due_date <= current_date and b.payment_status in ('due','overdue','partially_paid')),0)::numeric(18,2) due
    from public.customer_obligation_balances() b where b.organization_id=target_organization_id and b.project_id=target_project_id)
  select c.agreed_value,c.variations,case when c.agreed_value is null then null else c.agreed_value+c.variations end,
    r.gross,f.amount,greatest(r.gross-f.amount-a.amount,0),d.due,d.outstanding,
    case when c.agreed_value is null then null else greatest(c.agreed_value+c.variations-r.gross+f.amount,0) end
  from contract c cross join receipts r cross join refunds f cross join allocations a cross join dues d;
$$;

alter table public.customer_payment_obligations enable row level security;
alter table public.customer_receipts enable row level security;
alter table public.customer_receipt_allocations enable row level security;
alter table public.customer_refunds enable row level security;
alter table public.financial_transaction_audit_logs enable row level security;
create policy "Finance roles read obligations" on public.customer_payment_obligations for select to authenticated using (public.can_manage_customer_finance(organization_id));
create policy "Finance roles create obligations" on public.customer_payment_obligations for insert to authenticated with check (public.can_manage_customer_finance(organization_id) and created_by=(select auth.uid()));
create policy "Finance roles read receipts" on public.customer_receipts for select to authenticated using (public.can_manage_customer_finance(organization_id));
create policy "Finance roles read receipt allocations" on public.customer_receipt_allocations for select to authenticated using (public.can_manage_customer_finance(organization_id));
create policy "Finance roles read refunds" on public.customer_refunds for select to authenticated using (public.can_manage_customer_finance(organization_id));
create policy "Finance roles read financial audit" on public.financial_transaction_audit_logs for select to authenticated using (public.can_manage_customer_finance(organization_id));

grant select, insert on public.customer_payment_obligations to authenticated;
grant select on public.customer_receipts, public.customer_receipt_allocations, public.customer_refunds, public.financial_transaction_audit_logs to authenticated;
revoke update, delete on public.customer_receipts, public.customer_receipt_allocations, public.customer_refunds, public.financial_transaction_audit_logs from anon, authenticated;
revoke delete on public.customer_payment_obligations from anon, authenticated;
grant execute on function public.customer_obligation_balances() to authenticated;
grant execute on function public.can_manage_customer_finance(uuid) to authenticated;
grant execute on function public.cancel_customer_obligation(uuid,text) to authenticated;
grant execute on function public.record_customer_receipt(uuid,uuid,uuid,numeric,date,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.allocate_customer_receipt(uuid,jsonb) to authenticated;
grant execute on function public.confirm_customer_receipt(uuid) to authenticated;
grant execute on function public.record_customer_refund(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.confirm_customer_refund(uuid) to authenticated;
grant execute on function public.reverse_customer_refund(uuid,text) to authenticated;
grant execute on function public.reverse_customer_receipt(uuid,text) to authenticated;
grant execute on function public.customer_project_financial_summary(uuid,uuid) to authenticated;
revoke all on function public.can_manage_customer_finance(uuid) from public, anon;
revoke all on function public.customer_obligation_balances() from public, anon;
revoke all on function public.cancel_customer_obligation(uuid,text) from public, anon;
revoke all on function public.record_customer_receipt(uuid,uuid,uuid,numeric,date,text,text,text,text,text,text,jsonb) from public, anon;
revoke all on function public.allocate_customer_receipt(uuid,jsonb) from public, anon;
revoke all on function public.confirm_customer_receipt(uuid) from public, anon;
revoke all on function public.record_customer_refund(uuid,numeric,text,text,text) from public, anon;
revoke all on function public.confirm_customer_refund(uuid) from public, anon;
revoke all on function public.reverse_customer_refund(uuid,text) from public, anon;
revoke all on function public.reverse_customer_receipt(uuid,text) from public, anon;
revoke all on function public.customer_project_financial_summary(uuid,uuid) from public, anon;

