begin;

create or replace function public.get_own_teacher_follow_up()
returns table(
  id uuid,
  recorded_at timestamptz,
  teacher_name text,
  class_name text,
  surah_number smallint,
  verse_from smallint,
  verse_to smallint,
  appreciation text,
  comment text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_student uuid;
begin
  if actor is null then return; end if;

  if public.has_role('student') then
    target_student := actor;
  elsif public.has_role('parent') then
    select fr.student_id into target_student
    from public.family_relationships fr
    where fr.parent_id = actor and fr.status = 'active'
    order by fr.is_primary desc, fr.created_at asc
    limit 1;
  else
    return;
  end if;

  return query
  select tr.id, tr.recorded_at, coalesce(p.display_name, 'الأستاذ(ة)'), c.name,
    tr.surah_number, tr.verse_from, tr.verse_to, tr.appreciation::text, tr.comment
  from public.teacher_recitations tr
  join public.teacher_session_runs run on run.id = tr.run_id
  join public.classes c on c.id = run.class_id
  left join public.profiles p on p.id = tr.recorded_by
  where tr.student_id = target_student
  order by tr.recorded_at desc
  limit 500;
end;
$$;

revoke all on function public.get_own_teacher_follow_up() from public, anon;
grant execute on function public.get_own_teacher_follow_up() to authenticated;

commit;
