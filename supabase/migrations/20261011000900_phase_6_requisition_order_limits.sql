-- Enforce approved requisition quantities when a PO references a site request.
alter table public.purchase_order_lines add column requisition_line_id uuid;
alter table public.purchase_order_lines add constraint purchase_order_lines_requisition_line_fk
  foreign key (organization_id,requisition_line_id) references public.material_requisition_lines(organization_id,id) on delete restrict;
create index purchase_order_lines_requisition_idx on public.purchase_order_lines(organization_id,requisition_line_id) where requisition_line_id is not null;

create or replace function public.create_purchase_order(target_organization_id uuid,target_supplier_id uuid,target_project_id uuid,target_requisition_id uuid,target_order_date date,target_expected_date date,order_notes text,order_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare po_id uuid; row_item jsonb; qty numeric(18,4); cost numeric(18,4); req public.material_requisitions%rowtype; req_line public.material_requisition_lines%rowtype; material_id uuid; req_line_id uuid; already_ordered numeric(18,4);
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
    qty:=(row_item->>'quantity')::numeric; cost:=(row_item->>'unitCost')::numeric; material_id:=(row_item->>'materialId')::uuid;
    if qty<=0 or qty<>round(qty,4) or cost<0 or cost<>round(cost,4) then raise exception 'Order quantity or unit cost has invalid precision'; end if;
    req_line_id:=null;
    if target_requisition_id is not null then
      req_line_id:=(row_item->>'requisitionLineId')::uuid;
      select * into req_line from public.material_requisition_lines where organization_id=target_organization_id and requisition_id=target_requisition_id and id=req_line_id for update;
      if req_line.id is null or req_line.material_id<>material_id or req_line.approved_quantity is null then raise exception 'Purchase line must match an approved requisition line'; end if;
      select coalesce(sum(pol.ordered_quantity),0) into already_ordered from public.purchase_order_lines pol join public.purchase_orders p on p.organization_id=pol.organization_id and p.id=pol.purchase_order_id where pol.organization_id=target_organization_id and pol.requisition_line_id=req_line.id and p.status<>'cancelled';
      if already_ordered+qty>req_line.approved_quantity then raise exception 'PO quantity exceeds remaining approved requisition quantity'; end if;
    end if;
    insert into public.purchase_order_lines (organization_id,purchase_order_id,material_id,requisition_line_id,ordered_quantity,unit_cost,notes)
    values (target_organization_id,po_id,material_id,req_line_id,qty,cost,nullif(btrim(row_item->>'notes'),''));
  end loop;
  if target_requisition_id is not null then
    update public.material_requisitions r set status=case when not exists(
      select 1 from public.material_requisition_lines l where l.organization_id=r.organization_id and l.requisition_id=r.id and coalesce((select sum(pol.ordered_quantity) from public.purchase_order_lines pol join public.purchase_orders p on p.organization_id=pol.organization_id and p.id=pol.purchase_order_id where pol.organization_id=l.organization_id and pol.requisition_line_id=l.id and p.status<>'cancelled'),0)<coalesce(l.approved_quantity,0)
    ) then 'ordered' else 'partially_ordered' end,updated_at=now() where r.organization_id=target_organization_id and r.id=target_requisition_id;
  end if;
  insert into public.supplier_transaction_audit_logs (organization_id,supplier_id,entity_type,entity_id,action) values (target_organization_id,target_supplier_id,'purchase_order',po_id,'created');
  return po_id;
end;
$$;

revoke all on function public.create_purchase_order(uuid,uuid,uuid,uuid,date,date,text,jsonb) from public,anon;
grant execute on function public.create_purchase_order(uuid,uuid,uuid,uuid,date,date,text,jsonb) to authenticated;
