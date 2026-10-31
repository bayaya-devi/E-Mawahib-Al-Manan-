begin;

create or replace function public.can_message_user(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or target_user_id is null or actor = target_user_id then return false; end if;
  if not public.users_share_active_school(actor, target_user_id) then return false; end if;
  if public.is_administration() then return true; end if;
  if exists (select 1 from public.user_roles where user_id = target_user_id and role in ('admin','direction')) then return true; end if;
  if public.has_role('teacher') then return public.teacher_has_student(target_user_id); end if;
  if public.has_role('student') then
    return exists (
      select 1 from public.class_enrollments ce
      join public.class_teacher_assignments cta on cta.class_id = ce.class_id and cta.status = 'active'
      where ce.student_id = actor and ce.status = 'active' and cta.teacher_id = target_user_id
    );
  end if;
  if public.has_role('parent') then
    return exists (
      select 1 from public.family_relationships fr
      join public.class_enrollments ce on ce.student_id = fr.student_id and ce.status = 'active'
      join public.class_teacher_assignments cta on cta.class_id = ce.class_id and cta.status = 'active'
      where fr.parent_id = actor and fr.status = 'active' and cta.teacher_id = target_user_id
    );
  end if;
  return false;
end;
$$;

revoke all on function public.can_message_user(uuid) from public, anon;
grant execute on function public.can_message_user(uuid) to authenticated;

commit;
