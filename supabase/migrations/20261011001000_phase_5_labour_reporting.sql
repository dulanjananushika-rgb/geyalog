-- Phase 5 read-only workforce reporting. All totals are aggregated in PostgreSQL NUMERIC.
create or replace function public.get_labour_project_cost_summary(target_organization_id uuid,target_project_id uuid)
returns table(earned_labour_cost numeric,confirmed_payment_outflow numeric,pending_payment_amount numeric,confirmed_advance_outflow numeric,unrecovered_advances numeric,subcontractor_advances_outstanding numeric,earned_balance_payable numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.projects p where p.organization_id=target_organization_id and p.id=target_project_id) then raise exception 'Project not found'; end if;
  return query
  with earned as (
    select coalesce(sum(e.amount),0)::numeric(18,2) as amount from public.labour_earning_entries e where e.organization_id=target_organization_id and e.project_id=target_project_id
  ), subcontract_earned as (
    select coalesce(sum(w.approved_amount),0)::numeric(18,2) as amount from public.subcontractor_work_records w where w.organization_id=target_organization_id and w.project_id=target_project_id and w.status='approved'
  ), payment_totals as (
    select coalesce(sum(p.payment_amount) filter(where p.status='confirmed'),0)::numeric(18,2) as confirmed,
           coalesce(sum(p.payment_amount) filter(where p.status='pending_verification'),0)::numeric(18,2) as pending,
           coalesce(sum(p.payment_amount) filter(where p.status='confirmed' and p.payment_purpose<>'advance'),0)::numeric(18,2) as earned_paid
    from public.labour_payment_transactions p where p.organization_id=target_organization_id and p.project_id=target_project_id
  ), advances as (
    select coalesce(sum(a.amount) filter(where a.status='confirmed'),0)::numeric(18,2) as total from public.labour_advances a where a.organization_id=target_organization_id and a.project_id=target_project_id
  ), subcontractor_advances as (
    select coalesce(sum(p.payment_amount) filter(where p.status='confirmed'),0)::numeric(18,2) as total from public.labour_payment_transactions p where p.organization_id=target_organization_id and p.project_id=target_project_id and p.subcontractor_id is not null and p.payment_purpose='advance'
  ), offsets as (
    select coalesce(sum(x.amount),0)::numeric(18,2) as total from public.labour_advance_allocations x join public.labour_settlements s on s.organization_id=x.organization_id and s.id=x.settlement_id where x.organization_id=target_organization_id and x.project_id=target_project_id and s.status in ('approved','partially_paid','paid')
  )
  select earned.amount+subcontract_earned.amount,payment_totals.confirmed,payment_totals.pending,advances.total,
         greatest(advances.total-offsets.total,0)::numeric(18,2),subcontractor_advances.total,
         greatest(earned.amount+subcontract_earned.amount-payment_totals.earned_paid-offsets.total,0)::numeric(18,2)
  from earned,subcontract_earned,payment_totals,advances,subcontractor_advances,offsets;
end;
$$;

create or replace function public.get_worker_financial_history(target_organization_id uuid,target_worker_id uuid)
returns table(record_type text,record_date date,amount numeric,status text,details text,project_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.workers w where w.organization_id=target_organization_id and w.id=target_worker_id) then raise exception 'Worker not found'; end if;
  return query
  select 'attendance'::text,a.work_date,null::numeric,a.approval_status,
         a.attendance_status||' · '||coalesce(a.hours_worked::text||'h','hours n/a'),a.project_id
  from public.attendance_records a where a.organization_id=target_organization_id and a.worker_id=target_worker_id and a.approval_status<>'superseded'
  union all
  select 'earned'::text,e.earning_date,e.amount::numeric,e.description,e.basis_quantity::text||' × LKR '||e.rate_snapshot::text,e.project_id
  from public.labour_earning_entries e where e.organization_id=target_organization_id and e.worker_id=target_worker_id
  union all
  select 'advance'::text,a.payment_date,a.amount::numeric,a.status,coalesce(a.reference,a.notes,'Worker advance'),a.project_id
  from public.labour_advances a where a.organization_id=target_organization_id and a.worker_id=target_worker_id
  union all
  select 'settlement'::text,s.period_end,(s.gross_earned-s.advance_offset)::numeric,s.status,'Period '||s.period_start::text||' – '||s.period_end::text||' · advance recovery LKR '||s.advance_offset::text,s.project_id
  from public.labour_settlements s where s.organization_id=target_organization_id and s.worker_id=target_worker_id
  union all
  select 'payment'::text,p.payment_date,p.payment_amount::numeric,p.status,p.payment_purpose||' · '||p.payment_method,p.project_id
  from public.labour_payment_transactions p where p.organization_id=target_organization_id and p.worker_id=target_worker_id
  order by 2 desc limit 500;
end;
$$;

create or replace function public.record_subcontractor_advance(target_organization_id uuid,target_project_id uuid,target_subcontractor_id uuid,payment_amount numeric,payment_date date,payment_method text,payment_reference text,payment_notes text,request_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid; prior public.labour_payment_transactions%rowtype; state text;
begin
  if not public.can_manage_labour_finance(target_organization_id) then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.subcontractors where organization_id=target_organization_id and id=target_subcontractor_id and status='active') or not exists(select 1 from public.projects where organization_id=target_organization_id and id=target_project_id) then raise exception 'Subcontractor or project not found'; end if;
  if payment_amount is null or payment_amount<=0 or payment_amount<>round(payment_amount,2) or char_length(btrim(request_key)) not between 8 and 160 then raise exception 'Invalid advance amount or request key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || ':' || request_key,0));
  select * into prior from public.labour_payment_transactions where organization_id=target_organization_id and idempotency_key=request_key;
  if prior.id is not null then
    if prior.subcontractor_id<>target_subcontractor_id or prior.project_id<>target_project_id or prior.payment_amount<>payment_amount or prior.payment_date<>payment_date or prior.payment_method<>payment_method or prior.payment_purpose<>'advance' then raise exception 'Idempotency key reused with different advance details'; end if;
    return prior.id;
  end if;
  state:=case when payment_method='cash' then 'confirmed' else 'pending_verification' end;
  insert into public.labour_payment_transactions(organization_id,project_id,subcontractor_id,payment_amount,payment_date,payment_method,payment_purpose,status,reference,notes,idempotency_key,recorded_by,confirmed_by,confirmed_at)
  values(target_organization_id,target_project_id,target_subcontractor_id,payment_amount,payment_date,payment_method,'advance',state,nullif(btrim(payment_reference),''),nullif(btrim(payment_notes),''),request_key,(select auth.uid()),case when state='confirmed' then (select auth.uid()) end,case when state='confirmed' then now() end) returning id into result_id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action) values(target_organization_id,target_project_id,'labour_payment',result_id,'created');
  return result_id;
end;
$$;

create or replace function public.confirm_subcontractor_payment(target_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.labour_payment_transactions%rowtype; work_row public.subcontractor_work_records%rowtype; paid numeric(18,2);
begin
  select * into payment from public.labour_payment_transactions where id=target_payment_id for update;
  if payment.id is null or payment.subcontractor_id is null or not public.can_manage_labour_finance(payment.organization_id) then raise exception 'Not authorized'; end if;
  if payment.status<>'pending_verification' then raise exception 'Only pending payments can be confirmed'; end if;
  if payment.subcontractor_work_record_id is not null then
    select * into work_row from public.subcontractor_work_records where organization_id=payment.organization_id and id=payment.subcontractor_work_record_id for update;
    select coalesce(sum(payment_amount),0) into paid from public.labour_payment_transactions where organization_id=payment.organization_id and subcontractor_work_record_id=work_row.id and status='confirmed';
    if paid+payment.payment_amount>work_row.approved_amount then raise exception 'Confirmed payments exceed approved work'; end if;
  elsif payment.payment_purpose<>'advance' then raise exception 'Only subcontractor advances may be confirmed without an approved work record';
  end if;
  update public.labour_payment_transactions set status='confirmed',confirmed_by=(select auth.uid()),confirmed_at=now() where id=payment.id;
  insert into public.labour_transaction_audit_logs(organization_id,project_id,entity_type,entity_id,action) values(payment.organization_id,payment.project_id,'labour_payment',payment.id,'paid');
end;
$$;

revoke all on function public.get_labour_project_cost_summary(uuid,uuid) from public,anon;
revoke all on function public.get_worker_financial_history(uuid,uuid) from public,anon;
revoke all on function public.record_subcontractor_advance(uuid,uuid,uuid,numeric,date,text,text,text,text) from public,anon;
revoke all on function public.confirm_subcontractor_payment(uuid) from public,anon;
grant execute on function public.get_labour_project_cost_summary(uuid,uuid) to authenticated;
grant execute on function public.get_worker_financial_history(uuid,uuid) to authenticated;
grant execute on function public.record_subcontractor_advance(uuid,uuid,uuid,numeric,date,text,text,text,text) to authenticated;
grant execute on function public.confirm_subcontractor_payment(uuid) to authenticated;
