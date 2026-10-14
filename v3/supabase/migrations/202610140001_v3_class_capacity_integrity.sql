begin;

-- Serialize enrollment changes on the class row so two concurrent requests
-- cannot both pass the capacity check.
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
  class_capacity integer;
  active_students integer;
  already_enrolled boolean;
  requested_teachers uuid[] := array(
    select distinct value from unnest(coalesce(target_teacher_ids, '{}')) value
  );
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

  select capacity into class_capacity
  from public.classes
  where id = target_class_id and school_id = school and status = 'active'
  for update;
  if not found then raise exception 'class_scope_denied'; end if;

  select exists(
    select 1 from public.class_enrollments
    where class_id = target_class_id and student_id = target_student_id and status = 'active'
  ) into already_enrolled;
  if class_capacity is not null and not already_enrolled then
    select count(*)::integer into active_students
    from public.class_enrollments
    where class_id = target_class_id and status = 'active';
    if active_students >= class_capacity then raise exception 'class_capacity_exceeded'; end if;
  end if;

  if cardinality(requested_teachers) = 0 then
    select teacher_id into teacher
    from public.class_teacher_assignments
    where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
    limit 1;
    if teacher is not null then requested_teachers := array[teacher]; end if;
  end if;

  if cardinality(requested_teachers) > 0 and exists (
    select 1
    from unnest(requested_teachers) requested(id)
    left join public.teacher_profiles tp on tp.user_id = requested.id
    left join public.school_memberships sm
      on sm.user_id = requested.id and sm.school_id = school and sm.status = 'active'
    where tp.user_id is null or sm.user_id is null
  ) then raise exception 'teacher_scope_denied'; end if;

  foreach teacher in array requested_teachers loop
    if not exists (
      select 1 from public.class_teacher_assignments
      where class_id = target_class_id and teacher_id = teacher and status = 'active'
    ) then
      insert into public.class_teacher_assignments(
        class_id, teacher_id, assignment_kind, status, created_by
      ) values (
        target_class_id, teacher,
        case when exists (
          select 1 from public.class_teacher_assignments
          where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
        ) then 'assistant'::public.teacher_assignment_kind else 'primary'::public.teacher_assignment_kind end,
        'active', actor
      );
    end if;
  end loop;

  update public.class_enrollments
  set status = 'withdrawn', ended_at = now()
  where student_id = target_student_id and status = 'active' and class_id <> target_class_id;

  if not already_enrolled then
    insert into public.class_enrollments(class_id, student_id, status, ended_at, created_by)
    values(target_class_id, target_student_id, 'active', null, actor);
  end if;

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'admin.student_relations_updated', 'student', target_student_id,
    jsonb_build_object('class_id', target_class_id, 'teacher_ids', requested_teachers));
end;
$$;

create or replace function public.admin_save_class(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := (select auth.uid()); school uuid; target uuid; teacher uuid; student uuid; slot jsonb;
  requested_students uuid[] := array(
    select distinct value::uuid
    from jsonb_array_elements_text(coalesce(payload->'student_ids','[]'::jsonb)) value
  );
  schedule_note text := nullif(trim(coalesce(payload->>'schedule_text','')), '');
  requested_capacity integer := nullif(payload->>'capacity','')::integer;
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=actor and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'class_scope_denied'; end if;
  if char_length(trim(coalesce(payload->>'name',''))) not between 1 and 120 then raise exception 'invalid_class_name'; end if;
  if schedule_note is not null and char_length(schedule_note) > 2000 then raise exception 'invalid_schedule_text'; end if;
  if requested_capacity is not null and cardinality(requested_students) > requested_capacity then
    raise exception 'class_capacity_exceeded';
  end if;
  teacher := nullif(payload->>'teacher_id','')::uuid;
  target := nullif(payload->>'id','')::uuid;
  if coalesce(payload->>'status','active') = 'active' and teacher is null then raise exception 'primary_teacher_required'; end if;
  if teacher is not null and not exists (
    select 1 from public.teacher_profiles tp join public.school_memberships sm on sm.user_id=tp.user_id
    where tp.user_id=teacher and sm.school_id=school and sm.status='active'
  ) then raise exception 'teacher_scope_denied'; end if;
  if exists (
    select 1 from unnest(requested_students) requested(id)
    left join public.student_profiles sp on sp.user_id=requested.id
    left join public.school_memberships sm on sm.user_id=requested.id and sm.school_id=school and sm.status='active'
    left join public.class_enrollments existing on existing.class_id=target and existing.student_id=requested.id and existing.status='active'
    where sp.user_id is null or (sm.user_id is null and existing.student_id is null)
  ) then raise exception 'student_scope_denied'; end if;
  if target is null then
    insert into public.classes(school_id,name,level,capacity,status,schedule_text)
    values(school,trim(payload->>'name'),nullif(trim(payload->>'level'),''),requested_capacity,'active',schedule_note)
    returning id into target;
  else
    perform 1 from public.classes where id=target and school_id=school for update;
    if not found then raise exception 'class_scope_denied'; end if;
    update public.classes set name=trim(payload->>'name'),level=nullif(trim(payload->>'level'),''),
      capacity=requested_capacity,schedule_text=schedule_note,
      status=coalesce(nullif(payload->>'status','')::public.membership_status,status),updated_at=now()
    where id=target;
  end if;
  update public.class_teacher_assignments set status='archived',ended_at=now()
  where class_id=target and status='active' and (teacher is null or teacher_id<>teacher);
  if teacher is not null and not exists(select 1 from public.class_teacher_assignments where class_id=target and teacher_id=teacher and status='active') then
    insert into public.class_teacher_assignments(class_id,teacher_id,assignment_kind,status,created_by)
    values(target,teacher,'primary','active',actor);
  end if;
  update public.class_enrollments set status='withdrawn',ended_at=now()
  where class_id=target and status='active' and not(student_id=any(requested_students));
  foreach student in array requested_students loop
    update public.class_enrollments set status='withdrawn',ended_at=now()
    where student_id=student and status='active' and class_id<>target;
    if not exists(select 1 from public.class_enrollments where class_id=target and student_id=student and status='active') then
      insert into public.class_enrollments(class_id,student_id,status,created_by) values(target,student,'active',actor);
    end if;
  end loop;
  delete from public.class_schedule_slots where class_id=target;
  for slot in select value from jsonb_array_elements(coalesce(payload->'schedule','[]'::jsonb)) loop
    insert into public.class_schedule_slots(class_id,day_of_week,starts_at,ends_at,room)
    values(target,(slot->>'day_of_week')::smallint,(slot->>'starts_at')::time,(slot->>'ends_at')::time,nullif(trim(slot->>'room'),''));
  end loop;
  if coalesce(payload->>'status','active') = 'archived' then
    update public.class_teacher_assignments set status='archived',ended_at=now() where class_id=target and status='active';
    update public.class_enrollments set status='withdrawn',ended_at=now() where class_id=target and status='active';
  end if;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'class.saved','class',target,
    jsonb_build_object('teacher_id',teacher,'student_count',cardinality(requested_students),'schedule_text',schedule_note));
  return target;
end;
$$;

revoke all on function public.admin_set_student_relations(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.admin_save_class(jsonb) from public, anon;
grant execute on function public.admin_set_student_relations(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.admin_save_class(jsonb) to authenticated;

commit;
