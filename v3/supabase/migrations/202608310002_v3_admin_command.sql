begin;

create type public.incident_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.inventory_status as enum ('available', 'assigned', 'maintenance', 'retired');
create type public.finance_direction as enum ('income', 'expense');
create type public.admin_task_status as enum ('open', 'in_progress', 'done', 'dismissed');

create table public.academic_years (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  name text not null, starts_on date not null, ends_on date not null, active boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
  check (ends_on > starts_on), unique (school_id, name)
);
create unique index academic_years_one_active_idx on public.academic_years(school_id) where active;

create table public.school_rooms (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  name text not null, capacity integer check (capacity is null or capacity > 0), location_note text, active boolean not null default true,
  created_at timestamptz not null default now(), unique (school_id, name)
);

alter table public.course_sessions add column room_id uuid references public.school_rooms(id) on delete set null;
alter table public.classes add column academic_year_id uuid references public.academic_years(id) on delete set null;

create table public.student_digital_files (
  student_id uuid primary key references public.student_profiles(user_id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  guardian_phone text, payment_required boolean not null default true, monthly_fee numeric(10,2) check (monthly_fee is null or monthly_fee >= 0),
  identity_document_received boolean not null default false, birth_certificate_received boolean not null default false,
  guardian_identity_received boolean not null default false, medical_or_accessibility_notes text, administrative_notes text,
  updated_by uuid not null references public.profiles(id) on delete restrict, updated_at timestamptz not null default now()
);

create table public.staff_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict, employee_number text,
  job_title text not null, phone text, hired_on date, employment_status public.membership_status not null default 'active',
  updated_at timestamptz not null default now(), unique (school_id, employee_number)
);

create table public.school_incidents (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid references public.student_profiles(user_id) on delete set null,
  teacher_id uuid references public.teacher_profiles(user_id) on delete set null,
  session_report_id uuid references public.teacher_session_reports(id) on delete set null,
  category text not null, severity smallint not null default 1 check (severity between 1 and 4), summary text not null,
  status public.incident_status not null default 'open', occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict, resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status = 'resolved' and resolved_at is not null) or status <> 'resolved')
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  name text not null, category text not null, asset_code text, quantity integer not null default 1 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0), status public.inventory_status not null default 'available',
  room_id uuid references public.school_rooms(id) on delete set null, purchase_date date, purchase_amount numeric(12,2) check (purchase_amount is null or purchase_amount >= 0),
  notes text, updated_at timestamptz not null default now(), unique (school_id, asset_code)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  direction public.finance_direction not null, category text not null, amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'MAD', occurred_on date not null default current_date, description text,
  student_id uuid references public.student_profiles(user_id) on delete set null,
  teacher_id uuid references public.teacher_profiles(user_id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now()
);

create table public.school_documents (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete restrict,
  title text not null, category text not null, storage_path text not null, related_user_id uuid references public.profiles(id) on delete set null,
  visible_to_related_user boolean not null default false, uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.admin_permission_grants (
  user_id uuid not null references public.admin_profiles(user_id) on delete cascade,
  permission text not null check (permission in ('people','academics','attendance','hr','finance','inventory','content','accounts','audit')),
  school_id uuid not null references public.schools(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict, granted_at timestamptz not null default now(),
  primary key (user_id, school_id, permission)
);

create table public.admin_tasks (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
  kind text not null, priority smallint not null default 2 check (priority between 1 and 4), title text not null, reason text not null,
  href text, entity_type text, entity_id text, status public.admin_task_status not null default 'open',
  assigned_to uuid references public.admin_profiles(user_id) on delete set null, due_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index admin_tasks_queue_idx on public.admin_tasks(school_id, status, priority desc, created_at);
create index school_incidents_queue_idx on public.school_incidents(school_id, status, occurred_at desc);
create index finance_transactions_month_idx on public.finance_transactions(school_id, occurred_on desc);

create trigger student_digital_files_updated before update on public.student_digital_files for each row execute function public.set_updated_at();
create trigger staff_profiles_updated before update on public.staff_profiles for each row execute function public.set_updated_at();
create trigger school_incidents_updated before update on public.school_incidents for each row execute function public.set_updated_at();
create trigger inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger admin_tasks_updated before update on public.admin_tasks for each row execute function public.set_updated_at();

alter table public.academic_years enable row level security;
alter table public.school_rooms enable row level security;
alter table public.student_digital_files enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.school_incidents enable row level security;
alter table public.inventory_items enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.school_documents enable row level security;
alter table public.admin_permission_grants enable row level security;
alter table public.admin_tasks enable row level security;

create policy academic_years_admin_read on public.academic_years for select to authenticated using (public.can_manage_school(school_id));
create policy school_rooms_admin_read on public.school_rooms for select to authenticated using (public.can_manage_school(school_id));
create policy student_digital_files_admin_read on public.student_digital_files for select to authenticated using (public.can_manage_school(school_id));
create policy staff_profiles_admin_read on public.staff_profiles for select to authenticated using (public.can_manage_school(school_id));
create policy school_incidents_admin_read on public.school_incidents for select to authenticated using (public.can_manage_school(school_id));
create policy inventory_items_admin_read on public.inventory_items for select to authenticated using (public.can_manage_school(school_id));
create policy finance_transactions_admin_read on public.finance_transactions for select to authenticated using (public.can_manage_school(school_id));
create policy school_documents_admin_read on public.school_documents for select to authenticated using (public.can_manage_school(school_id));
create policy admin_permission_grants_read on public.admin_permission_grants for select to authenticated using (user_id = (select auth.uid()) or public.can_manage_school(school_id));
create policy admin_tasks_admin_read on public.admin_tasks for select to authenticated using (public.can_manage_school(school_id));

revoke all on public.academic_years, public.school_rooms, public.student_digital_files, public.staff_profiles,
  public.school_incidents, public.inventory_items, public.finance_transactions, public.school_documents,
  public.admin_permission_grants, public.admin_tasks from anon;
revoke insert, update, delete, truncate, references, trigger on public.academic_years, public.school_rooms,
  public.student_digital_files, public.staff_profiles, public.school_incidents, public.inventory_items,
  public.finance_transactions, public.school_documents, public.admin_permission_grants, public.admin_tasks from authenticated;
grant select on public.academic_years, public.school_rooms, public.student_digital_files, public.staff_profiles,
  public.school_incidents, public.inventory_items, public.finance_transactions, public.school_documents,
  public.admin_permission_grants, public.admin_tasks to authenticated;

create function public.admin_resolve_task(target_task_id uuid, target_status public.admin_task_status)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare task public.admin_tasks%rowtype;
begin
  select * into task from public.admin_tasks where id = target_task_id;
  if task.id is null or not public.can_manage_school(task.school_id) then raise exception 'task_not_accessible'; end if;
  if target_status not in ('in_progress','done','dismissed') then raise exception 'invalid_task_status'; end if;
  update public.admin_tasks set status = target_status,
    resolved_by = case when target_status in ('done','dismissed') then (select auth.uid()) else null end,
    resolved_at = case when target_status in ('done','dismissed') then now() else null end where id = target_task_id;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values((select auth.uid()), task.school_id, 'admin.task_status_changed', 'admin_task', target_task_id, jsonb_build_object('status', target_status));
end;
$$;

create function public.admin_create_incident(target_student_id uuid, target_teacher_id uuid, target_category text, target_severity smallint, target_summary text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; created uuid;
begin
  select school_id into school from public.school_memberships where user_id = coalesce(target_student_id, target_teacher_id) and status = 'active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'incident_scope_denied'; end if;
  insert into public.school_incidents(school_id, student_id, teacher_id, category, severity, summary, created_by)
  values(school, target_student_id, target_teacher_id, trim(target_category), target_severity, trim(target_summary), (select auth.uid())) returning id into created;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id)
  values((select auth.uid()), school, 'incident.created', 'school_incident', created);
  return created;
end;
$$;

create function public.admin_create_command_record(target_kind text, payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; created uuid; actor uuid := (select auth.uid());
begin
  select school_id into school from public.school_memberships where user_id = actor and status = 'active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'command_scope_denied'; end if;
  if target_kind = 'academic_year' then
    if coalesce((payload->>'active')::boolean, false) then update public.academic_years set active = false where school_id = school; end if;
    insert into public.academic_years(school_id, name, starts_on, ends_on, active, created_by)
    values(school, trim(payload->>'name'), (payload->>'starts_on')::date, (payload->>'ends_on')::date, coalesce((payload->>'active')::boolean, false), actor) returning id into created;
  elsif target_kind = 'class' then
    if nullif(payload->>'academic_year_id', '') is not null and not exists (select 1 from public.academic_years where id = (payload->>'academic_year_id')::uuid and school_id = school) then raise exception 'academic_year_scope_denied'; end if;
    insert into public.classes(school_id, name, level, capacity, academic_year_id)
    values(school, trim(payload->>'name'), nullif(trim(payload->>'level'), ''), nullif(payload->>'capacity', '')::integer, nullif(payload->>'academic_year_id', '')::uuid) returning id into created;
  elsif target_kind = 'room' then
    insert into public.school_rooms(school_id, name, capacity, location_note)
    values(school, trim(payload->>'name'), nullif(payload->>'capacity', '')::integer, nullif(trim(payload->>'note'), '')) returning id into created;
  elsif target_kind = 'inventory' then
    insert into public.inventory_items(school_id, name, category, quantity, minimum_quantity, asset_code)
    values(school, trim(payload->>'name'), trim(payload->>'category'), coalesce((payload->>'quantity')::integer, 1), coalesce((payload->>'minimum')::integer, 0), nullif(trim(payload->>'code'), '')) returning id into created;
  elsif target_kind = 'finance' then
    insert into public.finance_transactions(school_id, direction, category, amount, occurred_on, description, created_by)
    values(school, (payload->>'direction')::public.finance_direction, trim(payload->>'category'), (payload->>'amount')::numeric, coalesce((payload->>'date')::date, current_date), nullif(trim(payload->>'description'), ''), actor) returning id into created;
  elsif target_kind = 'event' then
    insert into public.school_events(school_id, title, description, starts_at, ends_at, created_by)
    values(school, trim(payload->>'title'), nullif(trim(payload->>'description'), ''), (payload->>'starts_at')::timestamptz, nullif(payload->>'ends_at', '')::timestamptz, actor) returning id into created;
  elsif target_kind = 'announcement' then
    insert into public.school_announcements(school_id, title, body, audience, expires_at, created_by)
    values(school, trim(payload->>'title'), trim(payload->>'body'), coalesce(payload->>'audience', 'all'), nullif(payload->>'expires_at', '')::timestamptz, actor) returning id into created;
  elsif target_kind = 'salary' then
    if not exists (select 1 from public.school_memberships where school_id = school and user_id = (payload->>'teacher_id')::uuid and status = 'active') then raise exception 'teacher_scope_denied'; end if;
    insert into public.teacher_salary_records(school_id, teacher_id, period_month, gross_amount, deductions)
    values(school, (payload->>'teacher_id')::uuid, date_trunc('month', (payload->>'period_month')::date)::date, (payload->>'gross')::numeric, coalesce((payload->>'deductions')::numeric, 0)) returning id into created;
  else raise exception 'unsupported_command_record';
  end if;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'command.record_created', target_kind, created, jsonb_build_object('kind', target_kind));
  return created;
end;
$$;

revoke all on function public.admin_resolve_task(uuid, public.admin_task_status) from public, anon;
revoke all on function public.admin_create_incident(uuid, uuid, text, smallint, text) from public, anon;
revoke all on function public.admin_create_command_record(text, jsonb) from public, anon;
grant execute on function public.admin_resolve_task(uuid, public.admin_task_status) to authenticated;
grant execute on function public.admin_create_incident(uuid, uuid, text, smallint, text) to authenticated;
grant execute on function public.admin_create_command_record(text, jsonb) to authenticated;

commit;
