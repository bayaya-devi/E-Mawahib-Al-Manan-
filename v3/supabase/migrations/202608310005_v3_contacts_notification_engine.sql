begin;

create type public.contact_kind as enum ('email', 'phone');
create type public.contact_label as enum ('personal', 'professional', 'parent', 'emergency', 'other');
create type public.contact_verification_status as enum ('unverified', 'pending', 'verified', 'disabled');
create type public.notification_priority as enum ('low', 'normal', 'important', 'urgent');
create type public.notification_channel as enum ('in_app', 'push', 'email', 'sms', 'whatsapp');
create type public.notification_delivery_status as enum ('pending', 'processing', 'sent', 'delivered', 'failed', 'dead_letter', 'cancelled');

create table public.contact_points (
  id uuid primary key default gen_random_uuid(),
  kind public.contact_kind not null,
  normalized_value text not null,
  display_value text not null,
  country_code text,
  verification_status public.contact_verification_status not null default 'unverified',
  verified_at timestamptz,
  status public.membership_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind, normalized_value),
  check (
    (kind = 'phone' and normalized_value ~ '^\+[1-9][0-9]{7,14}$' and country_code ~ '^[A-Z]{2}$')
    or (kind = 'email' and normalized_value = lower(normalized_value) and normalized_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  check ((verification_status = 'verified') = (verified_at is not null))
);

create table public.user_contact_links (
  id uuid primary key default gen_random_uuid(),
  contact_point_id uuid not null references public.contact_points(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label public.contact_label not null default 'personal',
  relationship text,
  is_primary boolean not null default false,
  notification_enabled boolean not null default true,
  use_for_login boolean not null default false,
  use_for_notifications boolean not null default true,
  is_emergency boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_point_id, user_id),
  check (relationship is null or char_length(relationship) <= 80)
);
create unique index user_contact_links_primary_kind_idx on public.user_contact_links(user_id, is_primary)
  where is_primary;
create index user_contact_links_user_idx on public.user_contact_links(user_id, notification_enabled);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null check (char_length(device_key) between 16 and 120),
  name text not null check (char_length(trim(name)) between 1 and 100),
  platform text,
  browser text,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_key)
);
create index user_devices_user_idx on public.user_devices(user_id, enabled, last_seen_at desc);

alter table public.notification_preferences
  add column push boolean not null default false,
  add column email boolean not null default false,
  add column sms boolean not null default false,
  add column whatsapp boolean not null default false,
  add column digest_frequency text not null default 'immediate' check (digest_frequency in ('immediate','daily','weekly','never')),
  add column quiet_hours_start time,
  add column quiet_hours_end time;

create table public.notification_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  minimum_priority public.notification_priority not null default 'normal',
  mandatory_channels public.notification_channel[] not null default '{in_app}',
  notify_student boolean not null default true,
  notify_guardians boolean not null default false,
  bypass_quiet_hours boolean not null default false,
  escalation_after interval,
  cooldown interval not null default interval '5 minutes',
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, event_type)
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  locale public.public_locale not null,
  channel public.notification_channel not null,
  title_template text not null check (char_length(title_template) between 1 and 160),
  body_template text not null check (char_length(body_template) between 1 and 4000),
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct(school_id, event_type, locale, channel)
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  category public.notification_category not null default 'system',
  priority public.notification_priority not null default 'normal',
  subject_user_id uuid references public.profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  entity_type text,
  entity_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  href text,
  payload jsonb not null default '{}',
  dedup_key text not null,
  scheduled_at timestamptz not null default now(),
  expires_at timestamptz,
  processed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(dedup_key),
  check (expires_at is null or expires_at > scheduled_at)
);
create index notification_events_queue_idx on public.notification_events(processed_at, scheduled_at) where processed_at is null;

create table public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  href text,
  audience jsonb not null,
  channels public.notification_channel[] not null default '{in_app}',
  priority public.notification_priority not null default 'normal',
  locale public.public_locale not null default 'ar',
  status text not null default 'draft' check (status in ('draft','scheduled','processing','sent','partially_failed','cancelled')),
  scheduled_at timestamptz,
  expires_at timestamptz,
  estimated_recipients integer not null default 0 check (estimated_recipients >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_recipients (
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default 'direct',
  created_at timestamptz not null default now(),
  primary key(event_id, user_id)
);

alter table public.user_notifications
  add column event_id uuid references public.notification_events(id) on delete set null,
  add column priority public.notification_priority not null default 'normal',
  add column archived_at timestamptz,
  add column expires_at timestamptz;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null,
  contact_point_id uuid references public.contact_points(id) on delete set null,
  device_id uuid references public.user_devices(id) on delete set null,
  provider text,
  status public.notification_delivery_status not null default 'pending',
  masked_destination text,
  idempotency_key text not null unique,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_deliveries_worker_idx on public.notification_deliveries(status, next_attempt_at)
  where status in ('pending','failed','processing');

create function public.mask_contact_value(target_kind public.contact_kind, target_value text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when target_kind = 'email' then regexp_replace(target_value, '^(.{1,2}).*(@.*)$', '\1***\2')
    else left(target_value, greatest(3, length(target_value) - 7)) || '****' || right(target_value, 3)
  end;
$$;

create function public.list_my_contacts()
returns table(link_id uuid, kind public.contact_kind, masked_value text, label public.contact_label,
  is_primary boolean, notification_enabled boolean, use_for_login boolean, use_for_notifications boolean,
  is_emergency boolean, verification_status public.contact_verification_status)
language sql stable security definer set search_path = public, pg_temp as $$
  select l.id, c.kind, public.mask_contact_value(c.kind, c.normalized_value), l.label, l.is_primary,
    l.notification_enabled, l.use_for_login, l.use_for_notifications, l.is_emergency, c.verification_status
  from public.user_contact_links l join public.contact_points c on c.id = l.contact_point_id
  where l.user_id = (select auth.uid()) and c.status = 'active'
  order by l.is_primary desc, l.created_at;
$$;

create function public.save_user_contact(
  target_user_id uuid, target_kind public.contact_kind, target_normalized_value text, target_display_value text,
  target_country_code text, target_label public.contact_label, target_is_primary boolean default false,
  target_notification_enabled boolean default true, target_use_for_login boolean default false,
  target_use_for_notifications boolean default true, target_is_emergency boolean default false,
  target_relationship text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); contact uuid; link uuid; normalized text := trim(target_normalized_value);
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if actor <> target_user_id then
    if not public.can_manage_user(target_user_id) then raise exception 'contact_access_denied'; end if;
    perform public.require_administration_aal2();
  end if;
  if target_kind = 'email' then normalized := lower(normalized); end if;
  if (target_kind = 'phone' and (normalized !~ '^\+[1-9][0-9]{7,14}$' or target_country_code !~ '^[A-Z]{2}$'))
    or (target_kind = 'email' and normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'invalid_contact_value';
  end if;
  insert into public.contact_points(kind, normalized_value, display_value, country_code, created_by)
  values(target_kind, normalized, trim(target_display_value), case when target_kind = 'phone' then upper(target_country_code) else null end, actor)
  on conflict(kind, normalized_value) do update set display_value = excluded.display_value, updated_at = now()
  returning id into contact;
  if target_is_primary then update public.user_contact_links set is_primary = false, updated_at = now() where user_id = target_user_id and is_primary; end if;
  insert into public.user_contact_links(contact_point_id, user_id, label, relationship, is_primary, notification_enabled,
    use_for_login, use_for_notifications, is_emergency, created_by)
  values(contact, target_user_id, target_label, nullif(trim(target_relationship), ''), target_is_primary, target_notification_enabled,
    target_use_for_login, target_use_for_notifications, target_is_emergency, actor)
  on conflict(contact_point_id, user_id) do update set label = excluded.label, relationship = excluded.relationship,
    is_primary = excluded.is_primary, notification_enabled = excluded.notification_enabled, use_for_login = excluded.use_for_login,
    use_for_notifications = excluded.use_for_notifications, is_emergency = excluded.is_emergency, updated_at = now()
  returning id into link;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'contact.saved', 'user_contact_link', link, jsonb_build_object('target_user_id', target_user_id, 'kind', target_kind));
  return link;
end;
$$;

create function public.remove_user_contact(target_link_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); owner uuid;
begin
  select user_id into owner from public.user_contact_links where id = target_link_id;
  if owner is null then raise exception 'contact_not_found'; end if;
  if actor <> owner then
    if not public.can_manage_user(owner) then raise exception 'contact_access_denied'; end if;
    perform public.require_administration_aal2();
  end if;
  delete from public.user_contact_links where id = target_link_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'contact.unlinked', 'user_contact_link', target_link_id, jsonb_build_object('target_user_id', owner));
end;
$$;

create function public.set_contact_verification(target_contact_id uuid, target_status public.contact_verification_status)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_administration_aal2();
  if not public.has_permission('admin.manage.contacts') then raise exception 'contact_verification_forbidden'; end if;
  update public.contact_points set verification_status = target_status,
    verified_at = case when target_status = 'verified' then now() else null end,
    status = case when target_status = 'disabled' then 'suspended'::public.membership_status else 'active'::public.membership_status end,
    updated_at = now() where id = target_contact_id;
  if not found then raise exception 'contact_not_found'; end if;
end;
$$;

create function public.set_notification_channels(
  target_category public.notification_category, target_in_app boolean, target_push boolean,
  target_email boolean, target_sms boolean, target_whatsapp boolean,
  target_digest_frequency text default 'immediate', target_quiet_start time default null, target_quiet_end time default null
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if target_digest_frequency not in ('immediate','daily','weekly','never') then raise exception 'invalid_digest_frequency'; end if;
  insert into public.notification_preferences(user_id, category, in_app, browser, realtime, push, email, sms, whatsapp,
    digest_frequency, quiet_hours_start, quiet_hours_end)
  values((select auth.uid()), target_category, target_in_app, target_push, true, target_push, target_email, target_sms, target_whatsapp,
    target_digest_frequency, target_quiet_start, target_quiet_end)
  on conflict(user_id, category) do update set in_app = excluded.in_app, browser = excluded.browser,
    realtime = excluded.realtime, push = excluded.push, email = excluded.email, sms = excluded.sms,
    whatsapp = excluded.whatsapp, digest_frequency = excluded.digest_frequency,
    quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end, updated_at = now();
end;
$$;

create function public.register_user_device(target_device_key text, target_name text, target_platform text, target_browser text, target_push_subscription_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare device uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if target_push_subscription_id is not null and not exists (
    select 1 from public.push_subscriptions where id = target_push_subscription_id and user_id = (select auth.uid())
  ) then raise exception 'push_subscription_access_denied'; end if;
  insert into public.user_devices(user_id, device_key, name, platform, browser, push_subscription_id)
  values((select auth.uid()), trim(target_device_key), trim(target_name), nullif(trim(target_platform), ''), nullif(trim(target_browser), ''), target_push_subscription_id)
  on conflict(user_id, device_key) do update set name = excluded.name, platform = excluded.platform, browser = excluded.browser,
    push_subscription_id = coalesce(excluded.push_subscription_id, public.user_devices.push_subscription_id), enabled = true, last_seen_at = now(), updated_at = now()
  returning id into device;
  return device;
end;
$$;

create function public.remove_user_device(target_device_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.user_devices set enabled = false, updated_at = now()
  where id = target_device_id and user_id = (select auth.uid());
  if not found then raise exception 'device_access_denied'; end if;
end;
$$;

create function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.user_notifications set read_at = coalesce(read_at, now())
  where user_id = (select auth.uid()) and read_at is null;
$$;

create function public.archive_notification(target_notification_id uuid, target_archived boolean default true)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.user_notifications set archived_at = case when target_archived then now() else null end
  where id = target_notification_id and user_id = (select auth.uid());
  if not found then raise exception 'notification_access_denied'; end if;
end;
$$;

create function public.notification_delivery_time(target_user_id uuid, target_category public.notification_category, target_priority public.notification_priority)
returns timestamptz language plpgsql stable security definer set search_path = public, pg_temp as $$
declare preference public.notification_preferences%rowtype; current_time time := localtime; result timestamptz := now();
begin
  if target_priority = 'urgent' then return result; end if;
  select * into preference from public.notification_preferences where user_id = target_user_id and category = target_category;
  if not found then return result; end if;
  if preference.digest_frequency = 'daily' then result := date_trunc('day', now()) + interval '1 day 8 hours';
  elsif preference.digest_frequency = 'weekly' then result := date_trunc('week', now()) + interval '1 week 8 hours';
  end if;
  if preference.quiet_hours_start is not null and preference.quiet_hours_end is not null and (
    (preference.quiet_hours_start < preference.quiet_hours_end and current_time >= preference.quiet_hours_start and current_time < preference.quiet_hours_end)
    or (preference.quiet_hours_start > preference.quiet_hours_end and (current_time >= preference.quiet_hours_start or current_time < preference.quiet_hours_end))
  ) then
    result := greatest(result, case when current_time < preference.quiet_hours_end then current_date + preference.quiet_hours_end else current_date + interval '1 day' + preference.quiet_hours_end end);
  end if;
  return result;
end;
$$;

create function public.route_notification_event(target_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare evt public.notification_events%rowtype; recipient record; forced public.notification_channel[] := '{}';
  requested public.notification_channel[] := array['in_app','push','email','sms','whatsapp']::public.notification_channel[];
  wants_in_app boolean; wants_push boolean; wants_email boolean; wants_sms boolean; wants_whatsapp boolean;
  channel public.notification_channel; destination record; delivery_at timestamptz;
begin
  select * into evt from public.notification_events where id = target_event_id for update;
  if evt.id is null or evt.processed_at is not null or evt.scheduled_at > now() then return; end if;
  select coalesce(p.mandatory_channels, '{}') into forced from public.notification_policies p
    where p.school_id = evt.school_id and p.event_type = evt.event_type and p.enabled;
  if jsonb_typeof(evt.payload->'channels') = 'array' then
    select coalesce(array_agg(value::public.notification_channel), '{}') into requested from jsonb_array_elements_text(evt.payload->'channels');
  end if;

  if evt.subject_user_id is not null then
    insert into public.notification_recipients(event_id, user_id, relationship)
    select evt.id, evt.subject_user_id, 'direct'
    where exists(select 1 from public.profiles where id = evt.subject_user_id and status = 'active') on conflict do nothing;
  end if;
  if evt.event_type in ('STUDENT_ABSENT','STUDENT_LATE','ASSIGNMENT_CREATED','RECITATION_RECORDED') then
    insert into public.notification_recipients(event_id, user_id, relationship)
    select evt.id, fr.parent_id, 'guardian' from public.family_relationships fr
    join public.profiles p on p.id = fr.parent_id and p.status = 'active'
    where fr.student_id = evt.subject_user_id and fr.status = 'active' on conflict do nothing;
  end if;
  insert into public.notification_recipients(event_id, user_id, relationship)
  select evt.id, value::text::uuid, 'explicit' from jsonb_array_elements_text(coalesce(evt.payload->'recipient_ids','[]'::jsonb))
  join public.profiles p on p.id = value::text::uuid and p.status = 'active' on conflict do nothing;

  for recipient in select * from public.notification_recipients where event_id = evt.id loop
    wants_in_app := true; wants_push := false; wants_email := false; wants_sms := false; wants_whatsapp := false;
    select coalesce(np.in_app, true) as in_app, coalesce(np.push, false) as push,
      coalesce(np.email, false) as email, coalesce(np.sms, false) as sms, coalesce(np.whatsapp, false) as whatsapp
    into wants_in_app, wants_push, wants_email, wants_sms, wants_whatsapp
    from public.notification_preferences np where np.user_id = recipient.user_id and np.category = evt.category;
    if not found then
      wants_in_app := true; wants_push := false; wants_email := false; wants_sms := false; wants_whatsapp := false;
    end if;
    delivery_at := public.notification_delivery_time(recipient.user_id, evt.category, evt.priority);
    if ('in_app' = any(requested) and wants_in_app) or 'in_app' = any(forced) then
      insert into public.user_notifications(user_id, title, body, href, category, entity_type, entity_id, dedup_key, event_id, priority, expires_at)
      values(recipient.user_id, evt.title, evt.body, evt.href, evt.category, evt.entity_type, evt.entity_id,
        evt.dedup_key || ':in_app:' || recipient.user_id::text, evt.id, evt.priority, evt.expires_at) on conflict do nothing;
      insert into public.notification_deliveries(event_id, user_id, channel, status, masked_destination, idempotency_key, sent_at, delivered_at)
      values(evt.id, recipient.user_id, 'in_app', 'delivered', 'داخل التطبيق', evt.dedup_key || ':in_app:' || recipient.user_id::text, now(), now()) on conflict do nothing;
    end if;
    foreach channel in array array['push','email','sms','whatsapp']::public.notification_channel[] loop
      if (channel = 'push' and ((channel = any(requested) and wants_push) or channel = any(forced))) then
        insert into public.notification_deliveries(event_id, user_id, channel, device_id, masked_destination, idempotency_key, next_attempt_at)
        select evt.id, recipient.user_id, channel, d.id, d.name, evt.dedup_key || ':push:' || recipient.user_id::text || ':' || d.id::text, delivery_at
        from public.user_devices d where d.user_id = recipient.user_id and d.enabled and d.push_subscription_id is not null on conflict do nothing;
      elsif channel in ('email','sms','whatsapp') and
        (((channel = any(requested)) and ((channel = 'email' and wants_email) or (channel = 'sms' and wants_sms) or (channel = 'whatsapp' and wants_whatsapp))) or channel = any(forced)) then
        for destination in
          select c.id, c.kind, c.display_value from public.user_contact_links l join public.contact_points c on c.id = l.contact_point_id
          where l.user_id = recipient.user_id and l.notification_enabled and l.use_for_notifications and c.status = 'active'
            and c.verification_status = 'verified' and ((channel = 'email' and c.kind = 'email') or (channel in ('sms','whatsapp') and c.kind = 'phone'))
        loop
          insert into public.notification_deliveries(event_id, user_id, channel, contact_point_id, masked_destination, idempotency_key, next_attempt_at)
          values(evt.id, recipient.user_id, channel, destination.id, public.mask_contact_value(destination.kind, destination.display_value),
            evt.dedup_key || ':' || channel::text || ':' || destination.id::text, delivery_at) on conflict do nothing;
        end loop;
      end if;
    end loop;
  end loop;
  update public.notification_events set processed_at = now() where id = evt.id;
end;
$$;

create function public.attendance_notification_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; event_id uuid; event_name text; event_title text; event_body text;
begin
  if new.status not in ('absent','late') or (tg_op = 'UPDATE' and old.status = new.status and old.minutes_late = new.minutes_late) then return new; end if;
  begin
    select c.school_id into school from public.course_sessions s join public.classes c on c.id = s.class_id where s.id = new.session_id;
    event_name := case when new.status = 'absent' then 'STUDENT_ABSENT' else 'STUDENT_LATE' end;
    event_title := case when new.status = 'absent' then 'تسجيل غياب' else 'تسجيل تأخر' end;
    event_body := case when new.status = 'absent' then 'تم تسجيل غياب الطالب عن الحصة.' else 'تم تسجيل تأخر الطالب عن الحصة.' end;
    insert into public.notification_events(school_id, event_type, category, priority, subject_user_id, entity_type, entity_id,
      title, body, href, dedup_key, created_by)
    values(school, event_name, 'attendance', 'important', new.student_id, 'attendance_record', new.id,
      event_title, event_body, null, event_name || ':' || new.id::text || ':' || new.status::text, new.recorded_by)
    on conflict(dedup_key) do update set body = excluded.body returning id into event_id;
    perform public.route_notification_event(event_id);
  exception when others then
    insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
    values(new.recorded_by, school, 'notification.routing_failed', 'attendance_record', new.id,
      jsonb_build_object('error_code', sqlstate, 'error_message', left(sqlerrm, 240), 'event_type', event_name));
  end;
  return new;
end;
$$;
create trigger attendance_notification_after_write after insert or update on public.attendance_records
for each row execute function public.attendance_notification_trigger();

create function public.claim_notification_deliveries(target_limit integer default 50)
returns table(delivery_id uuid, channel public.notification_channel, destination text, title text, body text, href text, attempt_count smallint)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with claimed as (
    select d.id from public.notification_deliveries d
    where d.channel <> 'in_app' and d.status in ('pending','failed') and d.next_attempt_at <= now() and d.attempt_count < d.max_attempts
    order by d.next_attempt_at for update skip locked limit greatest(1, least(target_limit, 100))
  ), updated as (
    update public.notification_deliveries d set status = 'processing', locked_at = now(), attempt_count = d.attempt_count + 1, updated_at = now()
    from claimed where d.id = claimed.id returning d.*
  )
  select u.id, u.channel,
    case when u.channel = 'push' then ps.endpoint else cp.normalized_value end,
    e.title, e.body, e.href, u.attempt_count
  from updated u join public.notification_events e on e.id = u.event_id
  left join public.contact_points cp on cp.id = u.contact_point_id
  left join public.user_devices ud on ud.id = u.device_id
  left join public.push_subscriptions ps on ps.id = ud.push_subscription_id;
end;
$$;

create function public.finish_notification_delivery(target_delivery_id uuid, target_success boolean,
  target_provider text default null, target_provider_message_id text default null,
  target_error_code text default null, target_error_detail text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare attempts smallint; maximum smallint;
begin
  select attempt_count, max_attempts into attempts, maximum from public.notification_deliveries where id = target_delivery_id for update;
  if attempts is null then raise exception 'delivery_not_found'; end if;
  update public.notification_deliveries set provider = nullif(trim(target_provider), ''), provider_message_id = target_provider_message_id,
    status = case when target_success then 'sent'::public.notification_delivery_status when attempts >= maximum then 'dead_letter'::public.notification_delivery_status else 'failed'::public.notification_delivery_status end,
    sent_at = case when target_success then now() else sent_at end,
    failed_at = case when target_success then null else now() end,
    next_attempt_at = case when target_success then next_attempt_at else now() + make_interval(secs => least(3600, power(2, attempts)::integer * 30)) end,
    locked_at = null, error_code = case when target_success then null else left(coalesce(target_error_code,'PROVIDER_FAILED'),80) end,
    error_detail = case when target_success then null else left(coalesce(target_error_detail,''),1000) end, updated_at = now()
  where id = target_delivery_id;
end;
$$;

create function public.resolve_notification_audience(target_school_id uuid, target_audience jsonb)
returns table(user_id uuid) language sql stable security definer set search_path = public, pg_temp as $$
  select distinct sm.user_id
  from public.school_memberships sm
  join public.profiles p on p.id = sm.user_id and p.status = 'active'
  where sm.school_id = target_school_id and sm.status = 'active'
    and (
      coalesce(target_audience->>'type', 'all') = 'all'
      or (target_audience->>'type' = 'role' and exists (
        select 1 from public.user_roles ur where ur.user_id = sm.user_id and ur.role::text = target_audience->>'role'
      ))
      or (target_audience->>'type' = 'class' and (
        exists(select 1 from public.class_enrollments ce where ce.class_id = (target_audience->>'class_id')::uuid and ce.student_id = sm.user_id and ce.status = 'active')
        or exists(select 1 from public.class_teacher_assignments ca where ca.class_id = (target_audience->>'class_id')::uuid and ca.teacher_id = sm.user_id and ca.status = 'active')
        or exists(select 1 from public.family_relationships fr join public.class_enrollments ce on ce.student_id = fr.student_id and ce.status = 'active'
          where ce.class_id = (target_audience->>'class_id')::uuid and fr.parent_id = sm.user_id and fr.status = 'active')
      ))
      or (target_audience->>'type' = 'users' and sm.user_id::text in (
        select jsonb_array_elements_text(coalesce(target_audience->'user_ids','[]'::jsonb))
      ))
    );
$$;

create function public.estimate_notification_audience(target_school_id uuid, target_audience jsonb)
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $$
declare total integer;
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) or not public.has_permission('admin.send.broadcast') then raise exception 'broadcast_forbidden'; end if;
  select count(*) into total from public.resolve_notification_audience(target_school_id, target_audience);
  return total;
end;
$$;

create function public.create_notification_campaign(
  target_school_id uuid, target_title text, target_body text, target_href text,
  target_audience jsonb, target_channels public.notification_channel[], target_priority public.notification_priority,
  target_locale public.public_locale default 'ar', target_scheduled_at timestamptz default now(), target_expires_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); campaign uuid; event uuid; total integer; recipients jsonb;
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) or not public.has_permission('admin.send.broadcast') then raise exception 'broadcast_forbidden'; end if;
  if target_priority = 'urgent' and not public.has_permission('admin.send.urgent_broadcast') then raise exception 'urgent_broadcast_forbidden'; end if;
  if char_length(trim(target_title)) not between 1 and 160 or char_length(trim(target_body)) not between 1 and 4000 then raise exception 'invalid_campaign_content'; end if;
  if coalesce(cardinality(target_channels), 0) = 0 or 'whatsapp' = any(target_channels) then raise exception 'unsupported_campaign_channel'; end if;
  select count(*), coalesce(jsonb_agg(user_id), '[]'::jsonb) into total, recipients
    from public.resolve_notification_audience(target_school_id, target_audience);
  if total = 0 then raise exception 'empty_campaign_audience'; end if;
  if total > 5000 then raise exception 'campaign_audience_too_large'; end if;
  insert into public.notification_campaigns(school_id, title, body, href, audience, channels, priority, locale,
    status, scheduled_at, expires_at, estimated_recipients, created_by)
  values(target_school_id, trim(target_title), trim(target_body), nullif(trim(target_href), ''), target_audience, target_channels,
    target_priority, target_locale, case when target_scheduled_at > now() then 'scheduled' else 'processing' end,
    target_scheduled_at, target_expires_at, total, actor) returning id into campaign;
  insert into public.notification_events(school_id, event_type, category, priority, entity_type, entity_id, title, body, href,
    payload, dedup_key, scheduled_at, expires_at, created_by)
  values(target_school_id, 'ADMIN_BROADCAST', 'administration', target_priority, 'notification_campaign', campaign,
    trim(target_title), trim(target_body), nullif(trim(target_href), ''), jsonb_build_object('recipient_ids', recipients, 'channels', target_channels),
    'campaign:' || campaign::text, target_scheduled_at, target_expires_at, actor) returning id into event;
  if target_scheduled_at <= now() then
    perform public.route_notification_event(event);
    update public.notification_campaigns set status = 'sent', updated_at = now() where id = campaign;
  end if;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, target_school_id, 'notification_campaign.created', 'notification_campaign', campaign,
    jsonb_build_object('estimated_recipients', total, 'priority', target_priority, 'channels', target_channels));
  return campaign;
end;
$$;

create function public.process_due_notification_events(target_limit integer default 100)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare item record; processed integer := 0;
begin
  for item in select id from public.notification_events
    where processed_at is null and scheduled_at <= now() and (expires_at is null or expires_at > now())
    order by scheduled_at for update skip locked limit greatest(1, least(target_limit, 500))
  loop
    perform public.route_notification_event(item.id);
    processed := processed + 1;
  end loop;
  update public.notification_campaigns c set status = 'sent', updated_at = now()
  where c.status in ('scheduled','processing') and exists (
    select 1 from public.notification_events e where e.entity_type = 'notification_campaign' and e.entity_id = c.id and e.processed_at is not null
  );
  return processed;
end;
$$;

insert into public.permissions(key, description) values
  ('admin.manage.contacts', 'Manage and verify contact identities in an administered school'),
  ('admin.send.broadcast', 'Send a notification campaign to an authorized school audience'),
  ('admin.send.urgent_broadcast', 'Send urgent mandatory communication to an authorized school audience');
insert into public.role_permissions(role, permission_key) values
  ('admin','admin.manage.contacts'), ('direction','admin.manage.contacts'),
  ('admin','admin.send.broadcast'), ('direction','admin.send.broadcast'),
  ('direction','admin.send.urgent_broadcast');

insert into public.app_schema_versions(version, checksum)
values ('202608310005', 'v3-contact-notification-engine-20260831');

alter table public.contact_points enable row level security;
alter table public.user_contact_links enable row level security;
alter table public.user_devices enable row level security;
alter table public.notification_policies enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_campaigns enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_deliveries enable row level security;

create policy contact_points_admin_read on public.contact_points for select to authenticated using (
  exists(select 1 from public.user_contact_links l where l.contact_point_id = id and public.can_manage_user(l.user_id))
);
create policy user_contact_links_scoped_read on public.user_contact_links for select to authenticated using (
  user_id = (select auth.uid()) or public.can_manage_user(user_id)
);
create policy user_devices_own_read on public.user_devices for select to authenticated using (user_id = (select auth.uid()));
create policy notification_policies_admin_read on public.notification_policies for select to authenticated using (public.can_manage_school(school_id));
create policy notification_templates_admin_read on public.notification_templates for select to authenticated using (school_id is not null and public.can_manage_school(school_id));
create policy notification_events_scoped_read on public.notification_events for select to authenticated using (
  exists(select 1 from public.notification_recipients r where r.event_id = id and r.user_id = (select auth.uid()))
  or (school_id is not null and public.can_manage_school(school_id))
);
create policy notification_campaigns_admin_read on public.notification_campaigns for select to authenticated using (public.can_manage_school(school_id));
create policy notification_recipients_scoped_read on public.notification_recipients for select to authenticated using (
  user_id = (select auth.uid()) or exists(select 1 from public.notification_events e where e.id = event_id and e.school_id is not null and public.can_manage_school(e.school_id))
);
create policy notification_deliveries_scoped_read on public.notification_deliveries for select to authenticated using (
  user_id = (select auth.uid()) or exists(select 1 from public.notification_events e where e.id = event_id and e.school_id is not null and public.can_manage_school(e.school_id))
);

revoke all on public.contact_points, public.user_contact_links, public.user_devices, public.notification_policies,
  public.notification_templates, public.notification_events, public.notification_campaigns, public.notification_recipients,
  public.notification_deliveries from anon;
revoke insert, update, delete, truncate, references, trigger on public.contact_points, public.user_contact_links, public.user_devices,
  public.notification_policies, public.notification_templates, public.notification_events, public.notification_campaigns,
  public.notification_recipients, public.notification_deliveries from authenticated;
grant select on public.contact_points, public.user_contact_links, public.user_devices, public.notification_policies,
  public.notification_templates, public.notification_events, public.notification_campaigns, public.notification_recipients,
  public.notification_deliveries to authenticated;

revoke all on function public.mask_contact_value(public.contact_kind,text), public.list_my_contacts(),
  public.save_user_contact(uuid,public.contact_kind,text,text,text,public.contact_label,boolean,boolean,boolean,boolean,boolean,text),
  public.remove_user_contact(uuid), public.set_contact_verification(uuid,public.contact_verification_status),
  public.set_notification_channels(public.notification_category,boolean,boolean,boolean,boolean,boolean,text,time,time),
  public.register_user_device(text,text,text,text,uuid), public.remove_user_device(uuid), public.mark_all_notifications_read(),
  public.archive_notification(uuid,boolean), public.notification_delivery_time(uuid,public.notification_category,public.notification_priority), public.route_notification_event(uuid),
  public.resolve_notification_audience(uuid,jsonb), public.estimate_notification_audience(uuid,jsonb),
  public.create_notification_campaign(uuid,text,text,text,jsonb,public.notification_channel[],public.notification_priority,public.public_locale,timestamptz,timestamptz),
  public.process_due_notification_events(integer), public.claim_notification_deliveries(integer), public.finish_notification_delivery(uuid,boolean,text,text,text,text)
  from public, anon;
grant execute on function public.list_my_contacts(),
  public.save_user_contact(uuid,public.contact_kind,text,text,text,public.contact_label,boolean,boolean,boolean,boolean,boolean,text),
  public.remove_user_contact(uuid), public.set_contact_verification(uuid,public.contact_verification_status),
  public.set_notification_channels(public.notification_category,boolean,boolean,boolean,boolean,boolean,text,time,time),
  public.register_user_device(text,text,text,text,uuid), public.remove_user_device(uuid), public.mark_all_notifications_read(),
  public.archive_notification(uuid,boolean), public.estimate_notification_audience(uuid,jsonb),
  public.create_notification_campaign(uuid,text,text,text,jsonb,public.notification_channel[],public.notification_priority,public.public_locale,timestamptz,timestamptz) to authenticated;
grant execute on function public.mask_contact_value(public.contact_kind,text), public.route_notification_event(uuid),
  public.notification_delivery_time(uuid,public.notification_category,public.notification_priority),
  public.resolve_notification_audience(uuid,jsonb), public.process_due_notification_events(integer),
  public.claim_notification_deliveries(integer), public.finish_notification_delivery(uuid,boolean,text,text,text,text) to service_role;

commit;
