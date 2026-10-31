begin;
create table public.student_learning_sessions (
  student_id uuid not null references public.student_profiles(user_id),
  learning_key text not null check (learning_key ~ '^(surah|review)-[0-9]+$'),
  state jsonb not null default '{"cursor":0,"errors":0,"attempt":0,"failed":false,"passed":false}',
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, learning_key)
);
alter table public.student_learning_sessions enable row level security;
create policy student_learning_sessions_own_read on public.student_learning_sessions for select to authenticated using (student_id = auth.uid());
revoke all on public.student_learning_sessions from anon, authenticated;
grant select on public.student_learning_sessions to authenticated;
grant all on public.student_learning_sessions to service_role;

-- Only the server, after checking the canonical answer, may commit a transition.
create function public.save_student_learning(target_student uuid, target_key text, expected_version integer, next_state jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.student_learning_sessions%rowtype; target_surah integer; awarded integer; was_mastered boolean;
begin
  perform 1 from public.profiles where id = target_student and status = 'active' for update;
  if not found or not exists(select 1 from public.user_roles where user_id = target_student and role = 'student') then raise exception 'student_required'; end if;
  insert into public.student_learning_sessions(student_id, learning_key) values(target_student, target_key) on conflict do nothing;
  select * into current_row from public.student_learning_sessions where student_id = target_student and learning_key = target_key for update;
  if current_row.version <> expected_version then raise exception 'learning_version_conflict'; end if;
  if coalesce((current_row.state->>'passed')::boolean, false) then return current_row.version; end if;
  update public.student_learning_sessions set state = next_state, version = version + 1, updated_at = now() where student_id = target_student and learning_key = target_key;
  if target_key like 'surah-%' and (next_state->>'passed')::boolean then
    target_surah := split_part(target_key, '-', 2)::integer;
    select case when verse_count <= 5 then 3 when verse_count <= 10 then 4 else 5 end into awarded from public.quran_surahs where number = target_surah;
    if awarded is null then raise exception 'invalid_surah'; end if;
    select exists(select 1 from public.student_surah_progress where student_id = target_student and surah_number = target_surah and status = 'mastered') into was_mastered;
    insert into public.student_surah_progress(student_id,surah_number,status,completion_percent,highest_completed_step,stars,started_at,mastered_at,last_activity_at)
    values(target_student,target_surah,'mastered',100,(next_state->>'cursor')::integer,awarded,now(),now(),now())
    on conflict(student_id,surah_number) do update set status='mastered',completion_percent=100, highest_completed_step=greatest(public.student_surah_progress.highest_completed_step,excluded.highest_completed_step), stars=case when was_mastered then public.student_surah_progress.stars else greatest(public.student_surah_progress.stars,excluded.stars) end, mastered_at=coalesce(public.student_surah_progress.mastered_at,now()),last_activity_at=now();
    if not was_mastered then insert into public.learning_events(student_id,event_kind,surah_number,metadata) values(target_student,'surah_completed',target_surah,jsonb_build_object('stars',awarded)); end if;
  end if;
  return expected_version + 1;
end $$;
revoke all on function public.save_student_learning(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_student_learning(uuid,text,integer,jsonb) to service_role;
-- Prevent bypassing the required phases through the legacy completion endpoint.
create or replace function public.complete_quran_surah(target_surah_number smallint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.student_learning_sessions where student_id=auth.uid() and learning_key='surah-' || target_surah_number and (state->>'passed')::boolean) then raise exception 'required_learning_incomplete'; end if;
end $$;
commit;
