begin;

create type public.conversation_kind as enum ('direct', 'group', 'support');
create type public.service_request_kind as enum (
  'leave', 'absence', 'equipment', 'incident', 'salary_problem',
  'administrative_question', 'complaint', 'class_change', 'technical_problem', 'other'
);
create type public.service_request_status as enum (
  'submitted', 'acknowledged', 'in_progress', 'waiting_user', 'resolved', 'rejected', 'cancelled'
);
create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.notification_category as enum (
  'message', 'request', 'assignment', 'learning', 'attendance', 'session', 'administration', 'system'
);

alter table public.user_notifications
  add column category public.notification_category not null default 'system',
  add column entity_type text,
  add column entity_id uuid,
  add column dedup_key text;
create unique index user_notifications_dedup_idx on public.user_notifications(user_id, dedup_key) where dedup_key is not null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  kind public.conversation_kind not null default 'direct',
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  client_id uuid not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.conversation_messages(id) on delete cascade,
  storage_path text not null check (storage_path !~ '(^|/)\.\.(/|$)'),
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/ogg','audio/webm')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create sequence public.service_request_reference_seq;
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  school_id uuid not null references public.schools(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid,
  kind public.service_request_kind not null,
  status public.service_request_status not null default 'submitted',
  priority public.request_priority not null default 'normal',
  title text not null check (char_length(trim(title)) between 3 and 120),
  details text check (details is null or char_length(details) <= 4000),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, client_id)
);

create table public.service_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_kind text not null check (event_kind in ('created','acknowledged','assigned','status_changed','commented','resolved','cancelled')),
  from_status public.service_request_status,
  to_status public.service_request_status,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.notification_category not null,
  in_app boolean not null default true,
  browser boolean not null default false,
  realtime boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table private.auth_rate_limits (
  rate_key text not null,
  bucket_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  primary key (rate_key, bucket_start)
);
revoke all on private.auth_rate_limits from public, anon, authenticated;

create index conversations_school_time_idx on public.conversations(school_id, last_message_at desc nulls last);
create index conversation_members_user_idx on public.conversation_members(user_id, archived_at, conversation_id);
create index conversation_messages_time_idx on public.conversation_messages(conversation_id, created_at desc);
create index service_requests_school_status_idx on public.service_requests(school_id, status, priority, created_at desc);
create index service_requests_requester_idx on public.service_requests(requester_id, created_at desc);
create index service_request_events_time_idx on public.service_request_events(request_id, created_at);

create trigger service_requests_set_updated_at before update on public.service_requests for each row execute function public.set_updated_at();

create function public.users_share_active_school(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.school_memberships a
    join public.school_memberships b on b.school_id = a.school_id
    where a.user_id = first_user and b.user_id = second_user
      and a.status = 'active' and b.status = 'active'
  );
$$;

create function public.require_administration_aal2()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
  if not public.is_administration() or coalesce(claims->>'aal', '') <> 'aal2' then raise exception 'administration_mfa_required'; end if;
end;
$$;

create or replace function public.can_manage_school(target_school_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'aal' = 'aal2'
    and (
      public.has_role('direction')
      or (public.has_role('admin') and public.is_school_member(target_school_id))
    );
$$;

create function public.auth_rate_limit_allowed(target_keys text[])
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if current_user not in ('service_role','postgres') then raise exception 'service_role_required'; end if;
  delete from private.auth_rate_limits where bucket_start < now() - interval '2 days';
  return not exists (select 1 from private.auth_rate_limits where rate_key = any(target_keys) and blocked_until > now());
end;
$$;

create function public.record_auth_rate_limit(target_keys text[], target_success boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_key text; bucket timestamptz := date_trunc('minute', now()) - (extract(minute from now())::integer % 15) * interval '1 minute';
begin
  if current_user not in ('service_role','postgres') then raise exception 'service_role_required'; end if;
  foreach target_key in array target_keys loop
    if target_success then delete from private.auth_rate_limits where rate_key = target_key;
    else
      insert into private.auth_rate_limits(rate_key, bucket_start, attempts, blocked_until) values(target_key, bucket, 1, null)
      on conflict (rate_key, bucket_start) do update set attempts = private.auth_rate_limits.attempts + 1,
        blocked_until = case when private.auth_rate_limits.attempts + 1 >= 6 then now() + interval '15 minutes' else private.auth_rate_limits.blocked_until end;
    end if;
  end loop;
end;
$$;

create function public.can_message_user(target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or target_user_id is null or actor = target_user_id then return false; end if;
  if not public.users_share_active_school(actor, target_user_id) then return false; end if;
  if public.is_administration() then return true; end if;
  if exists (select 1 from public.user_roles where user_id = target_user_id and role in ('admin','direction')) then return true; end if;
  if public.has_role('teacher') then
    return public.teacher_has_student(target_user_id)
      or exists (
        select 1 from public.family_relationships fr
        where fr.parent_id = target_user_id and fr.status = 'active' and public.teacher_has_student(fr.student_id)
      );
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

create function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.conversation_members where conversation_id = target_conversation_id and user_id = (select auth.uid()));
$$;

create function public.create_direct_conversation(target_user_id uuid, target_subject text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); school uuid; conversation uuid;
begin
  if not public.can_message_user(target_user_id) then raise exception 'messaging_relationship_denied'; end if;
  if char_length(trim(target_subject)) not between 1 and 120 then raise exception 'invalid_conversation_subject'; end if;
  select a.school_id into school from public.school_memberships a
  join public.school_memberships b on b.school_id = a.school_id
  where a.user_id = actor and b.user_id = target_user_id and a.status = 'active' and b.status = 'active' limit 1;
  select c.id into conversation from public.conversations c
  join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = actor
  join public.conversation_members theirs on theirs.conversation_id = c.id and theirs.user_id = target_user_id
  where c.school_id = school and c.kind = 'direct'
    and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) = 2
  limit 1;
  if conversation is not null then
    update public.conversation_members set archived_at = null where conversation_id = conversation and user_id = actor;
    return conversation;
  end if;
  insert into public.conversations(school_id, kind, subject, created_by)
  values(school, 'direct', trim(target_subject), actor) returning id into conversation;
  insert into public.conversation_members(conversation_id, user_id) values(conversation, actor), (conversation, target_user_id);
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'conversation.created', 'conversation', conversation, jsonb_build_object('kind', 'direct'));
  return conversation;
end;
$$;

create function public.send_conversation_message(target_conversation_id uuid, target_body text, target_client_id uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); message_id bigint; sent_recently integer;
begin
  if actor is null or not exists (select 1 from public.conversation_members where conversation_id = target_conversation_id and user_id = actor) then
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

create function public.mark_conversation_read(target_conversation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_members set last_read_at = now()
  where conversation_id = target_conversation_id and user_id = (select auth.uid());
  if not found then raise exception 'conversation_access_denied'; end if;
  update public.user_notifications set read_at = coalesce(read_at, now())
  where user_id = (select auth.uid()) and entity_type = 'conversation' and entity_id = target_conversation_id;
end;
$$;

create function public.register_message_attachment(
  target_message_id bigint, target_storage_path text, target_file_name text,
  target_mime_type text, target_size_bytes integer, target_checksum text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); attachment uuid; conversation uuid;
begin
  select conversation_id into conversation from public.conversation_messages where id = target_message_id and sender_id = actor;
  if conversation is null or not public.is_conversation_member(conversation) then raise exception 'message_attachment_denied'; end if;
  if target_storage_path not like conversation::text || '/' || actor::text || '/%' then raise exception 'invalid_attachment_path'; end if;
  insert into public.message_attachments(message_id, storage_path, file_name, mime_type, size_bytes, checksum)
  values(target_message_id, target_storage_path, target_file_name, target_mime_type, target_size_bytes, lower(target_checksum)) returning id into attachment;
  return attachment;
end;
$$;

create function public.archive_conversation(target_conversation_id uuid, target_archived boolean default true)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_members set archived_at = case when target_archived then now() else null end
  where conversation_id = target_conversation_id and user_id = (select auth.uid());
  if not found then raise exception 'conversation_access_denied'; end if;
end;
$$;

create function public.create_service_request(
  target_kind public.service_request_kind, target_title text, target_details text default null,
  target_priority public.request_priority default 'normal', target_client_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); school uuid; request uuid; reference text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if target_client_id is not null then
    select id into request from public.service_requests where requester_id = actor and client_id = target_client_id;
    if request is not null then return request; end if;
  end if;
  select school_id into school from public.school_memberships where user_id = actor and status = 'active' limit 1;
  if school is null then raise exception 'active_school_required'; end if;
  if char_length(trim(target_title)) not between 3 and 120 then raise exception 'invalid_request_title'; end if;
  reference := 'REQ-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.service_request_reference_seq')::text, 6, '0');
  insert into public.service_requests(reference, school_id, requester_id, client_id, kind, priority, title, details)
  values(reference, school, actor, target_client_id, target_kind, target_priority, trim(target_title), nullif(trim(target_details), '')) returning id into request;
  insert into public.service_request_events(request_id, actor_id, event_kind, to_status, note)
  values(request, actor, 'created', 'submitted', case when target_client_id is null then null else 'client:' || target_client_id::text end);
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'service_request.created', 'service_request', request, jsonb_build_object('reference', reference, 'kind', target_kind, 'priority', target_priority));
  insert into public.user_notifications(user_id, title, body, href, category, entity_type, entity_id, dedup_key)
  select distinct ur.user_id, 'طلب جديد ' || reference, trim(target_title), '/admin/communications?request=' || request,
    'request'::public.notification_category, 'service_request', request, 'request:new:' || request::text || ':' || ur.user_id::text
  from public.user_roles ur join public.school_memberships sm on sm.user_id = ur.user_id
  where ur.role in ('admin','direction') and sm.school_id = school and sm.status = 'active';
  return request;
end;
$$;

create function public.update_service_request(
  target_request_id uuid, target_status public.service_request_status,
  target_note text default null, target_assigned_to uuid default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); request public.service_requests%rowtype; old_status public.service_request_status;
begin
  select * into request from public.service_requests where id = target_request_id;
  if request.id is null then raise exception 'request_not_found'; end if;
  if actor = request.requester_id then
    if target_status <> 'cancelled' or request.status not in ('submitted','acknowledged') then raise exception 'request_transition_denied'; end if;
  elsif not public.can_manage_school(request.school_id) and request.assigned_to is distinct from actor then
    raise exception 'request_access_denied';
  end if;
  if public.can_manage_school(request.school_id) then perform public.require_administration_aal2(); end if;
  if target_assigned_to is not null and not public.can_manage_school(request.school_id) then raise exception 'request_assignment_denied'; end if;
  old_status := request.status;
  update public.service_requests set status = target_status,
    assigned_to = coalesce(target_assigned_to, assigned_to),
    resolved_at = case when target_status = 'resolved' then now() else null end
  where id = target_request_id;
  insert into public.service_request_events(request_id, actor_id, event_kind, from_status, to_status, note)
  values(target_request_id, actor, case when target_status = 'resolved' then 'resolved' when target_status = 'cancelled' then 'cancelled' else 'status_changed' end,
    old_status, target_status, nullif(trim(target_note), ''));
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, request.school_id, 'service_request.status_changed', 'service_request', target_request_id,
    jsonb_build_object('from', old_status, 'to', target_status, 'assigned_to', target_assigned_to));
  insert into public.user_notifications(user_id, title, body, href, category, entity_type, entity_id, dedup_key)
  values(request.requester_id, 'تحديث الطلب ' || request.reference, coalesce(nullif(trim(target_note), ''), 'تم تحديث حالة طلبك.'),
    '/requests?request=' || request.id, 'request', 'service_request', request.id,
    'request:' || target_request_id::text || ':' || target_status::text || ':' || extract(epoch from now())::bigint::text)
  on conflict do nothing;
end;
$$;

create function public.mark_notification_read(target_notification_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.user_notifications set read_at = coalesce(read_at, now())
  where id = target_notification_id and user_id = (select auth.uid());
  if not found then raise exception 'notification_access_denied'; end if;
end;
$$;

create function public.set_notification_preference(
  target_category public.notification_category, target_in_app boolean,
  target_browser boolean, target_realtime boolean
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notification_preferences(user_id, category, in_app, browser, realtime)
  values((select auth.uid()), target_category, target_in_app, target_browser, target_realtime)
  on conflict (user_id, category) do update set in_app = excluded.in_app, browser = excluded.browser,
    realtime = excluded.realtime, updated_at = now();
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.user_notifications';
    execute 'alter publication supabase_realtime add table public.conversation_messages';
    execute 'alter publication supabase_realtime add table public.service_request_events';
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values('message-attachments','message-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/ogg','audio/webm'])
      on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types$storage$;
  end if;
end $$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

create policy conversations_member_read on public.conversations for select to authenticated using (
  public.is_conversation_member(id)
);
create policy conversation_members_member_read on public.conversation_members for select to authenticated using (
  public.is_conversation_member(conversation_id)
);
create policy conversation_messages_member_read on public.conversation_messages for select to authenticated using (
  public.is_conversation_member(conversation_id)
);
create policy message_attachments_member_read on public.message_attachments for select to authenticated using (
  exists (select 1 from public.conversation_messages m where m.id = message_id and public.is_conversation_member(m.conversation_id))
);
create policy service_requests_scoped_read on public.service_requests for select to authenticated using (
  requester_id = (select auth.uid()) or assigned_to = (select auth.uid()) or public.can_manage_school(school_id)
);
create policy service_request_events_scoped_read on public.service_request_events for select to authenticated using (
  exists (select 1 from public.service_requests r where r.id = request_id and
    (r.requester_id = (select auth.uid()) or r.assigned_to = (select auth.uid()) or public.can_manage_school(r.school_id)))
);
create policy notification_preferences_own_read on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.conversations, public.conversation_members, public.conversation_messages, public.message_attachments,
  public.service_requests, public.service_request_events, public.notification_preferences, public.push_subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger on public.conversations, public.conversation_members,
  public.conversation_messages, public.message_attachments, public.service_requests, public.service_request_events,
  public.notification_preferences, public.push_subscriptions from authenticated;
grant select on public.conversations, public.conversation_members, public.conversation_messages, public.message_attachments,
  public.service_requests, public.service_request_events, public.notification_preferences to authenticated;

revoke all on function public.users_share_active_school(uuid, uuid) from public, anon;
revoke all on function public.require_administration_aal2() from public, anon;
revoke all on function public.auth_rate_limit_allowed(text[]) from public, anon, authenticated;
revoke all on function public.record_auth_rate_limit(text[], boolean) from public, anon, authenticated;
revoke all on function public.can_message_user(uuid) from public, anon;
revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.create_direct_conversation(uuid, text) from public, anon;
revoke all on function public.send_conversation_message(uuid, text, uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.register_message_attachment(bigint, text, text, text, integer, text) from public, anon;
revoke all on function public.archive_conversation(uuid, boolean) from public, anon;
revoke all on function public.create_service_request(public.service_request_kind, text, text, public.request_priority, uuid) from public, anon;
revoke all on function public.update_service_request(uuid, public.service_request_status, text, uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.set_notification_preference(public.notification_category, boolean, boolean, boolean) from public, anon;
grant execute on function public.require_administration_aal2(), public.can_message_user(uuid), public.is_conversation_member(uuid), public.create_direct_conversation(uuid, text),
  public.send_conversation_message(uuid, text, uuid), public.mark_conversation_read(uuid),
  public.register_message_attachment(bigint, text, text, text, integer, text),
  public.archive_conversation(uuid, boolean),
  public.create_service_request(public.service_request_kind, text, text, public.request_priority, uuid),
  public.update_service_request(uuid, public.service_request_status, text, uuid),
  public.mark_notification_read(uuid),
  public.set_notification_preference(public.notification_category, boolean, boolean, boolean) to authenticated;
grant execute on function public.auth_rate_limit_allowed(text[]), public.record_auth_rate_limit(text[], boolean) to service_role;

commit;
