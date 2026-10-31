begin;

-- Keep the original main teacher when historical imports created several primaries.
with ranked as (
  select id,
    row_number() over (partition by class_id order by assigned_at asc, id asc) as position
  from public.class_teacher_assignments
  where status = 'active' and assignment_kind = 'primary'
)
update public.class_teacher_assignments assignment
set assignment_kind = 'assistant'
from ranked
where assignment.id = ranked.id and ranked.position > 1;

create unique index if not exists class_active_primary_teacher_unique
  on public.class_teacher_assignments(class_id)
  where status = 'active' and assignment_kind = 'primary';

create index if not exists class_enrollments_active_student_idx
  on public.class_enrollments(student_id, class_id)
  where status = 'active';

create index if not exists class_teacher_assignments_active_teacher_idx
  on public.class_teacher_assignments(teacher_id, class_id)
  where status = 'active';

create or replace function public.admin_set_student_relations(
  target_student_id uuid,
  target_class_id uuid,
  target_teacher_ids uuid[]
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid());
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=actor and status='active' limit 1;
  if school is null or not public.can_manage_school(school)
    or not exists(select 1 from public.school_memberships where user_id=target_student_id and school_id=school and status='active') then
    raise exception 'student_scope_denied';
  end if;
  if not exists(select 1 from public.classes where id=target_class_id and school_id=school and status='active') then raise exception 'class_scope_denied'; end if;
  if not exists(select 1 from public.class_teacher_assignments where class_id=target_class_id and status='active' and assignment_kind='primary') then
    raise exception 'class_primary_teacher_required';
  end if;

  update public.class_enrollments
  set status='withdrawn', ended_at=now()
  where student_id=target_student_id and status='active' and class_id<>target_class_id;
  if exists(select 1 from public.class_enrollments where class_id=target_class_id and student_id=target_student_id and status='active') then
    update public.class_enrollments set ended_at=null where class_id=target_class_id and student_id=target_student_id and status='active';
  else
    insert into public.class_enrollments(class_id,student_id,status,ended_at,created_by)
    values(target_class_id,target_student_id,'active',null,actor);
  end if;

  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'admin.student_relations_updated','student',target_student_id,jsonb_build_object('class_id',target_class_id));
end; $$;

create or replace function public.admin_set_teacher_classes(target_teacher_id uuid, target_class_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); target_class uuid;
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=actor and status='active' limit 1;
  if school is null or not public.can_manage_school(school)
    or not exists(select 1 from public.school_memberships where user_id=target_teacher_id and school_id=school and status='active') then
    raise exception 'teacher_scope_denied';
  end if;
  if exists(select 1 from unnest(coalesce(target_class_ids,'{}')) requested(id) left join public.classes c on c.id=requested.id and c.school_id=school and c.status='active' where c.id is null) then raise exception 'class_scope_denied'; end if;
  update public.class_teacher_assignments set status='archived', ended_at=now()
    where teacher_id=target_teacher_id and status='active' and not (class_id=any(coalesce(target_class_ids,'{}')));
  foreach target_class in array coalesce(target_class_ids,'{}') loop
    if exists(select 1 from public.class_teacher_assignments where class_id=target_class and teacher_id=target_teacher_id and status='active') then
      continue;
    end if;
    insert into public.class_teacher_assignments(class_id,teacher_id,assignment_kind,status,created_by)
    values(target_class,target_teacher_id,
      case when exists(select 1 from public.class_teacher_assignments where class_id=target_class and status='active' and assignment_kind='primary') then 'assistant'::public.teacher_assignment_kind else 'primary'::public.teacher_assignment_kind end,
      'active',actor);
  end loop;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'admin.teacher_classes_updated','teacher',target_teacher_id,jsonb_build_object('classes',target_class_ids));
end; $$;

create or replace function public.admin_save_class(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := (select auth.uid()); school uuid; target uuid; teacher uuid; student uuid; slot jsonb;
  requested_students uuid[] := array(select jsonb_array_elements_text(coalesce(payload->'student_ids','[]'::jsonb))::uuid);
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=actor and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'class_scope_denied'; end if;
  if char_length(trim(coalesce(payload->>'name',''))) not between 1 and 120 then raise exception 'invalid_class_name'; end if;
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
    where sp.user_id is null or sm.user_id is null
  ) then raise exception 'student_scope_denied'; end if;
  if target is null then
    insert into public.classes(school_id,name,level,capacity,status)
    values(school,trim(payload->>'name'),nullif(trim(payload->>'level'),''),nullif(payload->>'capacity','')::integer,'active') returning id into target;
  else
    if not exists(select 1 from public.classes where id=target and school_id=school) then raise exception 'class_scope_denied'; end if;
    update public.classes set name=trim(payload->>'name'),level=nullif(trim(payload->>'level'),''),
      capacity=nullif(payload->>'capacity','')::integer,status=coalesce(nullif(payload->>'status','')::public.membership_status,status),updated_at=now()
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
  values(actor,school,'class.saved','class',target,jsonb_build_object('teacher_id',teacher,'student_count',cardinality(requested_students)));
  return target;
end;
$$;

commit;
