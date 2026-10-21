-- Controlled full receipt reversal when received goods must be returned.
create or replace function public.reverse_goods_receipt(target_receipt_id uuid,reversal_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare receipt public.goods_receipts%rowtype; po public.purchase_orders%rowtype; line public.goods_receipt_lines%rowtype; available numeric(18,4);
begin
  select * into receipt from public.goods_receipts where id=target_receipt_id for update;
  if receipt.id is null or not public.can_manage_materials(receipt.organization_id) then raise exception 'Not authorized'; end if;
  if receipt.status<>'confirmed' then raise exception 'Only confirmed receipts can be reversed'; end if;
  if char_length(btrim(reversal_reason)) not between 3 and 1000 then raise exception 'Reversal reason is required'; end if;
  select * into po from public.purchase_orders where organization_id=receipt.organization_id and id=receipt.purchase_order_id for update;
  for line in select * from public.goods_receipt_lines where organization_id=receipt.organization_id and receipt_id=receipt.id order by material_id for update loop
    perform 1 from public.material_items where organization_id=receipt.organization_id and id=line.material_id for update;
    select coalesce(sum(quantity_delta),0) into available from public.inventory_movements where organization_id=receipt.organization_id and material_id=line.material_id and location is null;
    if available<line.quantity_received then raise exception 'Cannot reverse: received stock has already been consumed from the default location'; end if;
    insert into public.inventory_movements(organization_id,material_id,project_id,purchase_order_id,goods_receipt_id,movement_type,quantity_delta,unit_cost_snapshot,reason,recorded_by)
    values(receipt.organization_id,line.material_id,po.project_id,po.id,receipt.id,'adjustment_out',-line.quantity_received,line.unit_cost_snapshot,'Receipt reversal: '||btrim(reversal_reason),(select auth.uid()));
    update public.purchase_order_lines set received_quantity=received_quantity-line.quantity_received where organization_id=receipt.organization_id and id=line.purchase_order_line_id and received_quantity>=line.quantity_received;
    if not found then raise exception 'Purchase order received quantity is inconsistent'; end if;
  end loop;
  update public.goods_receipts set status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reversal_reason) where id=receipt.id;
  update public.purchase_orders set status=case when not exists(select 1 from public.purchase_order_lines l where l.organization_id=po.organization_id and l.purchase_order_id=po.id and l.received_quantity>0) then 'ordered' else 'partially_received' end,updated_at=now() where id=po.id;
  insert into public.supplier_transaction_audit_logs(organization_id,supplier_id,entity_type,entity_id,action,reason)
  values(po.organization_id,po.supplier_id,'goods_receipt',receipt.id,'reversed',btrim(reversal_reason));
end;
$$;
revoke all on function public.reverse_goods_receipt(uuid,text) from public,anon;
grant execute on function public.reverse_goods_receipt(uuid,text) to authenticated;
