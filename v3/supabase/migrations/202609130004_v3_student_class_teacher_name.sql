begin;

create or replace function public.get_own_class_teacher_name()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  target_student uuid;
  teacher_name text;
begin
  if actor is null then
    return null;
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
    return null;
  end if;

  select p.display_name into teacher_name
  from public.class_enrollments ce
  join public.class_teacher_assignments cta
    on cta.class_id = ce.class_id
    and cta.status = 'active'
    and cta.assignment_kind = 'primary'
  join public.profiles p on p.id = cta.teacher_id and p.status = 'active'
  where ce.student_id = target_student and ce.status = 'active'
  order by cta.assigned_at asc
  limit 1;

  return teacher_name;
end;
$$;

revoke all on function public.get_own_class_teacher_name() from public, anon;
grant execute on function public.get_own_class_teacher_name() to authenticated;

commit;
