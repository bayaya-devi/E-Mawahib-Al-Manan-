begin;

alter table public.finance_transactions
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists allocation_kind text not null default 'unassigned',
  add column if not exists transaction_status text not null default 'posted',
  add column if not exists reversed_transaction_id uuid references public.finance_transactions(id) on delete restrict,
  add column if not exists idempotency_key uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='finance_payment_method_check') then
    alter table public.finance_transactions add constraint finance_payment_method_check
      check (payment_method is null or payment_method in ('cash','bank','card','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname='finance_allocation_kind_check') then
    alter table public.finance_transactions add constraint finance_allocation_kind_check
      check (allocation_kind in ('direct','common','unassigned'));
  end if;
  if not exists (select 1 from pg_constraint where conname='finance_transaction_status_check') then
    alter table public.finance_transactions add constraint finance_transaction_status_check
      check (transaction_status in ('posted','reversed'));
  end if;
end $$;

create unique index if not exists finance_transactions_idempotency_unique
  on public.finance_transactions(school_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists finance_transactions_single_reversal
  on public.finance_transactions(reversed_transaction_id) where reversed_transaction_id is not null;
create index if not exists finance_transactions_class_month_idx
  on public.finance_transactions(class_id,occurred_on desc) where class_id is not null;

create or replace function public.finance_assign_student_class() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.class_id is null and new.student_id is not null then
    select ce.class_id into new.class_id from public.class_enrollments ce
    join public.classes c on c.id=ce.class_id and c.school_id=new.school_id
    where ce.student_id=new.student_id and ce.status='active'
    order by ce.enrolled_at desc limit 1;
    if new.class_id is not null and new.allocation_kind='unassigned' then new.allocation_kind:='direct'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists finance_transactions_assign_class on public.finance_transactions;
create trigger finance_transactions_assign_class before insert or update of student_id,class_id on public.finance_transactions
  for each row execute function public.finance_assign_student_class();

create table if not exists public.finance_class_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.finance_transactions(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  created_at timestamptz not null default now(),
  unique(transaction_id,class_id)
);

create table if not exists public.recurring_charges (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  title text not null check(char_length(trim(title)) between 2 and 120),
  category text not null,
  amount numeric(12,2) not null check(amount > 0),
  currency char(3) not null default 'MAD' check(currency='MAD'),
  due_day smallint not null default 1 check(due_day between 1 and 28),
  class_id uuid references public.classes(id) on delete set null,
  allocation_kind text not null default 'common' check(allocation_kind in ('direct','common')),
  active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on is null or ends_on >= starts_on)
);

drop trigger if exists recurring_charges_updated on public.recurring_charges;
create trigger recurring_charges_updated before update on public.recurring_charges
  for each row execute function public.set_updated_at();

alter table public.finance_class_allocations enable row level security;
alter table public.recurring_charges enable row level security;
drop policy if exists finance_class_allocations_admin_read on public.finance_class_allocations;
create policy finance_class_allocations_admin_read on public.finance_class_allocations for select to authenticated using (
  exists(select 1 from public.finance_transactions ft where ft.id=transaction_id and public.can_manage_school(ft.school_id))
);
drop policy if exists recurring_charges_admin_read on public.recurring_charges;
create policy recurring_charges_admin_read on public.recurring_charges for select to authenticated using(public.can_manage_school(school_id));
revoke all on public.finance_class_allocations,public.recurring_charges from anon;
revoke insert,update,delete,truncate,references,trigger on public.finance_class_allocations,public.recurring_charges from authenticated;
grant select on public.finance_class_allocations,public.recurring_charges to authenticated;

create or replace function public.admin_record_manual_finance(
  target_school_id uuid,target_direction public.finance_direction,target_category text,target_amount numeric,
  target_occurred_on date,target_description text,target_class_id uuid,target_payment_method text,
  target_allocation_kind text,target_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (select auth.uid()); transaction_id uuid;
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) then raise exception 'finance_scope_denied'; end if;
  if target_amount <= 0 or char_length(trim(target_category)) not between 2 and 80 then raise exception 'invalid_finance_input'; end if;
  if target_payment_method not in ('cash','bank','card','other') then raise exception 'invalid_payment_method'; end if;
  if target_allocation_kind not in ('direct','common','unassigned') then raise exception 'invalid_allocation_kind'; end if;
  if target_class_id is not null and not exists(select 1 from public.classes where id=target_class_id and school_id=target_school_id) then raise exception 'class_scope_denied'; end if;
  if target_allocation_kind='direct' and target_class_id is null then raise exception 'direct_class_required'; end if;
  select id into transaction_id from public.finance_transactions where school_id=target_school_id and idempotency_key=target_idempotency_key;
  if transaction_id is not null then return transaction_id; end if;
  insert into public.finance_transactions(school_id,direction,category,amount,currency,occurred_on,description,class_id,payment_method,
    allocation_kind,transaction_status,idempotency_key,created_by,source_type,reference_code)
  values(target_school_id,target_direction,trim(target_category),target_amount,'MAD',target_occurred_on,nullif(trim(target_description),''),
    target_class_id,target_payment_method,target_allocation_kind,'posted',target_idempotency_key,actor,'manual','manual:'||target_idempotency_key)
  returning id into transaction_id;
  if target_class_id is not null then
    insert into public.finance_class_allocations(transaction_id,class_id,amount) values(transaction_id,target_class_id,target_amount);
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,target_school_id,'finance.manual_recorded','finance_transaction',transaction_id,
    jsonb_build_object('direction',target_direction,'amount',target_amount,'class_id',target_class_id,'allocation_kind',target_allocation_kind));
  return transaction_id;
end; $$;

create or replace function public.admin_reverse_manual_finance(target_transaction_id uuid,target_reason text,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (select auth.uid()); original public.finance_transactions%rowtype; reversal uuid;
begin
  perform public.require_administration_aal2();
  select * into original from public.finance_transactions where id=target_transaction_id for update;
  if original.id is null or not public.can_manage_school(original.school_id) then raise exception 'finance_scope_denied'; end if;
  if original.source_type<>'manual' or original.transaction_status='reversed' then raise exception 'transaction_not_reversible'; end if;
  if char_length(trim(target_reason))<3 then raise exception 'reversal_reason_required'; end if;
  select id into reversal from public.finance_transactions where school_id=original.school_id and idempotency_key=target_idempotency_key;
  if reversal is not null then return reversal; end if;
  insert into public.finance_transactions(school_id,direction,category,amount,currency,occurred_on,description,class_id,payment_method,
    allocation_kind,transaction_status,reversed_transaction_id,idempotency_key,created_by,source_type,reference_code)
  values(original.school_id,case when original.direction='income' then 'expense'::public.finance_direction else 'income'::public.finance_direction end,
    'reversal',original.amount,original.currency,current_date,trim(target_reason),original.class_id,original.payment_method,
    original.allocation_kind,'posted',original.id,target_idempotency_key,actor,'reversal','reversal:'||original.id)
  returning id into reversal;
  update public.finance_transactions set transaction_status='reversed' where id=original.id;
  if original.class_id is not null then insert into public.finance_class_allocations(transaction_id,class_id,amount) values(reversal,original.class_id,original.amount); end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,original.school_id,'finance.transaction_reversed','finance_transaction',original.id,jsonb_build_object('reversal_id',reversal,'reason',trim(target_reason)));
  return reversal;
end; $$;

create or replace function public.admin_save_recurring_charge(
  target_school_id uuid,target_id uuid,target_title text,target_category text,target_amount numeric,target_due_day smallint,
  target_class_id uuid,target_allocation_kind text,target_starts_on date,target_ends_on date,target_active boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (select auth.uid()); charge uuid := coalesce(target_id,gen_random_uuid());
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) or target_amount<=0 or target_due_day not between 1 and 28 then raise exception 'invalid_recurring_charge'; end if;
  if target_allocation_kind='direct' and target_class_id is null then raise exception 'direct_class_required'; end if;
  if target_class_id is not null and not exists(select 1 from public.classes where id=target_class_id and school_id=target_school_id) then raise exception 'class_scope_denied'; end if;
  insert into public.recurring_charges(id,school_id,title,category,amount,due_day,class_id,allocation_kind,active,starts_on,ends_on,created_by)
  values(charge,target_school_id,trim(target_title),trim(target_category),target_amount,target_due_day,target_class_id,target_allocation_kind,target_active,target_starts_on,target_ends_on,actor)
  on conflict(id) do update set title=excluded.title,category=excluded.category,amount=excluded.amount,due_day=excluded.due_day,
    class_id=excluded.class_id,allocation_kind=excluded.allocation_kind,active=excluded.active,starts_on=excluded.starts_on,ends_on=excluded.ends_on;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,target_school_id,'finance.recurring_charge_saved','recurring_charge',charge,jsonb_build_object('amount',target_amount,'active',target_active));
  return charge;
end; $$;

create or replace function public.admin_pay_recurring_charge(target_charge_id uuid,target_period_month date,target_paid_on date,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid := (select auth.uid()); charge public.recurring_charges%rowtype; transaction_id uuid; month date:=date_trunc('month',target_period_month)::date;
begin
  perform public.require_administration_aal2();
  select * into charge from public.recurring_charges where id=target_charge_id;
  if charge.id is null or not public.can_manage_school(charge.school_id) then raise exception 'finance_scope_denied'; end if;
  select id into transaction_id from public.finance_transactions where school_id=charge.school_id and reference_code='recurring:'||charge.id||':'||month;
  if transaction_id is not null then return transaction_id; end if;
  insert into public.finance_transactions(school_id,direction,category,amount,currency,occurred_on,description,class_id,payment_method,
    allocation_kind,transaction_status,idempotency_key,created_by,source_type,reference_code)
  values(charge.school_id,'expense',charge.category,charge.amount,charge.currency,target_paid_on,charge.title,charge.class_id,'other',
    charge.allocation_kind,'posted',target_idempotency_key,actor,'recurring_charge','recurring:'||charge.id||':'||month)
  returning id into transaction_id;
  if charge.class_id is not null then insert into public.finance_class_allocations(transaction_id,class_id,amount) values(transaction_id,charge.class_id,charge.amount); end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,charge.school_id,'finance.recurring_charge_paid','recurring_charge',charge.id,jsonb_build_object('transaction_id',transaction_id,'month',month));
  return transaction_id;
end; $$;

revoke all on function public.admin_record_manual_finance(uuid,public.finance_direction,text,numeric,date,text,uuid,text,text,uuid),
  public.admin_reverse_manual_finance(uuid,text,uuid),public.admin_save_recurring_charge(uuid,uuid,text,text,numeric,smallint,uuid,text,date,date,boolean),
  public.admin_pay_recurring_charge(uuid,date,date,uuid) from public,anon;
grant execute on function public.admin_record_manual_finance(uuid,public.finance_direction,text,numeric,date,text,uuid,text,text,uuid),
  public.admin_reverse_manual_finance(uuid,text,uuid),public.admin_save_recurring_charge(uuid,uuid,text,text,numeric,smallint,uuid,text,date,date,boolean),
  public.admin_pay_recurring_charge(uuid,date,date,uuid) to authenticated;

commit;
