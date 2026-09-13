begin;

create or replace function public.get_own_class_dashboard_details()
returns table(
  class_id uuid,
  class_name text,
  teacher_id uuid,
  teacher_name text,
  schedule_text text
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
  select c.id, c.name, p.id, p.display_name, c.schedule_text
  from public.class_enrollments ce
  join public.classes c on c.id = ce.class_id and c.status = 'active'
  left join lateral (
    select cta.teacher_id
    from public.class_teacher_assignments cta
    where cta.class_id = c.id and cta.status = 'active' and cta.assignment_kind = 'primary'
    order by cta.assigned_at asc
    limit 1
  ) primary_teacher on true
  left join public.profiles p on p.id = primary_teacher.teacher_id and p.status = 'active'
  where ce.student_id = target_student and ce.status = 'active'
  order by ce.enrolled_at desc
  limit 1;
end;
$$;

revoke all on function public.get_own_class_dashboard_details() from public, anon;
grant execute on function public.get_own_class_dashboard_details() to authenticated;

commit;
