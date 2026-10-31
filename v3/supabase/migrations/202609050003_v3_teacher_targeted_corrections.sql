begin;

create or replace function public.teacher_start_class_session(target_class_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := (select auth.uid());
  course uuid;
  existing_run uuid;
begin
  if actor is null or not public.has_role('teacher') then raise exception 'teacher_session_required'; end if;
  select id into existing_run from public.teacher_session_runs
  where teacher_id = actor and status in ('in_progress', 'report_pending') limit 1;
  if existing_run is not null then return existing_run; end if;
  if not public.teacher_owns_class(target_class_id) then raise exception 'class_not_assigned'; end if;
  if not exists (
    select 1 from public.class_enrollments
    where class_id = target_class_id and status = 'active'
  ) then raise exception 'class_has_no_students'; end if;
  insert into public.course_sessions(class_id, teacher_id, starts_at, ends_at, title, status)
  values(target_class_id, actor, now(), now() + interval '2 hours', 'حصة', 'scheduled')
  returning id into course;
  return public.teacher_start_session(course);
end;
$$;

create or replace function public.teacher_can_access_conversation(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_conversation_member(target_conversation_id)
    and (
      public.is_administration()
      or not public.has_role('teacher')
      or exists (
        select 1 from public.conversation_members cm
        join public.user_roles ur on ur.user_id = cm.user_id and ur.role in ('admin', 'direction')
        where cm.conversation_id = target_conversation_id and cm.user_id <> (select auth.uid())
      )
    );
$$;

create or replace function public.can_message_user(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or target_user_id is null or actor = target_user_id then return false; end if;
  if not public.users_share_active_school(actor, target_user_id) then return false; end if;
  if public.is_administration() then return true; end if;
  if public.has_role('teacher') then
    return exists (select 1 from public.user_roles where user_id = target_user_id and role in ('admin','direction'));
  end if;
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

create or replace function public.send_conversation_message(target_conversation_id uuid, target_body text, target_client_id uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); message_id bigint; sent_recently integer;
begin
  if actor is null or not public.teacher_can_access_conversation(target_conversation_id) then
    raise exception 'conversation_access_denied';
  end if;
  if char_length(trim(target_body)) not between 1 and 4000 then raise exception 'invalid_message_body'; end if;
  select id into message_id from public.conversation_messages where sender_id = actor and client_id = target_client_id;
  if message_id is not null then return message_id; end if;
  select count(*) into sent_recently from public.conversation_messages where sender_id = actor and created_at > now() - interval '1 minute';
  if sent_recently >= 30 then raise exception 'message_rate_limit'; end if;
  insert into public.conversation_messages(conversation_id, sender_id, body, client_id)
  values(target_conversation_id, actor, trim(target_body), target_client_id) returning id into message_id;
  update public.conversations set last_message_at = now() where id = target_conversation_id;
  update public.conversation_members set last_read_at = now(), archived_at = null where conversation_id = target_conversation_id and user_id = actor;
  insert into public.user_notifications(user_id, title, body, href, category, entity_type, entity_id, dedup_key)
  select cm.user_id, 'رسالة جديدة', left(trim(target_body), 180), '/messages?conversation=' || target_conversation_id,
    'message'::public.notification_category, 'conversation', target_conversation_id, 'message:' || message_id::text || ':' || cm.user_id::text
  from public.conversation_members cm
  left join public.notification_preferences np on np.user_id = cm.user_id and np.category = 'message'
  where cm.conversation_id = target_conversation_id and cm.user_id <> actor and coalesce(np.in_app, true);
  return message_id;
end;
$$;

drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations for select to authenticated using (
  public.teacher_can_access_conversation(id)
);
drop policy if exists conversation_members_member_read on public.conversation_members;
create policy conversation_members_member_read on public.conversation_members for select to authenticated using (
  public.teacher_can_access_conversation(conversation_id)
);
drop policy if exists conversation_messages_member_read on public.conversation_messages;
create policy conversation_messages_member_read on public.conversation_messages for select to authenticated using (
  public.teacher_can_access_conversation(conversation_id)
);
drop policy if exists message_attachments_member_read on public.message_attachments;
create policy message_attachments_member_read on public.message_attachments for select to authenticated using (
  exists (select 1 from public.conversation_messages m where m.id = message_id and public.teacher_can_access_conversation(m.conversation_id))
);

revoke all on function public.teacher_start_class_session(uuid) from public, anon;
revoke all on function public.teacher_can_access_conversation(uuid) from public, anon;
grant execute on function public.teacher_start_class_session(uuid) to authenticated;
grant execute on function public.teacher_can_access_conversation(uuid) to authenticated;

commit;
