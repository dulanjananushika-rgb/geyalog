-- Phase 5 completion: auditable subcontractor agreements, approved work and payments.
-- This migration is local source only until verified against disposable PostgreSQL.

create or replace function public.create_subcontractor_agreement(
  target_organization_id uuid,target_project_id uuid,target_subcontractor_id uuid,
  agreement_description text,target_payment_basis text,target_unit_name text,
  target_rate numeric,target_agreed_amount numeric,target_start_date date,target_end_date date
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  if not public.can_manage_labour(target_organization_id) then raise exception 'Not authorized'; end if;
  if char_length(btrim(agreement_description)) not between 2 and 2000 then raise exception 'Agreement description is required'; end if;
  if target_payment_basis not in ('unit_rate','fixed_task','milestone') then raise exception 'Invalid payment basis'; end if;
  if target_payment_basis='unit_rate' and (target_rate is null or target_rate<=0 or nullif(btrim(target_unit_name),'') is null) then raise exception 'Unit rate and unit are required'; end if;
  if target_payment_basis in ('fixed_task','milestone') and (target_agreed_amount is null or target_agreed_amount<=0 or target_agreed_amount<>round(target_agreed_amount,2)) then raise exception 'Agreed amount is required'; end if;
  if target_payment_basis='unit_rate' and target_rate<>round(target_rate,4) then raise exception 'Rate precision is invalid'; end if;
  if target_end_date is not null and target_start_date is not null and target_end_date<target_start_date then raise exception 'Invalid agreement dates'; end if;
  insert into public.subcontractor_agreements(organization_id,project_id,subcontractor_id,description,payment_basis,unit_name,rate,agreed_amount,start_date,end_date,status,created_by)
  values(target_organization_id,target_project_id,target_subcontractor_id,btrim(agreement_description),target_payment_basis,nullif(btrim(target_unit_name),''),target_rate,target_agreed_amount,target_start_date,target_end_date,'active',(select auth.uid())) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.submit_subcontractor_work(target_organization_id uuid,target_project_id uuid,target_agreement_id uuid,target_work_date date,target_reported_quantity numeric,target_requested_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare agreement public.subcontractor_agreements%rowtype; result_id uuid;
begin
  if not public.can_record_project_attendance(target_organization_id,target_project_id) then raise exception 'Not authorized for this project'; end if;
  select * into agreement from public.subcontractor_agreements where organization_id=target_organization_id and project_id=target_project_id and id=target_agreement_id and status='active';
  if agreement.id is null then raise exception 'Active subcontractor agreement not found'; end if;
  if agreement.payment_basis='unit_rate' and (target_reported_quantity is null or target_reported_quantity<=0 or target_reported_quantity<>round(target_reported_quantity,4)) then raise exception 'Valid reported quantity is required'; end if;
  if agreement.payment_basis in ('fixed_task','milestone') and (target_requested_amount is null or target_requested_amount<=0 or target_requested_amount<>round(target_requested_amount,2)) then raise exception 'Requested amount is required'; end if;
  insert into public.subcontractor_work_records(organization_id,project_id,agreement_id,work_date,reported_quantity,agreed_amount,status,submitted_by)
  values(target_organization_id,target_project_id,target_agreement_id,target_work_date,target_reported_quantity,target_requested_amount,'submitted',(select auth.uid())) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.approve_subcontractor_work(target_work_record_id uuid,target_approved_quantity numeric,target_approved_amount numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare work_row public.subcontractor_work_records%rowtype; agreement public.subcontractor_agreements%rowtype; consumed numeric(18,2); computed_amount numeric(18,2);
begin
  select * into work_row from public.subcontractor_work_records where id=target_work_record_id for update;
  if work_row.id is null or not public.can_manage_labour_finance(work_row.organization_id) then raise exception 'Not authorized'; end if;
  if work_row.status<>'submitted' then raise exception 'Only submitted work can be reviewed'; end if;
  select * into agreement from public.subcontractor_agreements where organization_id=work_row.organization_id and project_id=work_row.project_id and id=work_row.agreement_id for update;
  if agreement.status<>'active' then raise exception 'Agreement is not active'; end if;
  if agreement.payment_basis='unit_rate' then
    if target_approved_quantity is null or target_approved_quantity<0 or target_approved_quantity>work_row.reported_quantity or target_approved_quantity<>round(target_approved_quantity,4) then raise exception 'Approved quantity is invalid'; end if;
    computed_amount:=round(target_approved_quantity*agreement.rate,2);
  else
    if target_approved_amount is null or target_approved_amount<=0 or target_approved_amount<>round(target_approved_amount,2) then raise exception 'Approved amount is invalid'; end if;
    if agreement.payment_basis in ('fixed_task','milestone') then
      select coalesce(sum(approved_amount),0) into consumed from public.subcontractor_work_records where organization_id=agreement.organization_id and agreement_id=agreement.id and status='approved';
      if consumed+target_approved_amount>coalesce(agreement.agreed_amount,work_row.agreed_amount,0) then raise exception 'Approved work exceeds agreed amount'; end if;
      if target_approved_amount>coalesce(work_row.agreed_amount,agreement.agreed_amount,0) then raise exception 'Approved amount exceeds submitted amount'; end if;
    end if;
    computed_amount:=target_approved_amount;
    target_approved_quantity:=coalesce(target_approved_quantity,work_row.reported_quantity,1);
  end if;
  update public.subcontractor_work_records set status='approved',approved_quantity=target_approved_quantity,approved_amount=computed_amount,approved_by=(select auth.uid()),approved_at=now() where id=work_row.id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action) values(work_row.organization_id,work_row.project_id,'subcontractor_work',work_row.id,'approved');
end;
$$;

create or replace function public.record_subcontractor_payment(target_work_record_id uuid,payment_amount numeric,payment_date date,payment_method text,payment_reference text,payment_notes text,request_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare work_row public.subcontractor_work_records%rowtype; agreement public.subcontractor_agreements%rowtype; result_id uuid; prior public.labour_payment_transactions%rowtype; reserved numeric(18,2); state text;
begin
  select * into work_row from public.subcontractor_work_records where id=target_work_record_id for update;
  if work_row.id is null or not public.can_manage_labour_finance(work_row.organization_id) then raise exception 'Not authorized'; end if;
  if work_row.status<>'approved' or work_row.approved_amount is null then raise exception 'Work must be approved before payment'; end if;
  if payment_amount is null or payment_amount<=0 or payment_amount<>round(payment_amount,2) or char_length(btrim(request_key)) not between 8 and 160 then raise exception 'Invalid payment amount or request key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(work_row.organization_id::text || ':' || request_key,0));
  select * into prior from public.labour_payment_transactions where organization_id=work_row.organization_id and idempotency_key=request_key;
  if prior.id is not null then
    if prior.subcontractor_work_record_id<>work_row.id or prior.payment_amount<>payment_amount or prior.payment_date<>payment_date or prior.payment_method<>payment_method then raise exception 'Idempotency key reused with different payment details'; end if;
    return prior.id;
  end if;
  select * into agreement from public.subcontractor_agreements where organization_id=work_row.organization_id and id=work_row.agreement_id for update;
  select coalesce(sum(payment_amount),0) into reserved from public.labour_payment_transactions where organization_id=work_row.organization_id and subcontractor_work_record_id=work_row.id and status in ('pending_verification','confirmed');
  if reserved+payment_amount>work_row.approved_amount then raise exception 'Payment exceeds approved work balance'; end if;
  state:=case when payment_method='cash' then 'confirmed' else 'pending_verification' end;
  insert into public.labour_payment_transactions(organization_id,project_id,subcontractor_id,subcontractor_work_record_id,payment_amount,payment_date,payment_method,payment_purpose,status,reference,notes,idempotency_key,recorded_by,confirmed_by,confirmed_at)
  values(work_row.organization_id,work_row.project_id,agreement.subcontractor_id,work_row.id,payment_amount,payment_date,payment_method,'task_payment',state,nullif(btrim(payment_reference),''),nullif(btrim(payment_notes),''),request_key,(select auth.uid()),case when state='confirmed' then (select auth.uid()) end,case when state='confirmed' then now() end) returning id into result_id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action) values(work_row.organization_id,work_row.project_id,'labour_payment',result_id,'created');
  return result_id;
end;
$$;

create or replace function public.confirm_subcontractor_payment(target_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.labour_payment_transactions%rowtype; work_row public.subcontractor_work_records%rowtype; paid numeric(18,2);
begin
  select * into payment from public.labour_payment_transactions where id=target_payment_id for update;
  if payment.id is null or payment.subcontractor_id is null or payment.subcontractor_work_record_id is null or not public.can_manage_labour_finance(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'pending_verification' then raise exception 'Only pending payments can be confirmed'; end if;
  select * into work_row from public.subcontractor_work_records where organization_id=payment.organization_id and id=payment.subcontractor_work_record_id for update;
  select coalesce(sum(payment_amount),0) into paid from public.labour_payment_transactions where organization_id=payment.organization_id and subcontractor_work_record_id=work_row.id and status='confirmed';
  if paid+payment.payment_amount>work_row.approved_amount then raise exception 'Confirmed payments exceed approved work'; end if;
  update public.labour_payment_transactions set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=payment.id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action) values(payment.organization_id,payment.project_id,'labour_payment',payment.id,'paid');
end;
$$;

create or replace function public.reverse_subcontractor_payment(target_payment_id uuid,reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.labour_payment_transactions%rowtype;
begin
  select * into payment from public.labour_payment_transactions where id=target_payment_id for update;
  if payment.id is null or payment.subcontractor_id is null or not public.can_manage_labour_finance(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'confirmed' then raise exception 'Only confirmed subcontractor payments can be reversed'; end if;
  if char_length(btrim(reason)) not between 3 and 1000 then raise exception 'Reversal reason is required'; end if;
  update public.labour_payment_transactions set status='reversed',reversed_by=(select auth.uid()),reversed_at=now(),reversal_reason=btrim(reason) where id=payment.id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action,reason) values(payment.organization_id,payment.project_id,'labour_payment',payment.id,'reversed',btrim(reason));
end;
$$;

-- Agreement creation and financial state transitions go through trusted RPCs.
alter table public.labour_transaction_audit_logs drop constraint if exists labour_transaction_audit_logs_entity_type_check;
alter table public.labour_transaction_audit_logs add constraint labour_transaction_audit_logs_entity_type_check check (entity_type in ('advance','settlement','labour_payment','task_progress','attendance','subcontractor_work'));
drop policy if exists "Finance roles read subcontract agreements" on public.subcontractor_agreements;
create policy "Finance roles read subcontract agreements" on public.subcontractor_agreements for select to authenticated using (public.can_manage_labour_finance(organization_id));
grant insert on public.subcontractors to authenticated;
revoke insert,update,delete on public.subcontractor_agreements,public.subcontractor_work_records,public.labour_payment_transactions from anon,authenticated;
revoke all on function public.create_subcontractor_agreement(uuid,uuid,uuid,text,text,text,numeric,numeric,date,date) from public,anon;
revoke all on function public.submit_subcontractor_work(uuid,uuid,uuid,date,numeric,numeric) from public,anon;
revoke all on function public.approve_subcontractor_work(uuid,numeric,numeric) from public,anon;
revoke all on function public.record_subcontractor_payment(uuid,numeric,date,text,text,text,text) from public,anon;
revoke all on function public.confirm_subcontractor_payment(uuid) from public,anon;
revoke all on function public.reverse_subcontractor_payment(uuid,text) from public,anon;
grant execute on function public.create_subcontractor_agreement(uuid,uuid,uuid,text,text,text,numeric,numeric,date,date) to authenticated;
grant execute on function public.submit_subcontractor_work(uuid,uuid,uuid,date,numeric,numeric) to authenticated;
grant execute on function public.approve_subcontractor_work(uuid,numeric,numeric) to authenticated;
grant execute on function public.record_subcontractor_payment(uuid,numeric,date,text,text,text,text) to authenticated;
grant execute on function public.confirm_subcontractor_payment(uuid) to authenticated;
grant execute on function public.reverse_subcontractor_payment(uuid,text) to authenticated;
