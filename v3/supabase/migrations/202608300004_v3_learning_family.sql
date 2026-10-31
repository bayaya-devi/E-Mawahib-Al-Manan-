begin;

create type public.learning_progress_status as enum ('not_started', 'in_progress', 'mastered', 'review');
create type public.assignment_status as enum ('todo', 'in_progress', 'submitted', 'corrected');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
create type public.game_kind as enum (
  'verse_order', 'next_verse', 'missing_word', 'match_edges',
  'listen_identify', 'flash_memory', 'tajwid_theory', 'arabic_vocabulary',
  'validated_hadith', 'validated_adhkar'
);
create type public.recitation_attempt_status as enum ('recording', 'processing', 'completed', 'inconclusive', 'failed');
create type public.recitation_error_kind as enum ('omission', 'addition', 'substitution', 'order', 'uncertain');

create table public.quran_surahs (
  number smallint primary key check (number between 1 and 114),
  slug text not null unique,
  name_arabic text not null,
  name_latin text not null,
  verse_count smallint not null check (verse_count > 0),
  source_label text not null,
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table public.quran_verses (
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_number smallint not null check (verse_number > 0),
  canonical_text text not null check (char_length(trim(canonical_text)) > 0),
  audio_code text not null check (audio_code ~ '^[0-9]{6}$'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  primary key (surah_number, verse_number)
);

create table public.quran_audio_tracks (
  id uuid primary key default gen_random_uuid(),
  reciter_key text not null unique,
  reciter_name text not null,
  riwaya text not null,
  url_template text not null,
  fallback_url_template text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  status public.attendance_status not null,
  minutes_late smallint not null default 0 check (minutes_late >= 0),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.school_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'students', 'families', 'teachers')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict
);

create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  check (ends_at is null or ends_at >= starts_at)
);

create table public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_from smallint not null default 1 check (verse_from > 0),
  verse_to smallint not null check (verse_to >= verse_from),
  target_date date,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.student_surah_progress (
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  status public.learning_progress_status not null default 'not_started',
  completion_percent smallint not null default 0 check (completion_percent between 0 and 100),
  highest_completed_step smallint not null default 0 check (highest_completed_step >= 0),
  stars integer not null default 0 check (stars >= 0),
  started_at timestamptz,
  mastered_at timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, surah_number)
);

create table public.student_verse_progress (
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null,
  verse_number smallint not null,
  status public.learning_progress_status not null default 'not_started',
  successful_attempts integer not null default 0 check (successful_attempts >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  last_practised_at timestamptz,
  primary key (student_id, surah_number, verse_number),
  foreign key (surah_number, verse_number) references public.quran_verses(surah_number, verse_number) on delete restrict
);

create table public.review_passages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_from smallint not null check (verse_from > 0),
  verse_to smallint not null check (verse_to >= verse_from),
  reason text,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.learning_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  event_kind text not null check (event_kind in ('surah_started', 'surah_completed', 'verse_practised', 'goal_completed', 'assignment_updated', 'game_completed', 'exam_completed', 'v1_imported')),
  surah_number smallint references public.quran_surahs(number) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  student_id uuid references public.student_profiles(user_id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  title text not null,
  instructions text,
  surah_number smallint references public.quran_surahs(number) on delete restrict,
  verse_from smallint check (verse_from is null or verse_from > 0),
  verse_to smallint check (verse_to is null or verse_to >= verse_from),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  check (class_id is not null or student_id is not null)
);

create table public.assignment_submissions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  status public.assignment_status not null default 'todo',
  response text,
  submitted_at timestamptz,
  corrected_at timestamptz,
  teacher_feedback text,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete restrict,
  title text not null,
  juz_number smallint check (juz_number is null or juz_number between 1 and 30),
  starts_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.exam_results (
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  score numeric(5,2) check (score is null or score between 0 and 100),
  appreciation text,
  completed_at timestamptz,
  primary key (exam_id, student_id)
);

create table public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  kind public.game_kind not null,
  surah_number smallint references public.quran_surahs(number) on delete restrict,
  score integer not null default 0 check (score >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.validated_learning_content (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete restrict,
  kind public.game_kind not null check (kind in ('tajwid_theory', 'arabic_vocabulary', 'validated_hadith', 'validated_adhkar')),
  prompt text not null,
  answer text not null,
  distractors jsonb not null default '[]'::jsonb,
  source_reference text not null,
  validated_by uuid not null references public.profiles(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recitation_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_from smallint not null check (verse_from > 0),
  verse_to smallint not null check (verse_to >= verse_from),
  status public.recitation_attempt_status not null default 'recording',
  transcript text,
  transcript_confidence numeric(4,3) check (transcript_confidence is null or transcript_confidence between 0 and 1),
  audio_storage_path text,
  asr_engine text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.recitation_results (
  attempt_id uuid primary key references public.recitation_attempts(id) on delete cascade,
  memorization_score numeric(4,2) check (memorization_score is null or memorization_score between 0 and 10),
  matched_words integer not null default 0 check (matched_words >= 0),
  expected_words integer not null default 0 check (expected_words >= 0),
  is_conclusive boolean not null default false,
  recommendation text,
  acoustic_tajwid_status text not null default 'not_evaluated' check (acoustic_tajwid_status = 'not_evaluated'),
  analysed_at timestamptz not null default now()
);

create table public.recitation_errors (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.recitation_attempts(id) on delete cascade,
  verse_number smallint,
  kind public.recitation_error_kind not null,
  expected_text text,
  observed_text text,
  word_position integer check (word_position is null or word_position >= 0),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1)
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.authorized_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  title text not null,
  storage_path text not null,
  visible_to_family boolean not null default false,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.v1_learning_imports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  source_key text not null,
  source_fingerprint text not null,
  raw_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'review', 'failed')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, source_key, source_fingerprint)
);

create index student_progress_activity_idx on public.student_surah_progress(student_id, last_activity_at desc);
create index learning_events_student_time_idx on public.learning_events(student_id, occurred_at desc);
create index assignments_student_due_idx on public.assignments(student_id, due_at);
create index attendance_student_time_idx on public.attendance_records(student_id, recorded_at desc);
create index recitation_attempts_student_time_idx on public.recitation_attempts(student_id, started_at desc);
create index notifications_user_time_idx on public.user_notifications(user_id, created_at desc);

alter table public.quran_surahs enable row level security;
alter table public.quran_verses enable row level security;
alter table public.quran_audio_tracks enable row level security;
alter table public.course_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.school_announcements enable row level security;
alter table public.school_events enable row level security;
alter table public.learning_goals enable row level security;
alter table public.student_surah_progress enable row level security;
alter table public.student_verse_progress enable row level security;
alter table public.review_passages enable row level security;
alter table public.learning_events enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_results enable row level security;
alter table public.game_attempts enable row level security;
alter table public.validated_learning_content enable row level security;
alter table public.recitation_attempts enable row level security;
alter table public.recitation_results enable row level security;
alter table public.recitation_errors enable row level security;
alter table public.user_notifications enable row level security;
alter table public.authorized_documents enable row level security;

create policy quran_surahs_read on public.quran_surahs for select to anon, authenticated using (true);
create policy quran_verses_read on public.quran_verses for select to anon, authenticated using (true);
create policy quran_audio_tracks_read on public.quran_audio_tracks for select to anon, authenticated using (active);
create policy course_sessions_read_scoped on public.course_sessions for select to authenticated using (public.can_access_class(class_id));
create policy attendance_records_read_scoped on public.attendance_records for select to authenticated using (public.can_access_student(student_id));
create policy announcements_read_scoped on public.school_announcements for select to authenticated using (public.is_school_member(school_id) and (class_id is null or public.can_access_class(class_id)));
create policy events_read_scoped on public.school_events for select to authenticated using (public.is_school_member(school_id) and (class_id is null or public.can_access_class(class_id)));
create policy learning_goals_read_scoped on public.learning_goals for select to authenticated using (public.can_access_student(student_id));
create policy surah_progress_read_scoped on public.student_surah_progress for select to authenticated using (public.can_access_student(student_id));
create policy verse_progress_read_scoped on public.student_verse_progress for select to authenticated using (public.can_access_student(student_id));
create policy review_passages_read_scoped on public.review_passages for select to authenticated using (public.can_access_student(student_id));
create policy learning_events_read_scoped on public.learning_events for select to authenticated using (public.can_access_student(student_id));
create policy assignments_read_scoped on public.assignments for select to authenticated using (
  (student_id is not null and public.can_access_student(student_id)) or (class_id is not null and public.can_access_class(class_id))
);
create policy assignment_submissions_read_scoped on public.assignment_submissions for select to authenticated using (public.can_access_student(student_id));
create policy exams_read_scoped on public.exams for select to authenticated using (class_id is null or public.can_access_class(class_id));
create policy exam_results_read_scoped on public.exam_results for select to authenticated using (public.can_access_student(student_id));
create policy game_attempts_read_scoped on public.game_attempts for select to authenticated using (public.can_access_student(student_id));
create policy validated_content_read on public.validated_learning_content for select to authenticated using (active and (school_id is null or public.is_school_member(school_id)));
create policy recitation_attempts_read_scoped on public.recitation_attempts for select to authenticated using (public.can_access_student(student_id));
create policy recitation_results_read_scoped on public.recitation_results for select to authenticated using (
  exists (select 1 from public.recitation_attempts ra where ra.id = attempt_id and public.can_access_student(ra.student_id))
);
create policy recitation_errors_read_scoped on public.recitation_errors for select to authenticated using (
  exists (select 1 from public.recitation_attempts ra where ra.id = attempt_id and public.can_access_student(ra.student_id))
);
create policy notifications_read_own on public.user_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy documents_read_scoped on public.authorized_documents for select to authenticated using (
  student_id = (select auth.uid()) or public.teacher_has_student(student_id) or public.can_manage_student(student_id)
  or (visible_to_family and public.parent_has_student(student_id))
);

revoke all on
  public.quran_surahs, public.quran_verses, public.quran_audio_tracks,
  public.course_sessions, public.attendance_records, public.school_announcements,
  public.school_events, public.learning_goals, public.student_surah_progress,
  public.student_verse_progress, public.review_passages, public.learning_events,
  public.assignments, public.assignment_submissions, public.exams, public.exam_results,
  public.game_attempts, public.validated_learning_content, public.recitation_attempts,
  public.recitation_results, public.recitation_errors, public.user_notifications,
  public.authorized_documents from anon;
grant select on public.quran_surahs, public.quran_verses, public.quran_audio_tracks to anon;
revoke insert, update, delete, truncate, references, trigger on
  public.quran_surahs, public.quran_verses, public.quran_audio_tracks,
  public.course_sessions, public.attendance_records, public.school_announcements,
  public.school_events, public.learning_goals, public.student_surah_progress,
  public.student_verse_progress, public.review_passages, public.learning_events,
  public.assignments, public.assignment_submissions, public.exams, public.exam_results,
  public.game_attempts, public.validated_learning_content, public.recitation_attempts,
  public.recitation_results, public.recitation_errors, public.user_notifications,
  public.authorized_documents from authenticated;
grant select on
  public.quran_surahs, public.quran_verses, public.quran_audio_tracks,
  public.course_sessions, public.attendance_records, public.school_announcements,
  public.school_events, public.learning_goals, public.student_surah_progress,
  public.student_verse_progress, public.review_passages, public.learning_events,
  public.assignments, public.assignment_submissions, public.exams, public.exam_results,
  public.game_attempts, public.validated_learning_content, public.recitation_attempts,
  public.recitation_results, public.recitation_errors, public.user_notifications,
  public.authorized_documents to authenticated;

insert into public.quran_audio_tracks (reciter_key, reciter_name, riwaya, url_template, fallback_url_template)
values (
  'warsh-ibrahim-aldosary',
  'إبراهيم الدوسري',
  'ورش عن نافع',
  'https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps/{audio_code}.mp3',
  'https://everyayah.com/data/warsh/warsh_yassin_al_jazaery_64kbps/{audio_code}.mp3'
);

create function public.import_v1_learning_progress(
  target_student_id uuid,
  target_source_key text,
  target_source_fingerprint text,
  target_raw_payload jsonb,
  normalized_rows jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  import_id uuid;
  item jsonb;
  target_surah smallint;
  completed boolean;
begin
  insert into private.v1_learning_imports (student_id, source_key, source_fingerprint, raw_payload)
  values (target_student_id, target_source_key, target_source_fingerprint, target_raw_payload)
  on conflict (student_id, source_key, source_fingerprint) do nothing
  returning id into import_id;
  if import_id is null then return false; end if;

  for item in select value from jsonb_array_elements(normalized_rows)
  loop
    target_surah := (item->>'surah_number')::smallint;
    completed := coalesce((item->>'completed')::boolean, false);
    if target_surah between 1 and 114 then
      insert into public.student_surah_progress (
        student_id, surah_number, status, completion_percent, highest_completed_step,
        stars, started_at, mastered_at, last_activity_at
      ) values (
        target_student_id,
        target_surah,
        case when completed then 'mastered'::public.learning_progress_status else 'in_progress'::public.learning_progress_status end,
        case when completed then 100 else least(99, greatest(0, coalesce((item->>'completion_percent')::smallint, 0))) end,
        greatest(0, coalesce((item->>'highest_completed_step')::smallint, 0)),
        greatest(0, coalesce((item->>'stars')::integer, 0)),
        nullif(item->>'started_at', '')::timestamptz,
        case when completed then coalesce(nullif(item->>'completed_at', '')::timestamptz, now()) else null end,
        coalesce(nullif(item->>'last_activity_at', '')::timestamptz, nullif(item->>'completed_at', '')::timestamptz)
      )
      on conflict (student_id, surah_number) do update set
        status = case when public.student_surah_progress.status = 'mastered' or excluded.status = 'mastered' then 'mastered'::public.learning_progress_status else excluded.status end,
        completion_percent = greatest(public.student_surah_progress.completion_percent, excluded.completion_percent),
        highest_completed_step = greatest(public.student_surah_progress.highest_completed_step, excluded.highest_completed_step),
        stars = greatest(public.student_surah_progress.stars, excluded.stars),
        started_at = least(public.student_surah_progress.started_at, excluded.started_at),
        mastered_at = coalesce(public.student_surah_progress.mastered_at, excluded.mastered_at),
        last_activity_at = greatest(public.student_surah_progress.last_activity_at, excluded.last_activity_at),
        updated_at = now();
    end if;
  end loop;

  update private.v1_learning_imports set status = 'completed', imported_at = now() where id = import_id;
  insert into public.learning_events (student_id, event_kind, metadata)
  values (target_student_id, 'v1_imported', jsonb_build_object('source_key', target_source_key, 'fingerprint', target_source_fingerprint));
  return true;
exception when others then
  if import_id is not null then update private.v1_learning_imports set status = 'failed' where id = import_id; end if;
  raise;
end;
$$;

revoke all on function public.import_v1_learning_progress(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_v1_learning_progress(uuid, text, text, jsonb, jsonb) to service_role;

create function public.record_recitation_attempt(
  target_surah_number smallint,
  target_verse_from smallint,
  target_verse_to smallint,
  target_transcript text,
  target_confidence numeric,
  target_score numeric,
  target_matched_words integer,
  target_expected_words integer,
  target_conclusive boolean,
  target_recommendation text,
  target_errors jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  student uuid := (select auth.uid());
  attempt uuid;
  item jsonb;
  max_verse smallint;
begin
  if student is null or not public.has_role('student') then raise exception 'student_session_required'; end if;
  select verse_count into max_verse from public.quran_surahs where number = target_surah_number;
  if max_verse is null or target_verse_from < 1 or target_verse_to < target_verse_from or target_verse_to > max_verse then
    raise exception 'invalid_recitation_range';
  end if;
  insert into public.recitation_attempts (
    student_id, surah_number, verse_from, verse_to, status, transcript,
    transcript_confidence, asr_engine, completed_at
  ) values (
    student, target_surah_number, target_verse_from, target_verse_to,
    case when target_conclusive then 'completed'::public.recitation_attempt_status else 'inconclusive'::public.recitation_attempt_status end,
    nullif(trim(target_transcript), ''), target_confidence, 'browser-web-speech', now()
  ) returning id into attempt;
  insert into public.recitation_results (
    attempt_id, memorization_score, matched_words, expected_words,
    is_conclusive, recommendation
  ) values (
    attempt, case when target_conclusive then target_score else null end,
    greatest(0, target_matched_words), greatest(0, target_expected_words),
    target_conclusive, target_recommendation
  );
  for item in select value from jsonb_array_elements(coalesce(target_errors, '[]'::jsonb))
  loop
    insert into public.recitation_errors (attempt_id, kind, expected_text, observed_text, word_position, confidence)
    values (
      attempt,
      coalesce(item->>'kind', 'uncertain')::public.recitation_error_kind,
      item->>'expected', item->>'observed',
      greatest(0, coalesce((item->>'position')::integer, 0)), target_confidence
    );
  end loop;
  return attempt;
end;
$$;

revoke all on function public.record_recitation_attempt(smallint, smallint, smallint, text, numeric, numeric, integer, integer, boolean, text, jsonb) from public, anon;
grant execute on function public.record_recitation_attempt(smallint, smallint, smallint, text, numeric, numeric, integer, integer, boolean, text, jsonb) to authenticated;

create function public.record_quran_practice(
  target_surah_number smallint,
  target_verse_number smallint,
  target_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  student uuid := (select auth.uid());
  total_verses integer;
  practised integer;
begin
  if student is null or not public.has_role('student') then raise exception 'student_session_required'; end if;
  select verse_count into total_verses from public.quran_surahs where number = target_surah_number;
  if total_verses is null or target_verse_number < 1 or target_verse_number > total_verses then raise exception 'invalid_verse'; end if;
  insert into public.student_verse_progress (
    student_id, surah_number, verse_number, status, successful_attempts, error_count, last_practised_at
  ) values (
    student, target_surah_number, target_verse_number,
    case when target_success then 'in_progress'::public.learning_progress_status else 'review'::public.learning_progress_status end,
    case when target_success then 1 else 0 end,
    case when target_success then 0 else 1 end,
    now()
  )
  on conflict (student_id, surah_number, verse_number) do update set
    status = case when target_success then 'in_progress'::public.learning_progress_status else 'review'::public.learning_progress_status end,
    successful_attempts = public.student_verse_progress.successful_attempts + case when target_success then 1 else 0 end,
    error_count = public.student_verse_progress.error_count + case when target_success then 0 else 1 end,
    last_practised_at = now();
  select count(*) into practised from public.student_verse_progress
  where student_id = student and surah_number = target_surah_number and successful_attempts > 0;
  insert into public.student_surah_progress (
    student_id, surah_number, status, completion_percent, highest_completed_step, started_at, last_activity_at
  ) values (
    student, target_surah_number, 'in_progress', least(99, floor(practised * 100.0 / total_verses)::smallint), 1, now(), now()
  )
  on conflict (student_id, surah_number) do update set
    status = case when public.student_surah_progress.status = 'mastered' then 'mastered'::public.learning_progress_status else 'in_progress'::public.learning_progress_status end,
    completion_percent = case when public.student_surah_progress.status = 'mastered' then 100 else greatest(public.student_surah_progress.completion_percent, excluded.completion_percent) end,
    started_at = coalesce(public.student_surah_progress.started_at, now()),
    last_activity_at = now(), updated_at = now();
  insert into public.learning_events (student_id, event_kind, surah_number, metadata)
  values (student, 'verse_practised', target_surah_number, jsonb_build_object('verse_number', target_verse_number, 'success', target_success));
end;
$$;

create function public.update_own_assignment(
  target_assignment_id uuid,
  target_status public.assignment_status,
  target_response text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  student uuid := (select auth.uid());
  allowed boolean;
  current_status public.assignment_status;
begin
  if student is null or not public.has_role('student') then raise exception 'student_session_required'; end if;
  if target_status not in ('todo', 'in_progress', 'submitted') then raise exception 'student_cannot_correct_assignment'; end if;
  select exists (
    select 1 from public.assignments a
    where a.id = target_assignment_id and (
      a.student_id = student or exists (
        select 1 from public.class_enrollments ce
        where ce.class_id = a.class_id and ce.student_id = student and ce.status = 'active'
      )
    )
  ) into allowed;
  if not allowed then raise exception 'assignment_not_accessible'; end if;
  select status into current_status from public.assignment_submissions
  where assignment_id = target_assignment_id and student_id = student;
  if current_status in ('submitted', 'corrected') and target_status <> current_status then
    raise exception 'assignment_status_cannot_regress';
  end if;
  insert into public.assignment_submissions (assignment_id, student_id, status, response, submitted_at)
  values (target_assignment_id, student, target_status, nullif(trim(target_response), ''), case when target_status = 'submitted' then now() else null end)
  on conflict (assignment_id, student_id) do update set
    status = excluded.status,
    response = coalesce(excluded.response, public.assignment_submissions.response),
    submitted_at = case when excluded.status = 'submitted' then now() else public.assignment_submissions.submitted_at end,
    updated_at = now();
  insert into public.learning_events (student_id, event_kind, metadata)
  values (student, 'assignment_updated', jsonb_build_object('assignment_id', target_assignment_id, 'status', target_status));
end;
$$;

revoke all on function public.record_quran_practice(smallint, smallint, boolean) from public, anon;
revoke all on function public.update_own_assignment(uuid, public.assignment_status, text) from public, anon;
grant execute on function public.record_quran_practice(smallint, smallint, boolean) to authenticated;
grant execute on function public.update_own_assignment(uuid, public.assignment_status, text) to authenticated;

commit;
