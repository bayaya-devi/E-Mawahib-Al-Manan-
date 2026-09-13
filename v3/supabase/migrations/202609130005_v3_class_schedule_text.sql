begin;

alter table public.classes add column if not exists schedule_text text;

create or replace function public.admin_save_class(payload jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := (select auth.uid()); school uuid; target uuid; teacher uuid; student uuid; slot jsonb;
  requested_students uuid[] := array(select jsonb_array_elements_text(coalesce(payload->'student_ids','[]'::jsonb))::uuid);
  schedule_note text := nullif(trim(coalesce(payload->>'schedule_text','')), '');
begin
  perform public.require_administration_aal2();
  select school_id into school from public.school_memberships where user_id=actor and status='active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'class_scope_denied'; end if;
  if char_length(trim(coalesce(payload->>'name',''))) not between 1 and 120 then raise exception 'invalid_class_name'; end if;
  if schedule_note is not null and char_length(schedule_note) > 2000 then raise exception 'invalid_schedule_text'; end if;
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
    insert into public.classes(school_id,name,level,capacity,status,schedule_text)
    values(school,trim(payload->>'name'),nullif(trim(payload->>'level'),''),nullif(payload->>'capacity','')::integer,'active',schedule_note) returning id into target;
  else
    if not exists(select 1 from public.classes where id=target and school_id=school) then raise exception 'class_scope_denied'; end if;
    update public.classes set name=trim(payload->>'name'),level=nullif(trim(payload->>'level'),''),
      capacity=nullif(payload->>'capacity','')::integer,schedule_text=schedule_note,
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
  values(actor,school,'class.saved','class',target,jsonb_build_object('teacher_id',teacher,'student_count',cardinality(requested_students),'schedule_text',schedule_note));
  return target;
end;
$$;

create or replace function public.admin_send_class_schedule(target_class_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); school uuid; conversation uuid; message_id bigint; body text; class_name text; teacher_name text; schedule_note text;
begin
  perform public.require_administration_aal2();
  select c.school_id,c.name,c.schedule_text into school,class_name,schedule_note from public.classes c where c.id=target_class_id;
  if school is null or not public.can_manage_school(school) then raise exception 'class_scope_denied'; end if;
  select p.display_name into teacher_name from public.class_teacher_assignments cta join public.profiles p on p.id=cta.teacher_id
  where cta.class_id=target_class_id and cta.status='active' order by cta.assigned_at limit 1;
  select 'القسم: '||class_name||E'\nالأستاذ: '||coalesce(teacher_name,'—')||E'\n\nمواعيد الحصص:\n'||coalesce(schedule_note, string_agg(
    (array['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'])[s.day_of_week+1]||': '||to_char(s.starts_at,'HH24:MI')||'–'||to_char(s.ends_at,'HH24:MI'), E'\n' order by s.day_of_week,s.starts_at),'—')
  into body from public.class_schedule_slots s where s.class_id=target_class_id;
  insert into public.conversations(school_id,kind,subject,created_by) values(school,'group','جدول الحصص · '||class_name,actor) returning id into conversation;
  insert into public.conversation_members(conversation_id,user_id)
  select conversation,user_id from (
    select actor user_id union
    select student_id from public.class_enrollments where class_id=target_class_id and status='active' union
    select teacher_id from public.class_teacher_assignments where class_id=target_class_id and status='active'
  ) recipients;
  insert into public.conversation_messages(conversation_id,sender_id,body,client_id)
  values(conversation,actor,body,gen_random_uuid()) returning id into message_id;
  update public.conversations set last_message_at=now() where id=conversation;
  insert into public.user_notifications(user_id,title,body,href,category,entity_type,entity_id,dedup_key)
  select cm.user_id,'جدول الحصص',body,'/messages?conversation='||conversation,'message','conversation',conversation,
    'class-schedule:'||conversation||':'||cm.user_id
  from public.conversation_members cm where cm.conversation_id=conversation and cm.user_id<>actor;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,school,'class.schedule_sent','class',target_class_id,jsonb_build_object('conversation_id',conversation,'message_id',message_id));
  return conversation;
end;
$$;

revoke all on function public.admin_save_class(jsonb), public.admin_send_class_schedule(uuid) from public,anon;
grant execute on function public.admin_save_class(jsonb), public.admin_send_class_schedule(uuid) to authenticated;

commit;
