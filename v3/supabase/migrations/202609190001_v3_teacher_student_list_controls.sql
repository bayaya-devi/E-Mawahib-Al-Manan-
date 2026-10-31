begin;

create table if not exists public.teacher_student_list_preferences (
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete cascade,
  hidden_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table if not exists public.teacher_quick_absences (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  absent_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (teacher_id, student_id, class_id, absent_on)
);

create index if not exists teacher_quick_absences_teacher_student_idx
  on public.teacher_quick_absences(teacher_id, student_id, absent_on desc);

alter table public.teacher_student_list_preferences enable row level security;
alter table public.teacher_quick_absences enable row level security;

drop policy if exists teacher_student_list_preferences_read on public.teacher_student_list_preferences;
create policy teacher_student_list_preferences_read on public.teacher_student_list_preferences
  for select to authenticated using (
    teacher_id = (select auth.uid()) or public.can_manage_student(student_id)
  );

drop policy if exists teacher_quick_absences_read on public.teacher_quick_absences;
create policy teacher_quick_absences_read on public.teacher_quick_absences
  for select to authenticated using (
    teacher_id = (select auth.uid()) or public.can_manage_student(student_id)
  );

revoke all on public.teacher_student_list_preferences, public.teacher_quick_absences from anon;
revoke insert, update, delete, truncate, references, trigger on public.teacher_student_list_preferences, public.teacher_quick_absences from authenticated;
grant select on public.teacher_student_list_preferences, public.teacher_quick_absences to authenticated;

create or replace function public.teacher_set_student_list_visibility(
  target_student_id uuid,
  target_hidden boolean
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not public.has_role('teacher') or not public.teacher_has_student(target_student_id) then
    raise exception 'student_not_accessible';
  end if;

  if target_hidden then
    insert into public.teacher_student_list_preferences(teacher_id, student_id)
    values(actor, target_student_id)
    on conflict (teacher_id, student_id) do update set hidden_at = now(), updated_at = now();
  else
    delete from public.teacher_student_list_preferences
    where teacher_id = actor and student_id = target_student_id;
  end if;
end;
$$;

create or replace function public.teacher_record_student_absence(
  target_student_id uuid,
  target_class_id uuid,
  target_absent_on date default current_date
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); target_school uuid; absence_id uuid; existing_id uuid;
begin
  if actor is null or not public.has_role('teacher') then
    raise exception 'teacher_required';
  end if;
  if target_absent_on is null or target_absent_on > current_date then
    raise exception 'invalid_absence_date';
  end if;
  select c.school_id into target_school
  from public.classes c
  join public.class_teacher_assignments cta on cta.class_id = c.id and cta.teacher_id = actor and cta.status = 'active'
  join public.class_enrollments ce on ce.class_id = c.id and ce.student_id = target_student_id and ce.status = 'active'
  where c.id = target_class_id;
  if target_school is null then
    raise exception 'student_not_accessible';
  end if;

  select ar.id into existing_id
  from public.attendance_records ar
  join public.course_sessions cs on cs.id = ar.session_id
  where ar.student_id = target_student_id
    and ar.status = 'absent'
    and cs.class_id = target_class_id
    and cs.teacher_id = actor
    and ar.recorded_at::date = target_absent_on
  limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.teacher_quick_absences(teacher_id, student_id, class_id, absent_on)
  values(actor, target_student_id, target_class_id, target_absent_on)
  on conflict (teacher_id, student_id, class_id, absent_on) do update set created_at = now()
  returning id into absence_id;

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, target_school, 'teacher.student_absence_recorded', 'student', target_student_id,
    jsonb_build_object('class_id', target_class_id, 'absent_on', target_absent_on));
  return absence_id;
end;
$$;

revoke all on function public.teacher_set_student_list_visibility(uuid, boolean) from public, anon;
revoke all on function public.teacher_record_student_absence(uuid, uuid, date) from public, anon;
grant execute on function public.teacher_set_student_list_visibility(uuid, boolean) to authenticated;
grant execute on function public.teacher_record_student_absence(uuid, uuid, date) to authenticated;

commit;
