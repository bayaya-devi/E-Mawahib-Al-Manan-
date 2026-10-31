-- A teacher recitation and the student's learning progress must share one transaction.
-- Keep the previous signature available during rolling deployments; the application
-- selects this overload by sending target_mark_mastered.
create function public.teacher_record_student_work(
  target_run_id uuid, target_student_id uuid, target_surah_number smallint,
  target_verse_from smallint, target_verse_to smallint,
  target_appreciation public.recitation_appreciation, target_comment text,
  target_behavior public.session_behavior_status, target_difficulties jsonb,
  target_create_goal boolean, target_goal_surah smallint, target_goal_from smallint, target_goal_to smallint,
  target_create_assignment boolean, target_assignment_due timestamptz,
  target_mark_mastered boolean
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  recitation uuid;
  max_verse smallint;
  was_mastered boolean := false;
begin
  if target_mark_mastered then
    select verse_count into max_verse from public.quran_surahs where number = target_surah_number;
    if max_verse is null or target_verse_from <> 1 or target_verse_to <> max_verse then
      raise exception 'mastery_requires_complete_surah';
    end if;
    if target_appreciation not in ('excellent', 'very_good', 'good', 'acceptable') then
      raise exception 'mastery_requires_passing_appreciation';
    end if;
  end if;

  recitation := public.teacher_record_student_work(
    target_run_id, target_student_id, target_surah_number,
    target_verse_from, target_verse_to, target_appreciation, target_comment,
    target_behavior, target_difficulties, target_create_goal,
    target_goal_surah, target_goal_from, target_goal_to,
    target_create_assignment, target_assignment_due
  );

  if target_mark_mastered then
    select exists (
      select 1 from public.student_surah_progress
      where student_id = target_student_id and surah_number = target_surah_number and status = 'mastered'
    ) into was_mastered;

    insert into public.student_surah_progress (
      student_id, surah_number, status, completion_percent,
      highest_completed_step, started_at, mastered_at, last_activity_at
    ) values (
      target_student_id, target_surah_number, 'mastered', 100,
      5, now(), now(), now()
    )
    on conflict (student_id, surah_number) do update set
      status = 'mastered',
      completion_percent = 100,
      highest_completed_step = greatest(public.student_surah_progress.highest_completed_step, 5),
      started_at = coalesce(public.student_surah_progress.started_at, now()),
      mastered_at = coalesce(public.student_surah_progress.mastered_at, now()),
      last_activity_at = now(),
      updated_at = now();

    if not was_mastered then
      insert into public.learning_events (student_id, event_kind, surah_number, metadata)
      values (target_student_id, 'surah_completed', target_surah_number, jsonb_build_object('source', 'teacher_session', 'run_id', target_run_id));
    end if;
  end if;

  return recitation;
end;
$$;

revoke all on function public.teacher_record_student_work(uuid, uuid, smallint, smallint, smallint, public.recitation_appreciation, text, public.session_behavior_status, jsonb, boolean, smallint, smallint, smallint, boolean, timestamptz, boolean) from public, anon;
grant execute on function public.teacher_record_student_work(uuid, uuid, smallint, smallint, smallint, public.recitation_appreciation, text, public.session_behavior_status, jsonb, boolean, smallint, smallint, smallint, boolean, timestamptz, boolean) to authenticated;
