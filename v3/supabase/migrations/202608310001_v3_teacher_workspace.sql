begin;

create type public.teacher_session_status as enum ('in_progress', 'report_pending', 'completed', 'cancelled');
create type public.recitation_appreciation as enum ('excellent', 'very_good', 'good', 'needs_review', 'insufficient');
create type public.session_program_status as enum ('completed', 'partial', 'not_completed');
create type public.session_behavior_status as enum ('excellent', 'good', 'mixed', 'difficult');
create type public.equipment_status as enum ('ready', 'missing', 'damaged');
create type public.teacher_request_kind as enum ('absence', 'leave', 'salary_problem', 'equipment', 'schedule', 'general');
create type public.workflow_status as enum ('draft', 'submitted', 'seen', 'in_review', 'approved', 'rejected', 'resolved', 'cancelled');
create type public.salary_status as enum ('pending', 'paid', 'issue_reported', 'resolved');

create table public.teacher_session_runs (
  id uuid primary key default gen_random_uuid(),
  course_session_id uuid not null references public.course_sessions(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  status public.teacher_session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status in ('in_progress', 'report_pending') and ended_at is null) or (status in ('completed', 'cancelled') and ended_at is not null))
);
create unique index teacher_session_one_open_idx on public.teacher_session_runs(teacher_id) where status in ('in_progress', 'report_pending');
create unique index teacher_session_course_once_idx on public.teacher_session_runs(course_session_id) where status <> 'cancelled';
create index teacher_session_history_idx on public.teacher_session_runs(teacher_id, started_at desc);

create table public.teacher_session_students (
  run_id uuid not null references public.teacher_session_runs(id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  attendance public.attendance_status not null default 'present',
  minutes_late smallint not null default 0 check (minutes_late between 0 and 600),
  processed_at timestamptz,
  behavior public.session_behavior_status,
  difficulty_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(difficulty_flags) = 'array'),
  teacher_note text,
  updated_at timestamptz not null default now(),
  primary key (run_id, student_id)
);

create table public.teacher_recitations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.teacher_session_runs(id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_from smallint not null check (verse_from > 0),
  verse_to smallint not null check (verse_to >= verse_from),
  appreciation public.recitation_appreciation not null,
  comment text,
  recorded_by uuid not null references public.teacher_profiles(user_id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index teacher_recitations_student_idx on public.teacher_recitations(student_id, recorded_at desc);

create table public.teacher_session_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.teacher_session_runs(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  status public.workflow_status not null default 'draft' check (status in ('draft', 'submitted', 'seen', 'resolved')),
  program_status public.session_program_status,
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  late_count integer not null default 0 check (late_count >= 0),
  behavior public.session_behavior_status,
  difficulty_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(difficulty_flags) = 'array'),
  follow_up_students jsonb not null default '[]'::jsonb check (jsonb_typeof(follow_up_students) = 'array'),
  incident boolean not null default false,
  incident_summary text,
  equipment public.equipment_status,
  equipment_details text,
  optional_note text,
  submitted_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not incident or char_length(trim(incident_summary)) >= 3)
);

create table public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null,
  body text not null,
  related_request_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_messages_recipient_idx on public.staff_messages(recipient_id, created_at desc);

create table public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  kind public.teacher_request_kind not null,
  status public.workflow_status not null default 'submitted' check (status <> 'draft'),
  title text not null,
  details text,
  starts_on date,
  ends_on date,
  admin_response text,
  resolved_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
alter table public.staff_messages add constraint staff_messages_request_fk foreign key (related_request_id) references public.teacher_requests(id) on delete set null;
create index teacher_requests_teacher_idx on public.teacher_requests(teacher_id, submitted_at desc);

create table public.teacher_salary_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  deductions numeric(12,2) not null default 0 check (deductions >= 0),
  net_amount numeric(12,2) generated always as (gross_amount - deductions) stored,
  currency char(3) not null default 'MAD',
  status public.salary_status not null default 'pending',
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, period_month),
  check (deductions <= gross_amount),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create table public.teacher_documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  title text not null,
  category text not null check (category in ('contract', 'payslip', 'certificate', 'policy', 'other')),
  storage_path text not null,
  visible_from timestamptz not null default now(),
  expires_at timestamptz,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create trigger teacher_session_reports_set_updated_at before update on public.teacher_session_reports for each row execute function public.set_updated_at();
create trigger teacher_requests_set_updated_at before update on public.teacher_requests for each row execute function public.set_updated_at();
create trigger teacher_salary_records_set_updated_at before update on public.teacher_salary_records for each row execute function public.set_updated_at();

create function public.teacher_owns_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_role('teacher') and exists (
    select 1 from public.class_teacher_assignments cta
    where cta.class_id = target_class_id and cta.teacher_id = (select auth.uid()) and cta.status = 'active'
  );
$$;

revoke all on function public.teacher_owns_class(uuid) from public, anon;
grant execute on function public.teacher_owns_class(uuid) to authenticated;

alter table public.teacher_session_runs enable row level security;
alter table public.teacher_session_students enable row level security;
alter table public.teacher_recitations enable row level security;
alter table public.teacher_session_reports enable row level security;
alter table public.staff_messages enable row level security;
alter table public.teacher_requests enable row level security;
alter table public.teacher_salary_records enable row level security;
alter table public.teacher_documents enable row level security;

create policy teacher_session_runs_read on public.teacher_session_runs for select to authenticated using (
  teacher_id = (select auth.uid()) or exists (select 1 from public.classes c where c.id = class_id and public.can_manage_school(c.school_id))
);
create policy teacher_session_students_read on public.teacher_session_students for select to authenticated using (
  exists (select 1 from public.teacher_session_runs r where r.id = run_id and (r.teacher_id = (select auth.uid()) or public.can_manage_student(student_id)))
);
create policy teacher_recitations_read on public.teacher_recitations for select to authenticated using (public.can_access_student(student_id));
create policy teacher_session_reports_read on public.teacher_session_reports for select to authenticated using (
  teacher_id = (select auth.uid()) or exists (select 1 from public.classes c where c.id = class_id and public.can_manage_school(c.school_id))
);
create policy staff_messages_read on public.staff_messages for select to authenticated using (
  sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or public.can_manage_school(school_id)
);
create policy teacher_requests_read on public.teacher_requests for select to authenticated using (
  teacher_id = (select auth.uid()) or public.can_manage_school(school_id)
);
create policy teacher_salary_records_read on public.teacher_salary_records for select to authenticated using (
  teacher_id = (select auth.uid()) or public.can_manage_school(school_id)
);
create policy teacher_documents_read on public.teacher_documents for select to authenticated using (
  teacher_id = (select auth.uid()) or public.can_manage_user(teacher_id)
);

revoke all on public.teacher_session_runs, public.teacher_session_students, public.teacher_recitations,
  public.teacher_session_reports, public.staff_messages, public.teacher_requests,
  public.teacher_salary_records, public.teacher_documents from anon;
revoke insert, update, delete, truncate, references, trigger on public.teacher_session_runs,
  public.teacher_session_students, public.teacher_recitations, public.teacher_session_reports,
  public.staff_messages, public.teacher_requests, public.teacher_salary_records,
  public.teacher_documents from authenticated;
grant select on public.teacher_session_runs, public.teacher_session_students, public.teacher_recitations,
  public.teacher_session_reports, public.staff_messages, public.teacher_requests,
  public.teacher_salary_records, public.teacher_documents to authenticated;

create function public.teacher_start_session(target_course_session_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); target public.course_sessions%rowtype; run uuid;
begin
  if teacher is null or not public.has_role('teacher') then raise exception 'teacher_session_required'; end if;
  select * into target from public.course_sessions where id = target_course_session_id;
  if target.id is null or target.teacher_id <> teacher or target.status <> 'scheduled' or not public.teacher_owns_class(target.class_id) then raise exception 'course_session_not_accessible'; end if;
  insert into public.teacher_session_runs(course_session_id, class_id, teacher_id)
  values(target.id, target.class_id, teacher) returning id into run;
  insert into public.teacher_session_students(run_id, student_id)
  select run, ce.student_id from public.class_enrollments ce where ce.class_id = target.class_id and ce.status = 'active';
  return run;
end;
$$;

create function public.teacher_save_attendance(target_run_id uuid, attendance_rows jsonb)
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
    update public.teacher_session_students set attendance = target_status, minutes_late = case when target_status = 'late' then late_minutes else 0 end, updated_at = now()
    where run_id = target_run_id and student_id = target_student;
    insert into public.attendance_records(session_id, student_id, status, minutes_late, recorded_by)
    select r.course_session_id, target_student, target_status, case when target_status = 'late' then late_minutes else 0 end, teacher
    from public.teacher_session_runs r where r.id = target_run_id
    on conflict (session_id, student_id) do update set status = excluded.status, minutes_late = excluded.minutes_late,
      recorded_by = excluded.recorded_by, recorded_at = now();
  end loop;
end;
$$;

create function public.teacher_record_student_work(
  target_run_id uuid, target_student_id uuid, target_surah_number smallint,
  target_verse_from smallint, target_verse_to smallint,
  target_appreciation public.recitation_appreciation, target_comment text,
  target_behavior public.session_behavior_status, target_difficulties jsonb,
  target_create_goal boolean, target_goal_surah smallint, target_goal_from smallint, target_goal_to smallint,
  target_create_assignment boolean, target_assignment_due timestamptz
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); target_class uuid; school uuid; recitation uuid; max_verse smallint;
begin
  select r.class_id, c.school_id into target_class, school from public.teacher_session_runs r join public.classes c on c.id = r.class_id
  where r.id = target_run_id and r.teacher_id = teacher and r.status = 'in_progress';
  if target_class is null then raise exception 'active_session_not_found'; end if;
  if not exists (select 1 from public.class_enrollments where class_id = target_class and student_id = target_student_id and status = 'active') then raise exception 'student_not_in_session_class'; end if;
  select verse_count into max_verse from public.quran_surahs where number = target_surah_number;
  if max_verse is null or target_verse_from < 1 or target_verse_to < target_verse_from or target_verse_to > max_verse then raise exception 'invalid_recitation_range'; end if;
  if target_create_goal then
    select verse_count into max_verse from public.quran_surahs where number = target_goal_surah;
    if max_verse is null or target_goal_from < 1 or target_goal_to < target_goal_from or target_goal_to > max_verse then raise exception 'invalid_goal_range'; end if;
  end if;
  insert into public.teacher_recitations(run_id, student_id, surah_number, verse_from, verse_to, appreciation, comment, recorded_by)
  values(target_run_id, target_student_id, target_surah_number, target_verse_from, target_verse_to, target_appreciation, nullif(trim(target_comment), ''), teacher) returning id into recitation;
  update public.teacher_session_students set processed_at = now(), behavior = target_behavior,
    difficulty_flags = coalesce(target_difficulties, '[]'::jsonb), teacher_note = nullif(trim(target_comment), ''), updated_at = now()
  where run_id = target_run_id and student_id = target_student_id;
  if target_create_goal then
    insert into public.learning_goals(student_id, surah_number, verse_from, verse_to, created_by)
    values(target_student_id, target_goal_surah, target_goal_from, target_goal_to, teacher);
  end if;
  if target_create_assignment then
    insert into public.assignments(school_id, student_id, teacher_id, title, instructions, surah_number, verse_from, verse_to, due_at)
    values(school, target_student_id, teacher, 'واجب مراجعة', 'راجع المقطع المحدد قبل الحصة القادمة.', target_surah_number, target_verse_from, target_verse_to, target_assignment_due);
  end if;
  return recitation;
end;
$$;

create function public.teacher_open_session_report(target_run_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); target_class uuid; report uuid;
begin
  select class_id into target_class from public.teacher_session_runs where id = target_run_id and teacher_id = teacher and status = 'in_progress';
  if target_class is null then raise exception 'active_session_not_found'; end if;
  update public.teacher_session_runs set status = 'report_pending' where id = target_run_id;
  insert into public.teacher_session_reports(run_id, teacher_id, class_id, present_count, absent_count, late_count)
  select target_run_id, teacher, target_class,
    count(*) filter (where attendance = 'present'), count(*) filter (where attendance = 'absent'), count(*) filter (where attendance = 'late')
  from public.teacher_session_students where run_id = target_run_id returning id into report;
  return report;
end;
$$;

create function public.teacher_submit_session_report(
  target_report_id uuid, target_program_status public.session_program_status,
  target_behavior public.session_behavior_status, target_difficulties jsonb,
  target_follow_up_students jsonb, target_incident boolean, target_incident_summary text,
  target_equipment public.equipment_status, target_equipment_details text, target_optional_note text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); target_run uuid; target_class uuid; target_school uuid;
begin
  select r.id, r.class_id, c.school_id into target_run, target_class, target_school
  from public.teacher_session_reports sr join public.teacher_session_runs r on r.id = sr.run_id join public.classes c on c.id = r.class_id
  where sr.id = target_report_id and sr.teacher_id = teacher and sr.status = 'draft' and r.status = 'report_pending';
  if target_run is null then raise exception 'draft_report_not_found'; end if;
  update public.teacher_session_reports set status = 'submitted', program_status = target_program_status, behavior = target_behavior,
    difficulty_flags = coalesce(target_difficulties, '[]'::jsonb), follow_up_students = coalesce(target_follow_up_students, '[]'::jsonb),
    incident = target_incident, incident_summary = case when target_incident then nullif(trim(target_incident_summary), '') else null end,
    equipment = target_equipment, equipment_details = nullif(trim(target_equipment_details), ''), optional_note = nullif(trim(target_optional_note), ''), submitted_at = now()
  where id = target_report_id;
  update public.teacher_session_runs set status = 'completed', ended_at = now() where id = target_run;
  update public.course_sessions set status = 'completed' where id = (select course_session_id from public.teacher_session_runs where id = target_run);
  insert into public.user_notifications(user_id, title, body, href)
  select distinct ur.user_id, 'تقرير حصة جديد', 'أرسل الأستاذ تقرير حصة للمراجعة.', '/admin'
  from public.user_roles ur join public.school_memberships sm on sm.user_id = ur.user_id
  where ur.role in ('admin', 'direction') and sm.school_id = target_school and sm.status = 'active';
end;
$$;

create function public.teacher_create_request(
  target_kind public.teacher_request_kind, target_title text, target_details text,
  target_starts_on date default null, target_ends_on date default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare teacher uuid := (select auth.uid()); school uuid; request uuid;
begin
  if teacher is null or not public.has_role('teacher') then raise exception 'teacher_session_required'; end if;
  select school_id into school from public.school_memberships where user_id = teacher and status = 'active' limit 1;
  if school is null then raise exception 'active_school_required'; end if;
  insert into public.teacher_requests(school_id, teacher_id, kind, title, details, starts_on, ends_on)
  values(school, teacher, target_kind, trim(target_title), nullif(trim(target_details), ''), target_starts_on, target_ends_on) returning id into request;
  insert into public.user_notifications(user_id, title, body, href)
  select distinct ur.user_id, 'طلب جديد من أستاذ', trim(target_title), '/admin'
  from public.user_roles ur join public.school_memberships sm on sm.user_id = ur.user_id
  where ur.role in ('admin', 'direction') and sm.school_id = school and sm.status = 'active';
  return request;
end;
$$;

create function public.teacher_cancel_request(target_request_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.teacher_requests set status = 'cancelled', updated_at = now()
  where id = target_request_id and teacher_id = (select auth.uid()) and status = 'submitted';
  if not found then raise exception 'request_cannot_be_cancelled'; end if;
end;
$$;

create function public.admin_review_teacher_request(
  target_request_id uuid, target_status public.workflow_status, target_response text default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare request public.teacher_requests%rowtype;
begin
  perform public.require_administration_aal2();
  select * into request from public.teacher_requests where id = target_request_id;
  if request.id is null or not public.can_manage_school(request.school_id) then raise exception 'request_not_accessible'; end if;
  if target_status not in ('seen', 'in_review', 'approved', 'rejected', 'resolved') then raise exception 'invalid_review_status'; end if;
  update public.teacher_requests set status = target_status, admin_response = nullif(trim(target_response), ''),
    resolved_by = case when target_status in ('approved', 'rejected', 'resolved') then (select auth.uid()) else null end,
    resolved_at = case when target_status in ('approved', 'rejected', 'resolved') then now() else null end,
    updated_at = now() where id = target_request_id;
  insert into public.user_notifications(user_id, title, body, href)
  values(request.teacher_id, 'تحديث طلب مهني', coalesce(nullif(trim(target_response), ''), 'تم تحديث حالة طلبك.'), '/teacher/professional');
end;
$$;

revoke all on function public.teacher_start_session(uuid) from public, anon;
revoke all on function public.teacher_save_attendance(uuid, jsonb) from public, anon;
revoke all on function public.teacher_record_student_work(uuid, uuid, smallint, smallint, smallint, public.recitation_appreciation, text, public.session_behavior_status, jsonb, boolean, smallint, smallint, smallint, boolean, timestamptz) from public, anon;
revoke all on function public.teacher_open_session_report(uuid) from public, anon;
revoke all on function public.teacher_submit_session_report(uuid, public.session_program_status, public.session_behavior_status, jsonb, jsonb, boolean, text, public.equipment_status, text, text) from public, anon;
revoke all on function public.teacher_create_request(public.teacher_request_kind, text, text, date, date) from public, anon;
revoke all on function public.teacher_cancel_request(uuid) from public, anon;
revoke all on function public.admin_review_teacher_request(uuid, public.workflow_status, text) from public, anon;
grant execute on function public.teacher_start_session(uuid) to authenticated;
grant execute on function public.teacher_save_attendance(uuid, jsonb) to authenticated;
grant execute on function public.teacher_record_student_work(uuid, uuid, smallint, smallint, smallint, public.recitation_appreciation, text, public.session_behavior_status, jsonb, boolean, smallint, smallint, smallint, boolean, timestamptz) to authenticated;
grant execute on function public.teacher_open_session_report(uuid) to authenticated;
grant execute on function public.teacher_submit_session_report(uuid, public.session_program_status, public.session_behavior_status, jsonb, jsonb, boolean, text, public.equipment_status, text, text) to authenticated;
grant execute on function public.teacher_create_request(public.teacher_request_kind, text, text, date, date) to authenticated;
grant execute on function public.teacher_cancel_request(uuid) to authenticated;
grant execute on function public.admin_review_teacher_request(uuid, public.workflow_status, text) to authenticated;

commit;
