begin;

alter table public.parent_feedback
  add column if not exists q1_enseignement smallint,
  add column if not exists q2_organisation smallint,
  add column if not exists q3_communication smallint,
  add column if not exists q4_plateforme smallint,
  add column if not exists q5_horaires smallint,
  add column if not exists commentaires text,
  add column if not exists date_soumission timestamptz;

create index if not exists parent_feedback_school_created_idx
  on public.parent_feedback(school_id, created_at desc);

create or replace function public.submit_parent_feedback(
  target_scores smallint[],
  target_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_student uuid;
  target_school uuid;
begin
  if actor is null then
    raise exception 'authenticated_session_required';
  end if;

  if cardinality(target_scores) <> 5
    or exists (select 1 from unnest(target_scores) value where value < 1 or value > 10) then
    raise exception 'invalid_scores';
  end if;

  if public.has_role('student') then
    target_student := actor;
  elsif public.has_role('parent') then
    select fr.student_id into target_student
    from public.family_relationships fr
    where fr.parent_id = actor and fr.status = 'active'
    order by fr.is_primary desc, fr.created_at asc
    limit 1;
  else
    raise exception 'parent_or_student_session_required';
  end if;

  if target_student is null then
    raise exception 'student_scope_required';
  end if;

  select sm.school_id into target_school
  from public.school_memberships sm
  where sm.user_id = target_student and sm.status = 'active'
  limit 1;

  if target_school is null then
    raise exception 'school_scope_required';
  end if;

  insert into public.parent_feedback(
    student_id, school_id, scores, comment,
    q1_enseignement, q2_organisation, q3_communication, q4_plateforme, q5_horaires,
    commentaires, date_soumission
  ) values (
    target_student, target_school, target_scores, nullif(trim(target_comment), ''),
    target_scores[3], target_scores[1], target_scores[2], target_scores[4], target_scores[5],
    nullif(trim(target_comment), ''), now()
  );
end;
$$;

commit;
