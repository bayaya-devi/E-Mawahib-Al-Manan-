begin;

create type public.student_age_category as enum (
  'CHILD_5_8',
  'TEEN_9_18',
  'ADULT_19_PLUS'
);

alter table public.student_profiles
  add column age_category public.student_age_category;

alter table public.student_learning_sessions
  drop constraint student_learning_sessions_learning_key_check;
alter table public.student_learning_sessions
  add constraint student_learning_sessions_learning_key_check
  check (learning_key ~ '^(surah|review|juz)-[0-9]+$');

create table public.quran_juz_passages (
  juz_number smallint not null check (juz_number between 1 and 30),
  learning_order smallint not null check (learning_order > 0),
  surah_number smallint not null references public.quran_surahs(number) on delete restrict,
  verse_from smallint not null check (verse_from > 0),
  verse_to smallint not null check (verse_to >= verse_from),
  created_at timestamptz not null default now(),
  primary key (juz_number, learning_order),
  unique (juz_number, surah_number, verse_from, verse_to),
  foreign key (surah_number, verse_from) references public.quran_verses(surah_number, verse_number) on delete restrict,
  foreign key (surah_number, verse_to) references public.quran_verses(surah_number, verse_number) on delete restrict
);

with starts(juz_number, surah_number, verse_number) as (
  values
    (1,1,1),(2,2,142),(3,2,253),(4,3,93),(5,4,24),(6,4,148),
    (7,5,82),(8,6,111),(9,7,88),(10,8,41),(11,9,93),(12,11,6),
    (13,12,53),(14,15,1),(15,17,1),(16,18,75),(17,21,1),(18,23,1),
    (19,25,21),(20,27,56),(21,29,46),(22,33,31),(23,36,28),(24,39,32),
    (25,41,47),(26,46,1),(27,51,31),(28,58,1),(29,67,1),(30,78,1)
), bounds as (
  select s.*, lead(s.surah_number, 1, 115) over(order by s.juz_number) as next_surah,
    lead(s.verse_number, 1, 1) over(order by s.juz_number) as next_verse
  from starts s
), expanded as (
  select b.juz_number, q.number as surah_number,
    case when q.number = b.surah_number then b.verse_number else 1 end as verse_from,
    case when q.number = b.next_surah then b.next_verse - 1 else q.verse_count end as verse_to
  from bounds b
  join public.quran_surahs q on q.number between b.surah_number and least(b.next_surah, 114)
  where not (q.number = b.next_surah and b.next_verse = 1)
), ordered as (
  select *, row_number() over(partition by juz_number order by surah_number desc, verse_from desc)::smallint as learning_order
  from expanded
  where verse_to >= verse_from
)
insert into public.quran_juz_passages(juz_number, learning_order, surah_number, verse_from, verse_to)
select juz_number, learning_order, surah_number, verse_from, verse_to from ordered;

create table public.quran_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  learning_key text not null check (learning_key ~ '^(surah|review)-[0-9]+$'),
  exercise_index smallint not null check (exercise_index >= 0),
  attempt_number integer not null check (attempt_number >= 0),
  status text not null check (status in ('passed','failed','abandoned')),
  correct_count integer not null default 0 check (correct_count >= 0),
  error_count integer not null default 0 check (error_count between 0 and 3),
  completed_at timestamptz not null default now(),
  unique(student_id, learning_key, exercise_index, attempt_number, status)
);

create table public.quran_juz_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  juz_number smallint not null check (juz_number between 1 and 30),
  attempt_number integer not null check (attempt_number > 0),
  score smallint not null check (score between 0 and 100),
  question_count smallint not null check (question_count > 0),
  passed boolean generated always as (score >= 80) stored,
  completed_at timestamptz not null default now(),
  unique(student_id, juz_number, attempt_number)
);

create table public.student_profile_switch_authorizations (
  source_student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  target_student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  primary key (source_student_id, target_student_id),
  check (source_student_id <> target_student_id),
  check ((status = 'active' and revoked_at is null and revoked_by is null) or (status = 'revoked' and revoked_at is not null))
);

create index quran_exercise_attempts_student_time_idx on public.quran_exercise_attempts(student_id, completed_at desc);
create index quran_juz_exam_attempts_student_time_idx on public.quran_juz_exam_attempts(student_id, completed_at desc);
create index student_profile_switch_target_idx on public.student_profile_switch_authorizations(target_student_id) where status = 'active';

alter table public.quran_juz_passages enable row level security;
alter table public.quran_exercise_attempts enable row level security;
alter table public.quran_juz_exam_attempts enable row level security;
alter table public.student_profile_switch_authorizations enable row level security;

create policy quran_juz_passages_read on public.quran_juz_passages for select to authenticated using (true);
create policy quran_exercise_attempts_scoped_read on public.quran_exercise_attempts for select to authenticated
  using (public.can_access_student(student_id));
create policy quran_juz_exam_attempts_scoped_read on public.quran_juz_exam_attempts for select to authenticated
  using (public.can_access_student(student_id));
create policy student_profile_switch_own_read on public.student_profile_switch_authorizations for select to authenticated
  using (source_student_id = auth.uid() or public.is_administration());

revoke all on public.quran_juz_passages, public.quran_exercise_attempts, public.quran_juz_exam_attempts,
  public.student_profile_switch_authorizations from anon, authenticated;
grant select on public.quran_juz_passages, public.quran_exercise_attempts, public.quran_juz_exam_attempts,
  public.student_profile_switch_authorizations to authenticated;
grant all on public.quran_exercise_attempts, public.quran_juz_exam_attempts,
  public.student_profile_switch_authorizations to service_role;

create function public.admin_set_student_age_category(target_student_id uuid, target_category public.student_age_category)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := auth.uid();
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships
    where user_id = target_student_id and status = 'active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'student_scope_denied'; end if;
  update public.student_profiles set age_category = target_category where user_id = target_student_id;
  if not found then raise exception 'student_not_found'; end if;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'admin.student_age_category_updated', 'student', target_student_id,
    jsonb_build_object('age_category', target_category));
end $$;

revoke all on function public.admin_set_student_age_category(uuid,public.student_age_category) from public,anon;
grant execute on function public.admin_set_student_age_category(uuid,public.student_age_category) to authenticated;

create function public.can_switch_student_profile(target_student_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_student_id = auth.uid() or exists(
    select 1 from public.student_profile_switch_authorizations link
    join public.profiles source on source.id = link.source_student_id and source.status = 'active'
    join public.profiles target on target.id = link.target_student_id and target.status = 'active'
    where link.source_student_id = auth.uid() and link.target_student_id = target_student_id and link.status = 'active'
  );
$$;

revoke all on function public.can_switch_student_profile(uuid) from public,anon;
grant execute on function public.can_switch_student_profile(uuid) to authenticated;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_student_id = auth.uid()
    or public.parent_has_student(target_student_id)
    or public.teacher_has_student(target_student_id)
    or public.can_manage_user(target_student_id)
    or public.can_switch_student_profile(target_student_id);
$$;

revoke all on function public.can_access_student(uuid) from public,anon;
grant execute on function public.can_access_student(uuid) to authenticated;

create or replace function public.can_access_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.classes c where c.id=target_class_id and (
      public.can_manage_school(c.school_id)
      or (public.is_school_member(c.school_id) and (
        exists(select 1 from public.class_teacher_assignments cta where cta.class_id=c.id and cta.teacher_id=auth.uid() and cta.status='active')
        or exists(select 1 from public.class_enrollments ce where ce.class_id=c.id and ce.status='active' and public.can_switch_student_profile(ce.student_id))
        or exists(select 1 from public.class_enrollments ce join public.family_relationships fr on fr.student_id=ce.student_id where ce.class_id=c.id and ce.status='active' and fr.parent_id=auth.uid() and fr.status='active')
      ))
    )
  );
$$;

revoke all on function public.can_access_class(uuid) from public,anon;
grant execute on function public.can_access_class(uuid) to authenticated;

drop policy if exists school_memberships_select_scoped on public.school_memberships;
create policy school_memberships_select_scoped on public.school_memberships for select to authenticated
  using (public.can_switch_student_profile(user_id) or public.can_manage_school(school_id));
drop policy if exists class_enrollments_select_scoped on public.class_enrollments;
create policy class_enrollments_select_scoped on public.class_enrollments for select to authenticated
  using (public.can_access_student(student_id));
drop policy if exists class_teacher_assignments_select_scoped on public.class_teacher_assignments;
create policy class_teacher_assignments_select_scoped on public.class_teacher_assignments for select to authenticated
  using (teacher_id=auth.uid() or public.can_access_class(class_id));

drop policy if exists student_payments_admin_read on public.student_payments;
create policy student_payments_admin_read on public.student_payments for select to authenticated
  using (public.can_switch_student_profile(student_id) or public.parent_has_student(student_id) or public.can_manage_school(school_id));
drop policy if exists student_digital_files_student_read on public.student_digital_files;
create policy student_digital_files_student_read on public.student_digital_files for select to authenticated
  using (public.can_switch_student_profile(student_id));
drop policy if exists school_documents_related_user_read on public.school_documents;
create policy school_documents_related_user_read on public.school_documents for select to authenticated
  using (visible_to_related_user = true and related_user_id is not null and public.can_switch_student_profile(related_user_id));

create function public.admin_set_student_sibling_link(source_student uuid, target_student uuid, make_active boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid(); source_school uuid; target_school uuid;
begin
  perform public.require_administration_aal2();
  if source_student = target_student then raise exception 'invalid_sibling_link'; end if;
  select school_id into source_school from public.school_memberships where user_id=source_student and status='active' limit 1;
  select school_id into target_school from public.school_memberships where user_id=target_student and status='active' limit 1;
  if source_school is null or target_school is null or source_school <> target_school or not public.can_manage_school(source_school) then
    raise exception 'student_scope_denied';
  end if;
  if make_active then
    insert into public.student_profile_switch_authorizations(source_student_id,target_student_id,status,granted_by,granted_at,revoked_at,revoked_by)
    values(source_student,target_student,'active',actor,now(),null,null)
    on conflict(source_student_id,target_student_id) do update set status='active',granted_by=actor,granted_at=now(),revoked_at=null,revoked_by=null;
    insert into public.student_profile_switch_authorizations(source_student_id,target_student_id,status,granted_by,granted_at,revoked_at,revoked_by)
    values(target_student,source_student,'active',actor,now(),null,null)
    on conflict(source_student_id,target_student_id) do update set status='active',granted_by=actor,granted_at=now(),revoked_at=null,revoked_by=null;
  else
    update public.student_profile_switch_authorizations set status='revoked',revoked_at=now(),revoked_by=actor
      where (source_student_id=source_student and target_student_id=target_student)
         or (source_student_id=target_student and target_student_id=source_student);
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,source_school,case when make_active then 'admin.sibling_link_granted' else 'admin.sibling_link_revoked' end,
    'student',source_student,jsonb_build_object('linked_student_id',target_student));
end $$;

revoke all on function public.admin_set_student_sibling_link(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_set_student_sibling_link(uuid,uuid,boolean) to authenticated;

create function public.get_student_teacher_follow_up(target_student uuid)
returns table(id uuid,recorded_at timestamptz,teacher_name text,class_name text,surah_number smallint,verse_from smallint,verse_to smallint,appreciation text,comment text)
language sql stable security definer set search_path = public, pg_temp as $$
  select tr.id,tr.recorded_at,coalesce(p.display_name,'الأستاذ(ة)'),c.name,tr.surah_number,tr.verse_from,tr.verse_to,tr.appreciation::text,tr.comment
  from public.teacher_recitations tr
  join public.teacher_session_runs run on run.id=tr.run_id
  join public.classes c on c.id=run.class_id
  left join public.profiles p on p.id=tr.recorded_by
  where tr.student_id=target_student and public.can_access_student(target_student)
  order by tr.recorded_at desc limit 500;
$$;

revoke all on function public.get_student_teacher_follow_up(uuid) from public,anon;
grant execute on function public.get_student_teacher_follow_up(uuid) to authenticated;

create function public.restart_student_learning(target_student uuid,target_key text,expected_version integer,next_state jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.student_learning_sessions%rowtype; cursor_value integer; question_value integer;
begin
  if target_key !~ '^(surah|review|juz)-[0-9]+$' then raise exception 'invalid_learning_key'; end if;
  select * into current_row from public.student_learning_sessions where student_id=target_student and learning_key=target_key for update;
  if not found or current_row.version<>expected_version then raise exception 'learning_version_conflict'; end if;
  if coalesce((current_row.state->>'passed')::boolean,false) or coalesce((current_row.state->>'failed')::boolean,false) then return current_row.version; end if;
  cursor_value:=coalesce((current_row.state->>'cursor')::integer,0);
  question_value:=coalesce((current_row.state->>'question')::integer,0);
  if question_value<=0 then return current_row.version; end if;
  if target_key not like 'juz-%' then
    insert into public.quran_exercise_attempts(student_id,learning_key,exercise_index,attempt_number,status,correct_count,error_count)
    values(target_student,target_key,cursor_value,coalesce((current_row.state->>'attempt')::integer,0),'abandoned',
      coalesce((current_row.state->>'correct')::integer,0),least(3,coalesce((current_row.state->>'errors')::integer,0))) on conflict do nothing;
  end if;
  update public.student_learning_sessions set state=next_state,version=version+1,updated_at=now()
    where student_id=target_student and learning_key=target_key;
  return expected_version+1;
end $$;

revoke all on function public.restart_student_learning(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.restart_student_learning(uuid,text,integer,jsonb) to service_role;

create or replace function public.save_student_learning(target_student uuid, target_key text, expected_version integer, next_state jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_row public.student_learning_sessions%rowtype;
  target_surah integer;
  target_juz integer;
  awarded integer;
  was_mastered boolean;
  prior_cursor integer;
  next_cursor integer;
  prior_failed boolean;
  next_failed boolean;
  next_passed boolean;
begin
  perform 1 from public.profiles where id = target_student and status = 'active' for update;
  if not found or not exists(select 1 from public.user_roles where user_id = target_student and role = 'student') then raise exception 'student_required'; end if;
  if target_key !~ '^(surah|review|juz)-[0-9]+$' then raise exception 'invalid_learning_key'; end if;

  insert into public.student_learning_sessions(student_id, learning_key) values(target_student, target_key) on conflict do nothing;
  select * into current_row from public.student_learning_sessions where student_id = target_student and learning_key = target_key for update;
  if current_row.version <> expected_version then raise exception 'learning_version_conflict'; end if;
  if coalesce((current_row.state->>'passed')::boolean, false) then return current_row.version; end if;

  prior_cursor := coalesce((current_row.state->>'cursor')::integer, 0);
  next_cursor := coalesce((next_state->>'cursor')::integer, 0);
  prior_failed := coalesce((current_row.state->>'failed')::boolean, false);
  next_failed := coalesce((next_state->>'failed')::boolean, false);
  next_passed := coalesce((next_state->>'passed')::boolean, false);

  update public.student_learning_sessions set state = next_state, version = version + 1, updated_at = now()
  where student_id = target_student and learning_key = target_key;

  if target_key like 'juz-%' and (next_failed or next_passed) and not prior_failed then
    target_juz := split_part(target_key, '-', 2)::integer;
    insert into public.quran_juz_exam_attempts(student_id,juz_number,attempt_number,score,question_count)
    values(target_student,target_juz,coalesce((next_state->>'attempt')::integer,0)+1,
      coalesce((next_state->>'score')::integer,0),
      greatest(1,coalesce((next_state->'lastResult'->>'total')::integer,1)))
    on conflict(student_id,juz_number,attempt_number) do nothing;
    if next_passed and not exists(
      select 1 from public.learning_events where student_id=target_student and event_kind='juz_completed'
        and metadata->>'juz_number'=target_juz::text
    ) then
      insert into public.learning_events(student_id,event_kind,metadata)
      values(target_student,'juz_completed',jsonb_build_object('juz_number',target_juz,'score',(next_state->>'score')::integer));
    end if;
  elsif target_key not like 'juz-%' then
    if next_failed and not prior_failed then
      insert into public.quran_exercise_attempts(student_id,learning_key,exercise_index,attempt_number,status,correct_count,error_count)
      values(target_student,target_key,prior_cursor,coalesce((next_state->>'attempt')::integer,0),'failed',
        coalesce((next_state->>'correct')::integer,0),least(3,coalesce((next_state->>'errors')::integer,0)))
      on conflict do nothing;
    elsif next_cursor > prior_cursor then
      insert into public.quran_exercise_attempts(student_id,learning_key,exercise_index,attempt_number,status,correct_count,error_count)
      values(target_student,target_key,prior_cursor,coalesce((next_state->>'attempt')::integer,0),'passed',
        coalesce((next_state->'lastResult'->>'correct')::integer,0),least(3,coalesce((next_state->'lastResult'->>'errors')::integer,0)))
      on conflict do nothing;
    end if;
  end if;

  if target_key like 'surah-%' and next_passed then
    target_surah := split_part(target_key, '-', 2)::integer;
    select case when verse_count <= 5 then 3 when verse_count <= 10 then 4 else 5 end into awarded from public.quran_surahs where number = target_surah;
    if awarded is null then raise exception 'invalid_surah'; end if;
    select exists(select 1 from public.student_surah_progress where student_id = target_student and surah_number = target_surah and status = 'mastered') into was_mastered;
    insert into public.student_surah_progress(student_id,surah_number,status,completion_percent,highest_completed_step,stars,started_at,mastered_at,last_activity_at)
    values(target_student,target_surah,'mastered',100,next_cursor,awarded,now(),now(),now())
    on conflict(student_id,surah_number) do update set status='mastered',completion_percent=100,
      highest_completed_step=greatest(public.student_surah_progress.highest_completed_step,excluded.highest_completed_step),
      stars=case when was_mastered then public.student_surah_progress.stars else greatest(public.student_surah_progress.stars,excluded.stars) end,
      mastered_at=coalesce(public.student_surah_progress.mastered_at,now()),last_activity_at=now();
    if not was_mastered then
      insert into public.learning_events(student_id,event_kind,surah_number,metadata)
      values(target_student,'surah_completed',target_surah,jsonb_build_object('stars',awarded));
    end if;
  end if;
  return expected_version + 1;
end $$;

revoke all on function public.save_student_learning(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_student_learning(uuid,text,integer,jsonb) to service_role;

-- A switched sibling remains a distinct sender. Delegation is explicit,
-- revocable and checked on every read or write.
create or replace function public.can_act_as_student(target_student_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_student_id = (select auth.uid())
    or public.can_switch_student_profile(target_student_id);
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and public.can_act_as_student(cm.user_id)
  );
$$;

create or replace function public.set_student_locale(target_student_id uuid, target_locale text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_act_as_student(target_student_id) or target_locale not in ('ar','fr') then raise exception 'student_locale_denied'; end if;
  update public.profiles set locale=target_locale,updated_at=now() where id=target_student_id and status='active';
  if not found then raise exception 'student_locale_denied'; end if;
end;
$$;

create or replace function public.student_can_message_user(target_student_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_act_as_student(target_student_id)
    and target_student_id <> target_user_id
    and exists (select 1 from public.user_roles where user_id=target_student_id and role='student')
    and public.users_share_active_school(target_student_id, target_user_id)
    and (
      exists (select 1 from public.user_roles where user_id=target_user_id and role in ('admin','direction'))
      or exists (
        select 1 from public.class_enrollments ce
        join public.class_teacher_assignments cta on cta.class_id=ce.class_id and cta.status='active'
        where ce.student_id=target_student_id and ce.status='active' and cta.teacher_id=target_user_id
      )
    );
$$;

create or replace function public.list_student_message_targets(target_student_id uuid)
returns table(user_id uuid, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.display_name from public.profiles p
  where p.status='active' and public.student_can_message_user(target_student_id,p.id)
  order by p.display_name;
$$;

create or replace function public.create_student_conversation(target_student_id uuid, target_user_id uuid, target_subject text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; conversation uuid;
begin
  if not public.student_can_message_user(target_student_id,target_user_id) then raise exception 'messaging_relationship_denied'; end if;
  if char_length(trim(target_subject)) not between 1 and 120 then raise exception 'invalid_conversation_subject'; end if;
  select a.school_id into school from public.school_memberships a
  join public.school_memberships b on b.school_id=a.school_id
  where a.user_id=target_student_id and b.user_id=target_user_id and a.status='active' and b.status='active' limit 1;
  select c.id into conversation from public.conversations c
  join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=target_student_id
  join public.conversation_members theirs on theirs.conversation_id=c.id and theirs.user_id=target_user_id
  where c.school_id=school and c.kind='direct'
    and (select count(*) from public.conversation_members cm where cm.conversation_id=c.id)=2 limit 1;
  if conversation is not null then
    update public.conversation_members set archived_at=null where conversation_id=conversation and user_id=target_student_id;
    return conversation;
  end if;
  insert into public.conversations(school_id,kind,subject,created_by)
  values(school,'direct',trim(target_subject),target_student_id) returning id into conversation;
  insert into public.conversation_members(conversation_id,user_id) values(conversation,target_student_id),(conversation,target_user_id);
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),school,'student.conversation_created','conversation',conversation,jsonb_build_object('student_id',target_student_id));
  return conversation;
end;
$$;

create or replace function public.send_student_conversation_message(target_student_id uuid, target_conversation_id uuid, target_body text, target_client_id uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare message_id bigint; sent_recently integer;
begin
  if not public.can_act_as_student(target_student_id) or not exists(
    select 1 from public.conversation_members where conversation_id=target_conversation_id and user_id=target_student_id
  ) then raise exception 'conversation_access_denied'; end if;
  if char_length(trim(target_body)) not between 1 and 4000 then raise exception 'invalid_message_body'; end if;
  select id into message_id from public.conversation_messages where sender_id=target_student_id and client_id=target_client_id;
  if message_id is not null then return message_id; end if;
  select count(*) into sent_recently from public.conversation_messages where sender_id=target_student_id and created_at>now()-interval '1 minute';
  if sent_recently>=20 then raise exception 'message_rate_limit'; end if;
  insert into public.conversation_messages(conversation_id,sender_id,body,client_id)
  values(target_conversation_id,target_student_id,trim(target_body),target_client_id) returning id into message_id;
  update public.conversations set last_message_at=now() where id=target_conversation_id;
  update public.conversation_members set last_read_at=now(),archived_at=null where conversation_id=target_conversation_id and user_id=target_student_id;
  insert into public.user_notifications(user_id,title,body,href,category,entity_type,entity_id,dedup_key)
  select cm.user_id,'رسالة جديدة',left(trim(target_body),180),'/messages?conversation='||target_conversation_id,
    'message'::public.notification_category,'conversation',target_conversation_id,'message:'||message_id::text||':'||cm.user_id::text
  from public.conversation_members cm left join public.notification_preferences np on np.user_id=cm.user_id and np.category='message'
  where cm.conversation_id=target_conversation_id and cm.user_id<>target_student_id and coalesce(np.in_app,true);
  return message_id;
end;
$$;

create or replace function public.mark_student_conversation_read(target_student_id uuid, target_conversation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_act_as_student(target_student_id) then raise exception 'conversation_access_denied'; end if;
  update public.conversation_members set last_read_at=now() where conversation_id=target_conversation_id and user_id=target_student_id;
  if not found then raise exception 'conversation_access_denied'; end if;
  update public.user_notifications set read_at=coalesce(read_at,now()) where user_id=target_student_id and entity_type='conversation' and entity_id=target_conversation_id;
end;
$$;

create or replace function public.archive_student_conversation(target_student_id uuid, target_conversation_id uuid, target_archived boolean default true)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_act_as_student(target_student_id) then raise exception 'conversation_access_denied'; end if;
  update public.conversation_members set archived_at=case when target_archived then now() else null end
  where conversation_id=target_conversation_id and user_id=target_student_id;
  if not found then raise exception 'conversation_access_denied'; end if;
end;
$$;

create or replace function public.register_student_message_attachment(
  target_student_id uuid, target_message_id bigint, target_storage_path text, target_file_name text,
  target_mime_type text, target_size_bytes integer, target_checksum text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare attachment uuid; conversation uuid;
begin
  if not public.can_act_as_student(target_student_id) or not exists(select 1 from public.user_roles where user_id=target_student_id and role='student') then raise exception 'message_attachment_denied'; end if;
  select conversation_id into conversation from public.conversation_messages where id=target_message_id and sender_id=target_student_id;
  if conversation is null or not exists(select 1 from public.conversation_members where conversation_id=conversation and user_id=target_student_id) then raise exception 'message_attachment_denied'; end if;
  if target_storage_path not like conversation::text||'/'||target_student_id::text||'/%' then raise exception 'invalid_attachment_path'; end if;
  insert into public.message_attachments(message_id,storage_path,file_name,mime_type,size_bytes,checksum)
  values(target_message_id,target_storage_path,target_file_name,target_mime_type,target_size_bytes,lower(target_checksum)) returning id into attachment;
  return attachment;
end;
$$;

revoke all on function public.can_act_as_student(uuid), public.set_student_locale(uuid,text), public.student_can_message_user(uuid,uuid), public.list_student_message_targets(uuid),
  public.create_student_conversation(uuid,uuid,text), public.send_student_conversation_message(uuid,uuid,text,uuid),
  public.mark_student_conversation_read(uuid,uuid), public.archive_student_conversation(uuid,uuid,boolean),
  public.register_student_message_attachment(uuid,bigint,text,text,text,integer,text) from public,anon;
grant execute on function public.can_act_as_student(uuid), public.set_student_locale(uuid,text), public.student_can_message_user(uuid,uuid), public.list_student_message_targets(uuid),
  public.create_student_conversation(uuid,uuid,text), public.send_student_conversation_message(uuid,uuid,text,uuid),
  public.mark_student_conversation_read(uuid,uuid), public.archive_student_conversation(uuid,uuid,boolean),
  public.register_student_message_attachment(uuid,bigint,text,text,text,integer,text) to authenticated;

commit;
