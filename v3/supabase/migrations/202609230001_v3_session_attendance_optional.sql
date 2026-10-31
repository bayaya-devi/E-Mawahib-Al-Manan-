begin;

-- The guided session no longer asks the teacher to record attendance.
-- Keep the historical attendance values, but distinguish them from new,
-- deliberately unrecorded session rows so reports do not invent absences.
alter table public.teacher_session_students
  add column if not exists attendance_recorded boolean not null default false;

update public.teacher_session_students
set attendance_recorded = true
where attendance_recorded = false;

create or replace function public.teacher_save_attendance(target_run_id uuid, attendance_rows jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); row_data jsonb; target_student uuid; target_status public.attendance_status; late_minutes smallint; target_class uuid;
begin
  select class_id into target_class from public.teacher_session_runs where id = target_run_id and teacher_id = teacher and status = 'in_progress';
  if target_class is null then raise exception 'active_session_not_found'; end if;
  for row_data in select value from jsonb_array_elements(attendance_rows) loop
    target_student := (row_data->>'student_id')::uuid;
    target_status := (row_data->>'status')::public.attendance_status;
    late_minutes := greatest(0, least(600, coalesce((row_data->>'minutes_late')::smallint, 0)));
    if not exists (select 1 from public.class_enrollments where class_id = target_class and student_id = target_student and status = 'active') then raise exception 'student_not_in_session_class'; end if;
    update public.teacher_session_students
    set attendance = target_status, attendance_recorded = true,
        minutes_late = case when target_status = 'late' then late_minutes else 0 end, updated_at = now()
    where run_id = target_run_id and student_id = target_student;
    insert into public.attendance_records(session_id, student_id, status, minutes_late, recorded_by)
    select r.course_session_id, target_student, target_status, case when target_status = 'late' then late_minutes else 0 end, teacher
    from public.teacher_session_runs r where r.id = target_run_id
    on conflict (session_id, student_id) do update set status = excluded.status, minutes_late = excluded.minutes_late,
      recorded_by = excluded.recorded_by, recorded_at = now();
  end loop;
end;
$$;

create or replace function public.teacher_open_session_report(target_run_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); target_class uuid; report uuid;
begin
  select class_id into target_class from public.teacher_session_runs where id = target_run_id and teacher_id = teacher and status = 'in_progress';
  if target_class is null then raise exception 'active_session_not_found'; end if;
  update public.teacher_session_runs set status = 'report_pending' where id = target_run_id;
  insert into public.teacher_session_reports(run_id, teacher_id, class_id, present_count, absent_count, late_count)
  select target_run_id, teacher, target_class,
    count(*) filter (where attendance_recorded and attendance = 'present'),
    count(*) filter (where attendance_recorded and attendance = 'absent'),
    count(*) filter (where attendance_recorded and attendance = 'late')
  from public.teacher_session_students where run_id = target_run_id returning id into report;
  return report;
end;
$$;

commit;
