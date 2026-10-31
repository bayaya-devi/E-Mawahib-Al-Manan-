begin;

alter table public.teacher_profiles
  add column if not exists gender text check (gender is null or gender in ('male','female','unspecified')),
  add column if not exists email text,
  add column if not exists monthly_salary numeric(12,2) check (monthly_salary is null or monthly_salary >= 0);

alter table public.student_digital_files
  add column if not exists guardian_name text,
  add column if not exists guardian_email text,
  add column if not exists guardian_identity_number text,
  add column if not exists secondary_contact text;

alter table public.classes
  add column if not exists schedule_days text[] not null default '{}',
  add column if not exists schedule_text text;

alter table public.finance_transactions
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists reference_code text;

create unique index if not exists finance_transactions_source_unique
  on public.finance_transactions(school_id, source_type, source_id)
  where source_id is not null;
create unique index if not exists finance_transactions_reference_unique
  on public.finance_transactions(school_id, reference_code)
  where reference_code is not null;

create table if not exists public.student_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  expected_amount numeric(12,2) not null check (expected_amount >= 0),
  received_amount numeric(12,2) not null check (received_amount >= 0),
  currency char(3) not null default 'MAD' check (currency = 'MAD'),
  paid_on date not null default current_date,
  status text not null check (status in ('paid','partial','exempt','cancelled')),
  note text,
  finance_transaction_id uuid unique references public.finance_transactions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, period_month)
);

alter table public.teacher_salary_records
  add column if not exists finance_transaction_id uuid unique references public.finance_transactions(id) on delete restrict;

create table if not exists public.admin_school_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  finance_alert_threshold numeric(12,2) not null default 0,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

do $$ begin
  if to_regclass('storage.buckets') is not null then
    execute $bucket$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('public-media','public-media',true,104857600,array['video/mp4','video/webm','image/jpeg','image/png','image/webp','image/avif'])
      on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$bucket$;
  end if;
end $$;

drop trigger if exists student_payments_updated on public.student_payments;
create trigger student_payments_updated before update on public.student_payments for each row execute function public.set_updated_at();
drop trigger if exists admin_school_settings_updated on public.admin_school_settings;
create trigger admin_school_settings_updated before update on public.admin_school_settings for each row execute function public.set_updated_at();

alter table public.student_payments enable row level security;
alter table public.admin_school_settings enable row level security;
drop policy if exists student_payments_admin_read on public.student_payments;
create policy student_payments_admin_read on public.student_payments for select to authenticated
  using (student_id = (select auth.uid()) or public.parent_has_student(student_id) or public.can_manage_school(school_id));
drop policy if exists admin_school_settings_admin_read on public.admin_school_settings;
create policy admin_school_settings_admin_read on public.admin_school_settings for select to authenticated
  using (public.can_manage_school(school_id));
revoke all on public.student_payments, public.admin_school_settings from anon;
revoke insert, update, delete, truncate, references, trigger on public.student_payments, public.admin_school_settings from authenticated;
grant select on public.student_payments, public.admin_school_settings to authenticated;

create or replace function public.admin_update_person(target_user_id uuid, payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); target_role public.app_role;
begin
  perform public.require_administration_aal2();
  select sm.school_id into school from public.school_memberships sm where sm.user_id = target_user_id and sm.status = 'active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'person_scope_denied'; end if;
  update public.profiles set
    first_name = coalesce(nullif(trim(payload->>'first_name'), ''), first_name),
    last_name = coalesce(nullif(trim(payload->>'last_name'), ''), last_name),
    display_name = trim(concat(coalesce(nullif(trim(payload->>'first_name'), ''), first_name), ' ', coalesce(nullif(trim(payload->>'last_name'), ''), last_name)))
  where id = target_user_id;
  select role into target_role from public.user_roles where user_id = target_user_id and role in ('student','teacher') order by role limit 1;
  if target_role = 'student' then
    update public.student_profiles set date_of_birth = nullif(payload->>'date_of_birth','')::date,
      gender = coalesce(nullif(payload->>'gender',''), gender), accessibility_notes = nullif(trim(payload->>'accessibility_notes'),'')
    where user_id = target_user_id;
    insert into public.student_digital_files(student_id, school_id, guardian_name, guardian_phone, guardian_email, secondary_contact,
      monthly_fee, payment_required, identity_document_received, birth_certificate_received, guardian_identity_received,
      medical_or_accessibility_notes, administrative_notes, updated_by)
    values(target_user_id, school, nullif(trim(payload->>'guardian_name'),''), nullif(trim(payload->>'guardian_phone'),''),
      nullif(trim(payload->>'guardian_email'),''), nullif(trim(payload->>'secondary_contact'),''),
      coalesce((payload->>'monthly_fee')::numeric,0), coalesce((payload->>'monthly_fee')::numeric,0) > 0,
      coalesce((payload->>'identity_document_received')::boolean,false), coalesce((payload->>'birth_certificate_received')::boolean,false),
      coalesce((payload->>'guardian_identity_received')::boolean,false), nullif(trim(payload->>'accessibility_notes'),''),
      nullif(trim(payload->>'administrative_notes'),''), actor)
    on conflict(student_id) do update set guardian_name=excluded.guardian_name, guardian_phone=excluded.guardian_phone,
      guardian_email=excluded.guardian_email, secondary_contact=excluded.secondary_contact, monthly_fee=excluded.monthly_fee,
      payment_required=excluded.payment_required, identity_document_received=excluded.identity_document_received,
      birth_certificate_received=excluded.birth_certificate_received, guardian_identity_received=excluded.guardian_identity_received,
      medical_or_accessibility_notes=excluded.medical_or_accessibility_notes, administrative_notes=excluded.administrative_notes,
      updated_by=actor;
  elsif target_role = 'teacher' then
    update public.teacher_profiles set phone=nullif(trim(payload->>'phone'),''), email=nullif(trim(payload->>'email'),''),
      gender=coalesce(nullif(payload->>'gender',''),gender), monthly_salary=coalesce((payload->>'monthly_salary')::numeric, monthly_salary)
    where user_id=target_user_id;
  end if;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'admin.person_updated', 'profile', target_user_id, jsonb_build_object('role',target_role));
end; $$;

create or replace function public.admin_set_student_relations(target_student_id uuid, target_class_id uuid, target_teacher_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); teacher uuid;
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=target_student_id and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'student_scope_denied'; end if;
  if not exists(select 1 from public.classes where id=target_class_id and school_id=school) then raise exception 'class_scope_denied'; end if;
  update public.class_enrollments set status='withdrawn', ended_at=now() where student_id=target_student_id and status='active' and class_id<>target_class_id;
  insert into public.class_enrollments(class_id,student_id,status,ended_at,created_by) values(target_class_id,target_student_id,'active',null,actor)
    on conflict(class_id,student_id) do update set status='active',ended_at=null;
  foreach teacher in array coalesce(target_teacher_ids,'{}') loop
    if not exists(select 1 from public.class_teacher_assignments where class_id=target_class_id and teacher_id=teacher and status='active') then
      insert into public.class_teacher_assignments(class_id,teacher_id,assignment_kind,status,created_by) values(target_class_id,teacher,'assistant','active',actor);
    end if;
  end loop;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'admin.student_relations_updated','student',target_student_id,jsonb_build_object('class_id',target_class_id,'teachers',target_teacher_ids));
end; $$;

create or replace function public.admin_set_teacher_classes(target_teacher_id uuid, target_class_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); target_class uuid;
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=target_teacher_id and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'teacher_scope_denied'; end if;
  if exists(select 1 from unnest(coalesce(target_class_ids,'{}')) requested(id) left join public.classes c on c.id=requested.id and c.school_id=school where c.id is null) then raise exception 'class_scope_denied'; end if;
  update public.class_teacher_assignments set status='archived', ended_at=now()
    where teacher_id=target_teacher_id and status='active' and not (class_id=any(coalesce(target_class_ids,'{}')));
  foreach target_class in array coalesce(target_class_ids,'{}') loop
    if not exists(select 1 from public.class_teacher_assignments where class_id=target_class and teacher_id=target_teacher_id and status='active') then
      insert into public.class_teacher_assignments(class_id,teacher_id,assignment_kind,status,created_by)
      values(target_class,target_teacher_id,'primary','active',actor);
    end if;
  end loop;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'admin.teacher_classes_updated','teacher',target_teacher_id,jsonb_build_object('classes',target_class_ids));
end; $$;

create or replace function public.admin_record_student_payment(target_student_id uuid, target_period_month date, target_amount numeric, target_paid_on date, target_note text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); expected numeric; payment uuid; transaction_id uuid; month date := date_trunc('month',target_period_month)::date;
begin
  perform public.require_administration_aal2();
  select school_id, coalesce(monthly_fee,0) into school, expected from public.student_digital_files where student_id=target_student_id;
  if school is null or not public.can_manage_school(school) then raise exception 'student_scope_denied'; end if;
  if target_amount < 0 then raise exception 'invalid_amount'; end if;
  insert into public.student_payments(school_id,student_id,period_month,expected_amount,received_amount,paid_on,status,note,created_by)
  values(school,target_student_id,month,expected,target_amount,target_paid_on,
    case when expected=0 then 'exempt' when target_amount>=expected then 'paid' else 'partial' end,target_note,actor)
  on conflict(student_id,period_month) do update set expected_amount=excluded.expected_amount,received_amount=excluded.received_amount,
    paid_on=excluded.paid_on,status=excluded.status,note=excluded.note,updated_at=now() returning id,finance_transaction_id into payment,transaction_id;
  if target_amount > 0 then
    insert into public.finance_transactions(school_id,direction,category,amount,currency,occurred_on,description,student_id,created_by,source_type,source_id,reference_code)
    values(school,'income','student_payment',target_amount,'MAD',target_paid_on,target_note,target_student_id,actor,'student_payment',payment,'student:'||payment)
    on conflict(school_id,source_type,source_id) where source_id is not null do update set amount=excluded.amount,occurred_on=excluded.occurred_on,description=excluded.description
    returning id into transaction_id;
    update public.student_payments set finance_transaction_id=transaction_id where id=payment;
  elsif transaction_id is not null then
    delete from public.finance_transactions where id=transaction_id;
    update public.student_payments set finance_transaction_id=null where id=payment;
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'finance.student_payment_recorded','student_payment',payment,jsonb_build_object('amount',target_amount,'month',month));
  return payment;
end; $$;

create or replace function public.admin_record_teacher_salary(target_teacher_id uuid, target_period_month date, target_amount numeric, target_paid_on date, target_note text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); salary uuid; transaction_id uuid; month date := date_trunc('month',target_period_month)::date;
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=target_teacher_id and status='active' limit 1;
  if school is null or not public.can_manage_school(school) or target_amount < 0 then raise exception 'salary_scope_or_amount_denied'; end if;
  insert into public.teacher_salary_records(school_id,teacher_id,period_month,gross_amount,deductions,status,paid_at,note)
  values(school,target_teacher_id,month,target_amount,0,'paid',target_paid_on::timestamptz,target_note)
  on conflict(teacher_id,period_month) do update set gross_amount=excluded.gross_amount,deductions=0,status='paid',paid_at=excluded.paid_at,note=excluded.note,updated_at=now()
  returning id,finance_transaction_id into salary,transaction_id;
  if target_amount > 0 then
    insert into public.finance_transactions(school_id,direction,category,amount,currency,occurred_on,description,teacher_id,created_by,source_type,source_id,reference_code)
    values(school,'expense','teacher_salary',target_amount,'MAD',target_paid_on,target_note,target_teacher_id,actor,'teacher_salary',salary,'salary:'||salary)
    on conflict(school_id,source_type,source_id) where source_id is not null do update set amount=excluded.amount,occurred_on=excluded.occurred_on,description=excluded.description
    returning id into transaction_id;
    update public.teacher_salary_records set finance_transaction_id=transaction_id where id=salary;
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'finance.teacher_salary_recorded','teacher_salary',salary,jsonb_build_object('amount',target_amount,'month',month));
  return salary;
end; $$;

create or replace function public.admin_set_finance_threshold(target_school_id uuid, target_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_administration_aal2();
  if target_amount < 0 or not public.can_manage_school(target_school_id) then raise exception 'invalid_threshold'; end if;
  insert into public.admin_school_settings(school_id,finance_alert_threshold,updated_by) values(target_school_id,target_amount,(select auth.uid()))
  on conflict(school_id) do update set finance_alert_threshold=excluded.finance_alert_threshold,updated_by=(select auth.uid());
end; $$;

create or replace function public.admin_update_login_alias(target_user_id uuid, target_login_alias text, target_password_reset boolean default false)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); alias text := lower(trim(target_login_alias));
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=target_user_id and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'person_scope_denied'; end if;
  if alias <> '' then
    if char_length(alias) not between 3 and 80 then raise exception 'invalid_alias'; end if;
    update private.login_aliases set normalized_alias=alias where user_id=target_user_id;
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'admin.credentials_reset','profile',target_user_id,jsonb_build_object('login_changed',alias<>'','password_reset',target_password_reset));
end; $$;

revoke all on function public.admin_update_person(uuid,jsonb), public.admin_set_student_relations(uuid,uuid,uuid[]), public.admin_set_teacher_classes(uuid,uuid[]),
  public.admin_record_student_payment(uuid,date,numeric,date,text), public.admin_record_teacher_salary(uuid,date,numeric,date,text),
  public.admin_set_finance_threshold(uuid,numeric), public.admin_update_login_alias(uuid,text,boolean) from public,anon;
grant execute on function public.admin_update_person(uuid,jsonb), public.admin_set_student_relations(uuid,uuid,uuid[]), public.admin_set_teacher_classes(uuid,uuid[]),
  public.admin_record_student_payment(uuid,date,numeric,date,text), public.admin_record_teacher_salary(uuid,date,numeric,date,text),
  public.admin_set_finance_threshold(uuid,numeric), public.admin_update_login_alias(uuid,text,boolean) to authenticated;

commit;
