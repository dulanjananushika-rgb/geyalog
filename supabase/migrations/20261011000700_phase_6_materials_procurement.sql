-- Phase 6: supplier directory, material catalogue, requisitions, procurement,
-- receiving and stock movements. This does not calculate project profit.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 180),
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index suppliers_org_name_idx on public.suppliers (organization_id,lower(business_name));

create table public.material_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_code text,
  name text not null check (char_length(btrim(name)) between 2 and 180),
  category text not null check (char_length(btrim(category)) between 2 and 100),
  unit_name text not null check (char_length(btrim(unit_name)) between 1 and 40),
  description text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,item_code)
);
create index material_items_org_name_idx on public.material_items (organization_id,lower(name)) where active;

create table public.material_requisitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  request_reference text not null default ('REQ-' || upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,10))),
  needed_by date,
  delivery_location text,
  notes text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','partially_ordered','ordered','cancelled')),
  requested_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  unique (organization_id,id),
  unique (organization_id,request_reference)
);

create table public.material_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requisition_id uuid not null,
  material_id uuid not null,
  requested_quantity numeric(18,4) not null check (requested_quantity > 0),
  approved_quantity numeric(18,4) check (approved_quantity is null or approved_quantity between 0 and requested_quantity),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,requisition_id) references public.material_requisitions(organization_id,id) on delete cascade,
  foreign key (organization_id,material_id) references public.material_items(organization_id,id) on delete restrict,
  unique (organization_id,id)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid,
  supplier_id uuid not null,
  requisition_id uuid,
  purchase_order_reference text not null default ('PO-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8))),
  order_date date not null default current_date,
  expected_delivery_date date,
  currency_code text not null default 'LKR' check (currency_code='LKR'),
  notes text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','ordered','partially_received','received','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,supplier_id) references public.suppliers(organization_id,id) on delete restrict,
  foreign key (organization_id,requisition_id) references public.material_requisitions(organization_id,id) on delete restrict,
  unique (organization_id,id),
  unique (organization_id,purchase_order_reference),
  check (expected_delivery_date is null or expected_delivery_date >= order_date),
  check ((status in ('approved','ordered','partially_received','received')) = (approved_by is not null and approved_at is not null))
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  purchase_order_id uuid not null,
  material_id uuid not null,
  ordered_quantity numeric(18,4) not null check (ordered_quantity > 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(22,2) generated always as ((ordered_quantity * unit_cost)::numeric(22,2)) stored,
  received_quantity numeric(18,4) not null default 0 check (received_quantity between 0 and ordered_quantity),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,purchase_order_id) references public.purchase_orders(organization_id,id) on delete restrict,
  foreign key (organization_id,material_id) references public.material_items(organization_id,id) on delete restrict,
  unique (organization_id,id)
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  purchase_order_id uuid not null,
  receipt_reference text not null default ('GR-' || upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,10))),
  received_at timestamptz not null default now(),
  delivery_note_reference text,
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  received_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,purchase_order_id) references public.purchase_orders(organization_id,id) on delete restrict,
  unique (organization_id,id),
  unique (organization_id,receipt_reference),
  check ((status='reversed') = (reversed_by is not null and reversed_at is not null and reversal_reason is not null))
);

create table public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  receipt_id uuid not null,
  purchase_order_line_id uuid not null,
  material_id uuid not null,
  quantity_received numeric(18,4) not null check (quantity_received > 0),
  unit_cost_snapshot numeric(18,4) not null check (unit_cost_snapshot >= 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,receipt_id) references public.goods_receipts(organization_id,id) on delete restrict,
  foreign key (organization_id,purchase_order_line_id) references public.purchase_order_lines(organization_id,id) on delete restrict,
  foreign key (organization_id,material_id) references public.material_items(organization_id,id) on delete restrict,
  unique (organization_id,id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  material_id uuid not null,
  project_id uuid,
  purchase_order_id uuid,
  goods_receipt_id uuid,
  movement_type text not null check (movement_type in ('receipt','project_issue','return','adjustment_in','adjustment_out','transfer_in','transfer_out')),
  quantity_delta numeric(18,4) not null check (quantity_delta <> 0),
  unit_cost_snapshot numeric(18,4) check (unit_cost_snapshot is null or unit_cost_snapshot >= 0),
  location text,
  reason text,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,material_id) references public.material_items(organization_id,id) on delete restrict,
  foreign key (organization_id,project_id) references public.projects(organization_id,id) on delete restrict,
  foreign key (organization_id,purchase_order_id) references public.purchase_orders(organization_id,id) on delete restrict,
  foreign key (organization_id,goods_receipt_id) references public.goods_receipts(organization_id,id) on delete restrict,
  unique (organization_id,id)
);
create index inventory_movements_balance_idx on public.inventory_movements (organization_id,material_id,location,created_at desc);
create index inventory_movements_project_idx on public.inventory_movements (organization_id,project_id,created_at desc);

create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null,
  purchase_order_id uuid,
  invoice_number text not null,
  invoice_date date not null,
  due_date date,
  amount numeric(18,2) not null check (amount >= 0),
  currency_code text not null default 'LKR' check (currency_code='LKR'),
  status text not null default 'unpaid' check (status in ('unpaid','partially_paid','paid','disputed','cancelled')),
  notes text,
  recorded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,supplier_id) references public.suppliers(organization_id,id) on delete restrict,
  foreign key (organization_id,purchase_order_id) references public.purchase_orders(organization_id,id) on delete restrict,
  unique (organization_id,id),
  unique (organization_id,supplier_id,invoice_number),
  check (due_date is null or due_date >= invoice_date)
);

create table public.supplier_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  supplier_id uuid not null,
  invoice_id uuid,
  payment_amount numeric(18,2) not null check (payment_amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash','bank_transfer','cheque','other')),
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
  foreign key (organization_id,supplier_id) references public.suppliers(organization_id,id) on delete restrict,
  foreign key (organization_id,invoice_id) references public.supplier_invoices(organization_id,id) on delete restrict,
  unique (organization_id,idempotency_key),
  check ((confirmed_at is null) = (confirmed_by is null)),
  check (status <> 'confirmed' or confirmed_at is not null),
  check ((status='reversed') = (reversed_by is not null and reversed_at is not null and reversal_reason is not null)),
  check (payment_method not in ('bank_transfer','cheque') or status <> 'confirmed')
);

create table public.supplier_transaction_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid,
  entity_type text not null check (entity_type in ('supplier','requisition','purchase_order','goods_receipt','supplier_invoice','supplier_payment','inventory_movement')),
  entity_id uuid not null,
  action text not null check (action in ('created','approved','rejected','received','issued','adjusted','paid','reversed','cancelled')),
  reason text,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,supplier_id) references public.suppliers(organization_id,id) on delete restrict
);

create or replace function public.can_manage_materials(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','accountant'));
$$;
create or replace function public.can_record_materials(target_organization_id uuid,target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and (
    m.role in ('owner','admin','accountant') or (m.role='site_supervisor' and exists(select 1 from public.project_assignments a where a.organization_id=target_organization_id and a.project_id=target_project_id and a.user_id=(select auth.uid()) and a.active))));
$$;
create or replace function public.can_approve_materials(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin'));
$$;

create or replace function public.receive_purchase_order(target_purchase_order_id uuid, receipt_lines jsonb, delivery_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare po public.purchase_orders%rowtype; receipt_id uuid; row_item jsonb; line public.purchase_order_lines%rowtype; quantity numeric(18,4);
begin
  select * into po from public.purchase_orders where id=target_purchase_order_id for update;
  if po.id is null or not public.can_manage_materials(po.organization_id) then raise exception 'Not authorized'; end if;
  if po.status not in ('ordered','partially_received') then raise exception 'Only approved purchase orders can be received'; end if;
  if jsonb_typeof(receipt_lines) <> 'array' or jsonb_array_length(receipt_lines)=0 then raise exception 'At least one received item is required'; end if;
  insert into public.goods_receipts (organization_id,purchase_order_id,delivery_note_reference,received_by)
  values (po.organization_id,po.id,nullif(btrim(delivery_note),''),(select auth.uid())) returning id into receipt_id;
  for row_item in select value from jsonb_array_elements(receipt_lines) as e(value) order by value->>'purchaseOrderLineId' loop
    quantity := (row_item->>'quantity')::numeric;
    if quantity <= 0 or quantity <> round(quantity,4) then raise exception 'Received quantity must be positive with up to 4 decimal places'; end if;
    select * into line from public.purchase_order_lines where organization_id=po.organization_id and purchase_order_id=po.id and id=(row_item->>'purchaseOrderLineId')::uuid for update;
    if line.id is null or line.received_quantity + quantity > line.ordered_quantity then raise exception 'Received quantity exceeds the remaining order quantity'; end if;
    insert into public.goods_receipt_lines (organization_id,receipt_id,purchase_order_line_id,material_id,quantity_received,unit_cost_snapshot)
    values (po.organization_id,receipt_id,line.id,line.material_id,quantity,line.unit_cost);
    update public.purchase_order_lines set received_quantity=received_quantity+quantity where id=line.id;
    insert into public.inventory_movements (organization_id,material_id,project_id,purchase_order_id,goods_receipt_id,movement_type,quantity_delta,unit_cost_snapshot,recorded_by)
    values (po.organization_id,line.material_id,po.project_id,po.id,receipt_id,'receipt',quantity,line.unit_cost,(select auth.uid()));
  end loop;
  update public.purchase_orders set status=case when not exists(select 1 from public.purchase_order_lines where organization_id=po.organization_id and purchase_order_id=po.id and received_quantity<ordered_quantity) then 'received' else 'partially_received' end,updated_at=now() where id=po.id;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action)
  values (po.organization_id,po.supplier_id,'goods_receipt',receipt_id,'received');
  return receipt_id;
end;
$$;

create or replace function public.issue_project_material(target_material_id uuid,target_project_id uuid,issue_quantity numeric,issue_location text,issue_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare org_id uuid; movement_id uuid; available numeric(18,4);
begin
  select organization_id into org_id from public.projects where id=target_project_id;
  if org_id is null or not public.can_record_materials(org_id,target_project_id) then raise exception 'Not authorized'; end if;
  if issue_quantity is null or issue_quantity <= 0 or issue_quantity <> round(issue_quantity,4) then raise exception 'Invalid issue quantity'; end if;
  perform 1 from public.material_items where organization_id=org_id and id=target_material_id for update;
  select coalesce(sum(quantity_delta),0) into available from public.inventory_movements where organization_id=org_id and material_id=target_material_id and location is not distinct from issue_location;
  if available < issue_quantity then raise exception 'Insufficient material stock at this location'; end if;
  insert into public.inventory_movements (organization_id,material_id,project_id,movement_type,quantity_delta,location,reason,recorded_by)
  values (org_id,target_material_id,target_project_id,'project_issue',-issue_quantity,nullif(btrim(issue_location),''),nullif(btrim(issue_reason),''),(select auth.uid())) returning id into movement_id;
  insert into public.supplier_transaction_audit_logs (organization_id,entity_type,entity_id,action,reason)
  values (org_id,'inventory_movement',movement_id,'issued',issue_reason);
  return movement_id;
end;
$$;

create or replace function public.create_material_requisition(target_organization_id uuid,target_project_id uuid,needed_by_date date,delivery_place text,request_notes text,request_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare req_id uuid; row_item jsonb; qty numeric(18,4); initial_status text;
begin
  if not public.can_record_materials(target_organization_id,target_project_id) then raise exception 'Not authorized for this project'; end if;
  if jsonb_typeof(request_lines)<>'array' or jsonb_array_length(request_lines)=0 then raise exception 'At least one material line is required'; end if;
  initial_status:=case when public.can_manage_materials(target_organization_id) then 'draft' else 'submitted' end;
  insert into public.material_requisitions (organization_id,project_id,needed_by,delivery_location,notes,status,requested_by)
  values (target_organization_id,target_project_id,needed_by_date,nullif(btrim(delivery_place),''),nullif(btrim(request_notes),''),initial_status,(select auth.uid())) returning id into req_id;
  for row_item in select value from jsonb_array_elements(request_lines) as e(value) loop
    qty:=(row_item->>'quantity')::numeric;
    if qty<=0 or qty<>round(qty,4) then raise exception 'Quantity must be positive with up to 4 decimal places'; end if;
    insert into public.material_requisition_lines (organization_id,requisition_id,material_id,requested_quantity,notes)
    values (target_organization_id,req_id,(row_item->>'materialId')::uuid,qty,nullif(btrim(row_item->>'notes'),''));
  end loop;
  insert into public.supplier_transaction_audit_logs (organization_id,entity_type,entity_id,action) values (target_organization_id,'requisition',req_id,'created');
  return req_id;
end;
$$;

create or replace function public.review_material_requisition(target_requisition_id uuid,decision text,approved_lines jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare req public.material_requisitions%rowtype; row_item jsonb; line public.material_requisition_lines%rowtype; qty numeric(18,4);
begin
  select * into req from public.material_requisitions where id=target_requisition_id for update;
  if req.id is null or not public.can_approve_materials(req.organization_id) then raise exception 'Not authorized'; end if;
  if req.status<>'submitted' or decision not in ('approved','rejected') then raise exception 'Invalid requisition decision'; end if;
  if decision='approved' then
    if jsonb_typeof(approved_lines)<>'array' then raise exception 'Invalid approved quantities'; end if;
    for row_item in select value from jsonb_array_elements(approved_lines) as e(value) loop
      qty:=(row_item->>'quantity')::numeric;
      select * into line from public.material_requisition_lines where organization_id=req.organization_id and requisition_id=req.id and id=(row_item->>'lineId')::uuid for update;
      if line.id is null or qty<0 or qty>line.requested_quantity or qty<>round(qty,4) then raise exception 'Approved quantity is invalid'; end if;
      update public.material_requisition_lines set approved_quantity=qty where id=line.id;
    end loop;
  end if;
  update public.material_requisitions set status=decision,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=req.id;
  insert into public.supplier_transaction_audit_logs (organization_id,entity_type,entity_id,action) values (req.organization_id,'requisition',req.id,decision);
end;
$$;

create or replace function public.create_purchase_order(target_organization_id uuid,target_supplier_id uuid,target_project_id uuid,target_requisition_id uuid,target_order_date date,target_expected_date date,order_notes text,order_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare po_id uuid; row_item jsonb; qty numeric(18,4); cost numeric(18,4); req public.material_requisitions%rowtype;
begin
  if not public.can_manage_materials(target_organization_id) then raise exception 'Not authorized'; end if;
  if jsonb_typeof(order_lines)<>'array' or jsonb_array_length(order_lines)=0 then raise exception 'At least one purchase order line is required'; end if;
  if target_requisition_id is not null then
    select * into req from public.material_requisitions where organization_id=target_organization_id and id=target_requisition_id for update;
    if req.id is null or req.status not in ('approved','partially_ordered') then raise exception 'Purchase orders require an approved requisition'; end if;
    if target_project_id is distinct from req.project_id then raise exception 'Project must match the requisition'; end if;
  end if;
  insert into public.purchase_orders (organization_id,project_id,supplier_id,requisition_id,order_date,expected_delivery_date,notes,created_by)
  values (target_organization_id,target_project_id,target_supplier_id,target_requisition_id,target_order_date,target_expected_date,nullif(btrim(order_notes),''),(select auth.uid())) returning id into po_id;
  for row_item in select value from jsonb_array_elements(order_lines) as e(value) loop
    qty:=(row_item->>'quantity')::numeric; cost:=(row_item->>'unitCost')::numeric;
    if qty<=0 or qty<>round(qty,4) or cost<0 or cost<>round(cost,4) then raise exception 'Order quantity or unit cost has invalid precision'; end if;
    insert into public.purchase_order_lines (organization_id,purchase_order_id,material_id,ordered_quantity,unit_cost,notes)
    values (target_organization_id,po_id,(row_item->>'materialId')::uuid,qty,cost,nullif(btrim(row_item->>'notes'),''));
  end loop;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action) values (target_organization_id,target_supplier_id,'purchase_order',po_id,'created');
  return po_id;
end;
$$;

create or replace function public.approve_purchase_order(target_purchase_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare po public.purchase_orders%rowtype;
begin
  select * into po from public.purchase_orders where id=target_purchase_order_id for update;
  if po.id is null or not public.can_approve_materials(po.organization_id) then raise exception 'Not authorized'; end if;
  if po.status not in ('draft','submitted') or not exists(select 1 from public.purchase_order_lines l where l.organization_id=po.organization_id and l.purchase_order_id=po.id) then raise exception 'Order cannot be approved'; end if;
  update public.purchase_orders set status='approved',approved_by=(select auth.uid()),approved_at=now(),updated_at=now() where id=po.id;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action) values (po.organization_id,po.supplier_id,'purchase_order',po.id,'approved');
end;
$$;

create or replace function public.mark_purchase_order_ordered(target_purchase_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare po public.purchase_orders%rowtype;
begin
  select * into po from public.purchase_orders where id=target_purchase_order_id for update;
  if po.id is null or not public.can_manage_materials(po.organization_id) then raise exception 'Not authorized'; end if;
  if po.status<>'approved' then raise exception 'Only approved orders can be sent'; end if;
  update public.purchase_orders set status='ordered',updated_at=now() where id=po.id;
end;
$$;

create or replace function public.record_supplier_payment(target_organization_id uuid,target_supplier_id uuid,target_invoice_id uuid,payment_amount numeric,payment_date date,payment_method text,payment_reference text,payment_notes text,request_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invoice public.supplier_invoices%rowtype; payment_id uuid; payment_status text; prior public.supplier_payment_transactions%rowtype; reserved numeric(18,2);
begin
  if not public.can_manage_materials(target_organization_id) then raise exception 'Not authorized'; end if;
  if payment_amount is null or payment_amount<=0 or payment_amount<>round(payment_amount,2) or char_length(btrim(request_key)) not between 8 and 160 then raise exception 'Invalid payment amount or idempotency key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || ':' || request_key,0));
  select * into prior from public.supplier_payment_transactions where organization_id=target_organization_id and idempotency_key=request_key;
  if prior.id is not null then
    if prior.supplier_id<>target_supplier_id or prior.invoice_id is distinct from target_invoice_id or prior.payment_amount<>payment_amount then raise exception 'Idempotency key was reused with different payment details'; end if;
    return prior.id;
  end if;
  if target_invoice_id is not null then
    select * into invoice from public.supplier_invoices where organization_id=target_organization_id and supplier_id=target_supplier_id and id=target_invoice_id for update;
    if invoice.id is null or invoice.status in ('cancelled','disputed') then raise exception 'Invoice is unavailable'; end if;
    select coalesce(sum(payment_amount),0) into reserved from public.supplier_payment_transactions where organization_id=target_organization_id and invoice_id=invoice.id and status in ('pending_verification','confirmed');
    if reserved+payment_amount>invoice.amount then raise exception 'Payment exceeds remaining invoice balance'; end if;
  end if;
  payment_status:=case when payment_method='cash' then 'confirmed' else 'pending_verification' end;
  insert into public.supplier_payment_transactions (organization_id,supplier_id,invoice_id,payment_amount,payment_date,payment_method,status,reference,notes,idempotency_key,recorded_by,confirmed_by,confirmed_at)
  values (target_organization_id,target_supplier_id,target_invoice_id,payment_amount,payment_date,payment_method,nullif(btrim(payment_reference),''),nullif(btrim(payment_notes),''),request_key,(select auth.uid()),case when payment_status='confirmed' then (select auth.uid()) end,case when payment_status='confirmed' then now() end) returning id into payment_id;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action) values (target_organization_id,target_supplier_id,'supplier_payment',payment_id,'created');
  if payment_status='confirmed' and target_invoice_id is not null then
    update public.supplier_invoices set status=case when (select coalesce(sum(payment_amount),0) from public.supplier_payment_transactions where organization_id=target_organization_id and invoice_id=target_invoice_id and status='confirmed')>=invoice.amount then 'paid' else 'partially_paid' end where id=target_invoice_id;
  end if;
  return payment_id;
end;
$$;

create or replace function public.confirm_supplier_payment(target_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.supplier_payment_transactions%rowtype; invoice public.supplier_invoices%rowtype; reserved numeric(18,2);
begin
  select * into payment from public.supplier_payment_transactions where id=target_payment_id for update;
  if payment.id is null or not public.can_manage_materials(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'pending_verification' then raise exception 'Only pending payments can be confirmed'; end if;
  if payment.invoice_id is not null then
    select * into invoice from public.supplier_invoices where organization_id=payment.organization_id and id=payment.invoice_id for update;
    select coalesce(sum(payment_amount),0) into reserved from public.supplier_payment_transactions where organization_id=payment.organization_id and invoice_id=payment.invoice_id and status in ('pending_verification','confirmed');
    if reserved>invoice.amount then raise exception 'Invoice balance is no longer sufficient'; end if;
  end if;
  update public.supplier_payment_transactions set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=payment.id;
  if payment.invoice_id is not null then
    update public.supplier_invoices set status=case when (select coalesce(sum(payment_amount),0) from public.supplier_payment_transactions where organization_id=payment.organization_id and invoice_id=payment.invoice_id and status='confirmed')>=invoice.amount then 'paid' else 'partially_paid' end where id=payment.invoice_id;
  end if;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action) values (payment.organization_id,payment.supplier_id,'supplier_payment',payment.id,'paid');
end;
$$;

create or replace function public.reverse_supplier_payment(target_payment_id uuid,reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.supplier_payment_transactions%rowtype; invoice public.supplier_invoices%rowtype;
begin
  select * into payment from public.supplier_payment_transactions where id=target_payment_id for update;
  if payment.id is null or not public.can_manage_materials(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status='reversed' or payment.status<>'confirmed' then raise exception 'Only confirmed payments can be reversed once'; end if;
  if char_length(btrim(reason)) not between 3 and 1000 then raise exception 'Reversal reason is required'; end if;
  update public.supplier_payment_transactions set status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reason) where id=payment.id;
  if payment.invoice_id is not null then
    select * into invoice from public.supplier_invoices where organization_id=payment.organization_id and id=payment.invoice_id for update;
    update public.supplier_invoices set status=case when (select coalesce(sum(payment_amount),0) from public.supplier_payment_transactions where organization_id=payment.organization_id and invoice_id=payment.invoice_id and status='confirmed')=0 then 'unpaid' else 'partially_paid' end where id=payment.invoice_id;
  end if;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action,reason) values (payment.organization_id,payment.supplier_id,'supplier_payment',payment.id,'reversed',btrim(reason));
end;
$$;

alter table public.suppliers enable row level security;
alter table public.material_items enable row level security;
alter table public.material_requisitions enable row level security;
alter table public.material_requisition_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_lines enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.supplier_invoices enable row level security;
alter table public.supplier_payment_transactions enable row level security;
alter table public.supplier_transaction_audit_logs enable row level security;

create policy "Finance roles read suppliers" on public.suppliers for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Finance roles manage suppliers" on public.suppliers for all to authenticated using (public.can_manage_materials(organization_id)) with check (public.can_manage_materials(organization_id));
create policy "Assigned users read material catalogue" on public.material_items for select to authenticated using (public.is_organization_member(organization_id));
create policy "Finance roles manage catalogue" on public.material_items for all to authenticated using (public.can_manage_materials(organization_id)) with check (public.can_manage_materials(organization_id));
create policy "Authorized users read requisitions" on public.material_requisitions for select to authenticated using (public.can_record_materials(organization_id,project_id));
create policy "Assigned teams create requisitions" on public.material_requisitions for insert to authenticated with check (public.can_record_materials(organization_id,project_id) and requested_by=(select auth.uid()) and status in ('draft','submitted'));
create policy "Finance roles read requisition lines" on public.material_requisition_lines for select to authenticated using (exists(select 1 from public.material_requisitions r where r.organization_id=material_requisition_lines.organization_id and r.id=material_requisition_lines.requisition_id and public.can_record_materials(r.organization_id,r.project_id)));
create policy "Finance roles read purchase orders" on public.purchase_orders for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Finance roles create purchase orders" on public.purchase_orders for insert to authenticated with check (public.can_manage_materials(organization_id) and created_by=(select auth.uid()) and status='draft');
create policy "Finance roles update draft orders" on public.purchase_orders for update to authenticated using (public.can_manage_materials(organization_id) and status='draft') with check (public.can_manage_materials(organization_id));
create policy "Finance roles read purchase lines" on public.purchase_order_lines for select to authenticated using (exists(select 1 from public.purchase_orders p where p.organization_id=purchase_order_lines.organization_id and p.id=purchase_order_lines.purchase_order_id and public.can_manage_materials(p.organization_id)));
create policy "Finance roles read receipts" on public.goods_receipts for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Finance roles read receipt lines" on public.goods_receipt_lines for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Authorized teams read stock movements" on public.inventory_movements for select to authenticated using (public.can_record_materials(organization_id,project_id) or public.can_manage_materials(organization_id));
create policy "Finance roles read supplier invoices" on public.supplier_invoices for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Finance roles create supplier invoices" on public.supplier_invoices for insert to authenticated with check (public.can_manage_materials(organization_id) and recorded_by=(select auth.uid()));
create policy "Finance roles read supplier payments" on public.supplier_payment_transactions for select to authenticated using (public.can_manage_materials(organization_id));
create policy "Finance roles read supplier audit" on public.supplier_transaction_audit_logs for select to authenticated using (public.can_manage_materials(organization_id));

create view public.material_stock_balances with (security_invoker=true) as
select organization_id,material_id,location,coalesce(sum(quantity_delta),0)::numeric(18,4) as quantity_on_hand
from public.inventory_movements group by organization_id,material_id,location;

grant select,insert,update on public.suppliers,public.material_items,public.material_requisitions,public.material_requisition_lines,public.purchase_orders,public.purchase_order_lines,public.supplier_invoices to authenticated;
grant select on public.goods_receipts,public.goods_receipt_lines,public.inventory_movements,public.supplier_payment_transactions,public.supplier_transaction_audit_logs,public.material_stock_balances to authenticated;
revoke insert,update on public.material_requisitions,public.material_requisition_lines,public.purchase_orders,public.purchase_order_lines from anon,authenticated;
revoke update on public.supplier_invoices from anon,authenticated;
revoke update,delete on public.goods_receipts,public.goods_receipt_lines,public.inventory_movements,public.supplier_payment_transactions,public.supplier_transaction_audit_logs from anon,authenticated;
revoke delete on public.suppliers,public.material_items,public.material_requisitions,public.material_requisition_lines,public.purchase_orders,public.purchase_order_lines,public.supplier_invoices from anon,authenticated;
revoke all on function public.can_manage_materials(uuid) from public,anon;
revoke all on function public.can_record_materials(uuid,uuid) from public,anon;
revoke all on function public.can_approve_materials(uuid) from public,anon;
revoke all on function public.create_material_requisition(uuid,uuid,date,text,text,jsonb) from public,anon;
revoke all on function public.review_material_requisition(uuid,text,jsonb) from public,anon;
revoke all on function public.create_purchase_order(uuid,uuid,uuid,uuid,date,date,text,jsonb) from public,anon;
revoke all on function public.approve_purchase_order(uuid) from public,anon;
revoke all on function public.mark_purchase_order_ordered(uuid) from public,anon;
revoke all on function public.receive_purchase_order(uuid,jsonb,text) from public,anon;
revoke all on function public.issue_project_material(uuid,uuid,numeric,text,text) from public,anon;
revoke all on function public.record_supplier_payment(uuid,uuid,uuid,numeric,date,text,text,text,text) from public,anon;
revoke all on function public.confirm_supplier_payment(uuid) from public,anon;
revoke all on function public.reverse_supplier_payment(uuid,text) from public,anon;
grant execute on function public.can_manage_materials(uuid) to authenticated;
grant execute on function public.can_record_materials(uuid,uuid) to authenticated;
grant execute on function public.can_approve_materials(uuid) to authenticated;
grant execute on function public.create_material_requisition(uuid,uuid,date,text,text,jsonb) to authenticated;
grant execute on function public.review_material_requisition(uuid,text,jsonb) to authenticated;
grant execute on function public.create_purchase_order(uuid,uuid,uuid,uuid,date,date,text,jsonb) to authenticated;
grant execute on function public.approve_purchase_order(uuid) to authenticated;
grant execute on function public.mark_purchase_order_ordered(uuid) to authenticated;
grant execute on function public.receive_purchase_order(uuid,jsonb,text) to authenticated;
grant execute on function public.issue_project_material(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function public.record_supplier_payment(uuid,uuid,uuid,numeric,date,text,text,text,text) to authenticated;
grant execute on function public.confirm_supplier_payment(uuid) to authenticated;
grant execute on function public.reverse_supplier_payment(uuid,text) to authenticated;
