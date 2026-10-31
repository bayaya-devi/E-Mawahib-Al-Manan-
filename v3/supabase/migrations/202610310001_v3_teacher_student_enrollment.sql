begin;

create table public.teacher_student_enrollment_dossiers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  requested_by uuid not null references public.teacher_profiles(user_id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'unspecified')),
  guardian_name text,
  guardian_phone text,
  level text,
  enrollment_date date not null default current_date,
  status text not null default 'submitted' check (status in ('submitted', 'enrolled', 'rejected', 'cancelled')),
  linked_student_id uuid references public.student_profiles(user_id) on delete restrict,
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_student_dossier_guardian_name_valid check (
    guardian_name is null or char_length(trim(guardian_name)) between 2 and 160
  ),
  constraint teacher_student_dossier_guardian_phone_valid check (
    guardian_phone is null or char_length(trim(guardian_phone)) between 6 and 32
  ),
  constraint teacher_student_dossier_resolution_consistency check (
    (status = 'submitted' and resolved_at is null and resolved_by is null)
    or (status <> 'submitted' and resolved_at is not null)
  )
);

create index teacher_student_enrollment_dossiers_teacher_idx
  on public.teacher_student_enrollment_dossiers(requested_by, created_at desc);
create index teacher_student_enrollment_dossiers_admin_idx
  on public.teacher_student_enrollment_dossiers(school_id, status, created_at desc);
create unique index teacher_student_enrollment_dossiers_pending_identity_idx
  on public.teacher_student_enrollment_dossiers(
    class_id,
    lower(trim(first_name)),
    lower(trim(last_name)),
    coalesce(date_of_birth, date '0001-01-01')
  ) where status = 'submitted';

create trigger teacher_student_enrollment_dossiers_updated
before update on public.teacher_student_enrollment_dossiers
for each row execute function public.set_updated_at();

alter table public.teacher_student_enrollment_dossiers enable row level security;
create policy teacher_student_enrollment_dossiers_read on public.teacher_student_enrollment_dossiers
for select to authenticated using (
  requested_by = (select auth.uid()) or public.can_manage_school(school_id)
);

revoke all on public.teacher_student_enrollment_dossiers from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.teacher_student_enrollment_dossiers from authenticated;
grant select on public.teacher_student_enrollment_dossiers to authenticated;

create function public.teacher_search_enrollment_candidates(
  target_class_id uuid,
  target_query text
)
returns table (
  student_id uuid,
  display_name text,
  student_number text,
  active_class_id uuid,
  active_class_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_school uuid;
  normalized_query text := trim(coalesce(target_query, ''));
begin
  if actor is null or not public.has_role('teacher') or not public.teacher_owns_class(target_class_id) then
    raise exception 'class_not_assigned';
  end if;
  if char_length(normalized_query) < 2 then raise exception 'search_query_too_short'; end if;
  select school_id into target_school from public.classes where id = target_class_id and status = 'active';
  if target_school is null then raise exception 'class_not_active'; end if;

  return query
  select p.id, p.display_name, sp.student_number, ce.class_id, c.name
  from public.profiles p
  join public.student_profiles sp on sp.user_id = p.id
  join public.school_memberships sm on sm.user_id = p.id and sm.school_id = target_school and sm.status = 'active'
  left join public.class_enrollments ce on ce.student_id = p.id and ce.status = 'active'
  left join public.classes c on c.id = ce.class_id
  where p.status = 'active'
    and (
      position(lower(normalized_query) in lower(p.display_name)) > 0
      or position(lower(normalized_query) in lower(coalesce(sp.student_number, ''))) > 0
    )
  order by p.display_name
  limit 20;
end;
$$;

create function public.teacher_enroll_existing_student(
  target_class_id uuid,
  target_student_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_school uuid;
  existing_enrollment public.class_enrollments%rowtype;
  enrollment_id uuid;
begin
  if actor is null or not public.has_role('teacher') or not public.teacher_owns_class(target_class_id) then
    raise exception 'class_not_assigned';
  end if;
  select school_id into target_school from public.classes
  where id = target_class_id and status = 'active' for update;
  if target_school is null then raise exception 'class_not_active'; end if;
  if not exists (
    select 1 from public.student_profiles sp
    join public.profiles p on p.id = sp.user_id and p.status = 'active'
    join public.school_memberships sm on sm.user_id = sp.user_id
      and sm.school_id = target_school and sm.status = 'active'
    where sp.user_id = target_student_id
  ) then raise exception 'student_not_in_school'; end if;

  select * into existing_enrollment from public.class_enrollments
  where student_id = target_student_id and status = 'active' for update;
  if existing_enrollment.id is not null then
    if existing_enrollment.class_id = target_class_id then return existing_enrollment.id; end if;
    raise exception 'student_already_enrolled';
  end if;

  insert into public.class_enrollments(class_id, student_id, enrolled_at, created_by)
  values(target_class_id, target_student_id, now(), actor)
  returning id into enrollment_id;

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, target_school, 'teacher.student.enrolled', 'class_enrollment', enrollment_id::text,
    jsonb_build_object('class_id', target_class_id, 'student_id', target_student_id));
  return enrollment_id;
end;
$$;

create function public.teacher_submit_student_enrollment_dossier(
  target_class_id uuid,
  target_first_name text,
  target_last_name text,
  target_date_of_birth date default null,
  target_gender text default null,
  target_guardian_name text default null,
  target_guardian_phone text default null,
  target_level text default null,
  target_enrollment_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_school uuid;
  dossier_id uuid;
  clean_first_name text := trim(coalesce(target_first_name, ''));
  clean_last_name text := trim(coalesce(target_last_name, ''));
  class_capacity integer;
  occupied integer;
  pending integer;
begin
  if actor is null or not public.has_role('teacher') or not public.teacher_owns_class(target_class_id) then
    raise exception 'class_not_assigned';
  end if;
  if char_length(clean_first_name) not between 1 and 80 or char_length(clean_last_name) not between 1 and 80 then
    raise exception 'invalid_student_name';
  end if;
  if target_date_of_birth is not null and target_date_of_birth > current_date then raise exception 'invalid_birth_date'; end if;
  if target_gender is not null and target_gender not in ('male', 'female', 'unspecified') then raise exception 'invalid_gender'; end if;
  if target_enrollment_date is null then raise exception 'invalid_enrollment_date'; end if;
  if nullif(trim(coalesce(target_guardian_name, '')), '') is not null and char_length(trim(target_guardian_name)) not between 2 and 160 then raise exception 'invalid_guardian_name'; end if;
  if nullif(trim(coalesce(target_guardian_phone, '')), '') is not null and char_length(trim(target_guardian_phone)) not between 6 and 32 then raise exception 'invalid_guardian_phone'; end if;

  select school_id, capacity into target_school, class_capacity
  from public.classes where id = target_class_id and status = 'active' for update;
  if target_school is null then raise exception 'class_not_active'; end if;

  if exists (
    select 1 from public.profiles p
    join public.student_profiles sp on sp.user_id = p.id
    join public.school_memberships sm on sm.user_id = p.id and sm.school_id = target_school and sm.status = 'active'
    where lower(trim(coalesce(p.first_name, ''))) = lower(clean_first_name)
      and lower(trim(coalesce(p.last_name, ''))) = lower(clean_last_name)
      and sp.date_of_birth is not distinct from target_date_of_birth
  ) then raise exception 'existing_student_match'; end if;

  if class_capacity is not null then
    select count(*) into occupied from public.class_enrollments where class_id = target_class_id and status = 'active';
    select count(*) into pending from public.teacher_student_enrollment_dossiers where class_id = target_class_id and status = 'submitted';
    if occupied + pending >= class_capacity then raise exception 'class_capacity_exceeded'; end if;
  end if;

  insert into public.teacher_student_enrollment_dossiers(
    school_id, class_id, requested_by, first_name, last_name, date_of_birth, gender,
    guardian_name, guardian_phone, level, enrollment_date
  ) values (
    target_school, target_class_id, actor, clean_first_name, clean_last_name,
    target_date_of_birth, target_gender,
    nullif(trim(coalesce(target_guardian_name, '')), ''),
    nullif(trim(coalesce(target_guardian_phone, '')), ''),
    nullif(trim(coalesce(target_level, '')), ''), target_enrollment_date
  ) returning id into dossier_id;

  insert into public.user_notifications(user_id, title, body, href)
  select distinct ur.user_id, 'طلب تسجيل طالب', clean_first_name || ' ' || clean_last_name, '/admin/students'
  from public.user_roles ur
  join public.school_memberships sm on sm.user_id = ur.user_id
    and sm.school_id = target_school and sm.status = 'active'
  where ur.role in ('admin', 'direction');

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, target_school, 'teacher.student_dossier.submitted', 'teacher_student_enrollment_dossier', dossier_id::text,
    jsonb_build_object('class_id', target_class_id));
  return dossier_id;
exception
  when unique_violation then raise exception 'duplicate_enrollment_dossier';
end;
$$;

revoke all on function public.teacher_search_enrollment_candidates(uuid, text) from public, anon;
revoke all on function public.teacher_enroll_existing_student(uuid, uuid) from public, anon;
revoke all on function public.teacher_submit_student_enrollment_dossier(uuid, text, text, date, text, text, text, text, date) from public, anon;
grant execute on function public.teacher_search_enrollment_candidates(uuid, text) to authenticated;
grant execute on function public.teacher_enroll_existing_student(uuid, uuid) to authenticated;
grant execute on function public.teacher_submit_student_enrollment_dossier(uuid, text, text, date, text, text, text, text, date) to authenticated;

commit;
