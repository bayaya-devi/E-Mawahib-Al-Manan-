-- The completion function is intentionally atomic so long surahs remain reliable on mobile networks.
begin;
create or replace function public.complete_quran_surah(target_surah_number smallint)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare student uuid := auth.uid(); total_verses integer; awarded_stars smallint;
begin
  if student is null or not public.has_role('student') then raise exception 'student_session_required'; end if;
  select verse_count into total_verses from public.quran_surahs where number = target_surah_number;
  if total_verses is null then raise exception 'invalid_surah'; end if;
  insert into public.student_verse_progress (student_id, surah_number, verse_number, status, successful_attempts, error_count, last_practised_at)
  select student, target_surah_number, verse_number, 'in_progress'::public.learning_progress_status, 1, 0, now() from generate_series(1, total_verses) verse_number
  on conflict (student_id, surah_number, verse_number) do update set successful_attempts = greatest(public.student_verse_progress.successful_attempts, 1), status = 'in_progress'::public.learning_progress_status, last_practised_at = now();
  awarded_stars := case when total_verses <= 5 then 3 when total_verses <= 10 then 4 else 5 end;
  insert into public.student_surah_progress (student_id, surah_number, status, completion_percent, highest_completed_step, stars, started_at, mastered_at, last_activity_at) values (student, target_surah_number, 'mastered', 100, 5, awarded_stars, now(), now(), now())
  on conflict (student_id, surah_number) do update set status = 'mastered', completion_percent = 100, highest_completed_step = greatest(public.student_surah_progress.highest_completed_step, 5), stars = greatest(public.student_surah_progress.stars, excluded.stars), mastered_at = coalesce(public.student_surah_progress.mastered_at, now()), last_activity_at = now(), updated_at = now();
  insert into public.learning_events (student_id, event_kind, surah_number, metadata) values (student, 'surah_mastered', target_surah_number, jsonb_build_object('stars', awarded_stars));
end;
$$;
commit;
