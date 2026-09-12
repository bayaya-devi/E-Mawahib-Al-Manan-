begin;

create or replace function public.admin_set_student_relations(
  target_student_id uuid,
  target_class_id uuid,
  target_teacher_ids uuid[]
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  school uuid;
  actor uuid := (select auth.uid());
  teacher uuid;
  requested_teachers uuid[] := coalesce(target_teacher_ids, '{}');
begin
  perform public.require_administration_aal2();

  select school_id into school
  from public.school_memberships
  where user_id = actor and status = 'active'
  limit 1;

  if school is null or not public.can_manage_school(school)
    or not exists (
      select 1 from public.school_memberships
      where user_id = target_student_id and school_id = school and status = 'active'
    ) then
    raise exception 'student_scope_denied';
  end if;

  if not exists (
    select 1 from public.classes
    where id = target_class_id and school_id = school and status = 'active'
  ) then
    raise exception 'class_scope_denied';
  end if;

  if cardinality(requested_teachers) = 0 then
    select teacher_id into teacher
    from public.class_teacher_assignments
    where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
    limit 1;
    if teacher is null then
      raise exception 'teacher_required';
    end if;
    requested_teachers := array[teacher];
  end if;

  if exists (
    select 1
    from unnest(requested_teachers) requested(id)
    left join public.teacher_profiles tp on tp.user_id = requested.id
    left join public.school_memberships sm
      on sm.user_id = requested.id and sm.school_id = school and sm.status = 'active'
    where tp.user_id is null or sm.user_id is null
  ) then
    raise exception 'teacher_scope_denied';
  end if;

  foreach teacher in array requested_teachers loop
    if not exists (
      select 1 from public.class_teacher_assignments
      where class_id = target_class_id and teacher_id = teacher and status = 'active'
    ) then
      insert into public.class_teacher_assignments(
        class_id, teacher_id, assignment_kind, status, created_by
      ) values (
        target_class_id,
        teacher,
        case when exists (
          select 1 from public.class_teacher_assignments
          where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
        ) then 'assistant'::public.teacher_assignment_kind else 'primary'::public.teacher_assignment_kind end,
        'active',
        actor
      );
    end if;
  end loop;

  update public.class_enrollments
  set status = 'withdrawn', ended_at = now()
  where student_id = target_student_id and status = 'active' and class_id <> target_class_id;

  if exists (
    select 1 from public.class_enrollments
    where class_id = target_class_id and student_id = target_student_id and status = 'active'
  ) then
    update public.class_enrollments
    set ended_at = null
    where class_id = target_class_id and student_id = target_student_id and status = 'active';
  else
    insert into public.class_enrollments(class_id, student_id, status, ended_at, created_by)
    values(target_class_id, target_student_id, 'active', null, actor);
  end if;

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(
    actor,
    school,
    'admin.student_relations_updated',
    'student',
    target_student_id,
    jsonb_build_object('class_id', target_class_id, 'teacher_ids', requested_teachers)
  );
end;
$$;

commit;
