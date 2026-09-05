begin;

alter type public.recitation_appreciation add value if not exists 'acceptable';
alter type public.recitation_appreciation add value if not exists 'weak';
alter type public.teacher_request_kind add value if not exists 'late';

alter table public.teacher_session_students alter column attendance set default 'absent';

create table if not exists public.teacher_student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  content text not null check (char_length(trim(content)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists teacher_student_notes_student_idx
  on public.teacher_student_notes(student_id, created_at desc);

alter table public.teacher_student_notes enable row level security;
drop policy if exists teacher_student_notes_read on public.teacher_student_notes;
create policy teacher_student_notes_read on public.teacher_student_notes for select to authenticated using (
  teacher_id = (select auth.uid()) or public.can_manage_student(student_id)
);
revoke all on public.teacher_student_notes from anon;
revoke insert, update, delete, truncate, references, trigger on public.teacher_student_notes from authenticated;
grant select on public.teacher_student_notes to authenticated;

create or replace function public.teacher_add_student_note(target_student_id uuid, target_content text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); note_id uuid;
begin
  if actor is null or not public.has_role('teacher') or not public.teacher_has_student(target_student_id) then
    raise exception 'student_not_accessible';
  end if;
  if char_length(trim(coalesce(target_content, ''))) not between 2 and 1000 then
    raise exception 'invalid_note';
  end if;
  insert into public.teacher_student_notes(student_id, teacher_id, content)
  values(target_student_id, actor, trim(target_content)) returning id into note_id;
  return note_id;
end;
$$;

create or replace function public.teacher_assign_quran_work(
  target_student_ids uuid[], target_surah_number smallint,
  target_verse_from smallint, target_verse_to smallint,
  target_due_at timestamptz, target_note text default null
)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); target_student uuid; target_school uuid; created_count integer := 0; assignment_id uuid;
begin
  if actor is null or not public.has_role('teacher') then raise exception 'teacher_session_required'; end if;
  if coalesce(array_length(target_student_ids, 1), 0) = 0 then raise exception 'students_required'; end if;
  if not exists (select 1 from public.quran_surahs where number = target_surah_number)
    or target_verse_from < 1 or target_verse_to < target_verse_from then raise exception 'invalid_assignment_range'; end if;
  select school_id into target_school from public.school_memberships where user_id = actor and status = 'active' limit 1;
  if target_school is null then raise exception 'active_school_required'; end if;

  foreach target_student in array target_student_ids loop
    if not public.teacher_has_student(target_student) then raise exception 'student_not_accessible'; end if;
    insert into public.assignments(school_id, student_id, teacher_id, title, instructions, surah_number, verse_from, verse_to, due_at)
    values(target_school, target_student, actor, 'واجب القرآن', nullif(trim(target_note), ''), target_surah_number, target_verse_from, target_verse_to, target_due_at)
    returning id into assignment_id;
    insert into public.assignment_submissions(assignment_id, student_id, status)
    values(assignment_id, target_student, 'todo') on conflict do nothing;
    insert into public.user_notifications(user_id, title, body, href, category, entity_type, entity_id, priority)
    values(target_student, 'واجب جديد', 'أرسل الأستاذ واجبا جديدا.', '/student/assignments', 'assignment', 'assignment', assignment_id, 'important');
    created_count := created_count + 1;
  end loop;
  return created_count;
end;
$$;

create or replace function public.teacher_cancel_session(target_run_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); target_course uuid;
begin
  select course_session_id into target_course from public.teacher_session_runs
  where id = target_run_id and teacher_id = actor and status in ('in_progress', 'report_pending') for update;
  if target_course is null then raise exception 'active_session_not_found'; end if;
  update public.teacher_session_runs set status = 'cancelled', ended_at = now() where id = target_run_id;
  delete from public.teacher_session_reports where run_id = target_run_id and status = 'draft';
  update public.course_sessions set status = 'scheduled' where id = target_course and status <> 'cancelled';
end;
$$;

revoke all on function public.teacher_add_student_note(uuid, text) from public, anon;
revoke all on function public.teacher_assign_quran_work(uuid[], smallint, smallint, smallint, timestamptz, text) from public, anon;
revoke all on function public.teacher_cancel_session(uuid) from public, anon;
grant execute on function public.teacher_add_student_note(uuid, text) to authenticated;
grant execute on function public.teacher_assign_quran_work(uuid[], smallint, smallint, smallint, timestamptz, text) to authenticated;
grant execute on function public.teacher_cancel_session(uuid) to authenticated;

insert into public.assignment_submissions(assignment_id, student_id, status)
select a.id, a.student_id, 'todo'::public.assignment_status
from public.assignments a
where a.student_id is not null
on conflict do nothing;

commit;
