begin;

create table public.contact_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  contact_point_id uuid not null references public.contact_points(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_digest text not null check (code_digest ~ '^[a-f0-9]{64}$'),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index contact_verification_challenges_lookup_idx
  on public.contact_verification_challenges(user_id, contact_point_id, created_at desc);

create unique index push_subscriptions_endpoint_idx on public.push_subscriptions(endpoint);

create function public.create_contact_verification_challenge(
  target_user_id uuid,
  target_link_id uuid,
  target_code_digest text
)
returns table(challenge_id uuid, contact_kind public.contact_kind, destination text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare point_id uuid; point_kind public.contact_kind; point_destination text; created_id uuid;
begin
  if target_code_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid_otp_digest'; end if;
  select c.id, c.kind, c.normalized_value into point_id, point_kind, point_destination
  from public.user_contact_links l
  join public.contact_points c on c.id = l.contact_point_id
  where l.id = target_link_id and l.user_id = target_user_id and c.status = 'active';
  if point_id is null then raise exception 'contact_not_found'; end if;
  if exists (
    select 1 from public.contact_verification_challenges
    where user_id = target_user_id and contact_point_id = point_id and created_at > now() - interval '60 seconds'
  ) then raise exception 'otp_rate_limited'; end if;
  if (
    select count(*) from public.contact_verification_challenges
    where user_id = target_user_id and contact_point_id = point_id and created_at > now() - interval '1 hour'
  ) >= 5 then raise exception 'otp_hourly_limit'; end if;

  update public.contact_verification_challenges set cancelled_at = now()
  where user_id = target_user_id and contact_point_id = point_id and consumed_at is null and cancelled_at is null;
  insert into public.contact_verification_challenges(contact_point_id, user_id, code_digest, expires_at)
  values(point_id, target_user_id, target_code_digest, now() + interval '10 minutes') returning id into created_id;
  update public.contact_points set verification_status = 'pending', verified_at = null, updated_at = now() where id = point_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(target_user_id, 'contact.verification_requested', 'contact_point', point_id, jsonb_build_object('kind', point_kind));
  return query select created_id, point_kind, point_destination;
end;
$$;

create function public.cancel_contact_verification_challenge(target_challenge_id uuid, target_user_id uuid, target_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.contact_verification_challenges set cancelled_at = now()
  where id = target_challenge_id and user_id = target_user_id and consumed_at is null and cancelled_at is null;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(target_user_id, 'contact.verification_delivery_failed', 'contact_verification_challenge', target_challenge_id,
    jsonb_build_object('reason', left(coalesce(target_reason, 'provider_failed'), 120)));
end;
$$;

create function public.verify_contact_verification_challenge(target_user_id uuid, target_link_id uuid, target_code_digest text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare challenge public.contact_verification_challenges%rowtype; point_id uuid;
begin
  select contact_point_id into point_id from public.user_contact_links where id = target_link_id and user_id = target_user_id;
  if point_id is null then return false; end if;
  select * into challenge from public.contact_verification_challenges
  where user_id = target_user_id and contact_point_id = point_id and consumed_at is null and cancelled_at is null
  order by created_at desc limit 1 for update;
  if challenge.id is null or challenge.expires_at <= now() or challenge.attempt_count >= challenge.max_attempts then return false; end if;
  if challenge.code_digest <> target_code_digest then
    update public.contact_verification_challenges
    set attempt_count = attempt_count + 1,
        cancelled_at = case when attempt_count + 1 >= max_attempts then now() else cancelled_at end
    where id = challenge.id;
    return false;
  end if;
  update public.contact_verification_challenges set consumed_at = now() where id = challenge.id;
  update public.contact_points set verification_status = 'verified', verified_at = now(), updated_at = now() where id = point_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values(target_user_id, 'contact.verified', 'contact_point', point_id);
  return true;
end;
$$;

create function public.save_push_subscription(
  target_device_key text,
  target_name text,
  target_platform text,
  target_browser text,
  target_endpoint text,
  target_p256dh text,
  target_auth_secret text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); subscription_id uuid; existing_owner uuid;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if target_endpoint !~ '^https://' or char_length(target_endpoint) > 2048
    or char_length(target_p256dh) not between 40 and 255 or char_length(target_auth_secret) not between 8 and 255 then
    raise exception 'invalid_push_subscription';
  end if;
  select user_id into existing_owner from public.push_subscriptions where endpoint = target_endpoint;
  if existing_owner is not null and existing_owner <> actor then raise exception 'push_subscription_owned_by_another_user'; end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth_secret, user_agent, last_used_at)
  values(actor, target_endpoint, target_p256dh, target_auth_secret, nullif(trim(target_browser), ''), now())
  on conflict(endpoint) do update set p256dh = excluded.p256dh, auth_secret = excluded.auth_secret,
    user_agent = excluded.user_agent, last_used_at = now()
  returning id into subscription_id;
  perform public.register_user_device(target_device_key, target_name, target_platform, target_browser, subscription_id);
  return subscription_id;
end;
$$;

create function public.disable_push_subscription(target_endpoint text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.user_devices set enabled = false, updated_at = now()
  where push_subscription_id in (select id from public.push_subscriptions where endpoint = target_endpoint);
  delete from public.push_subscriptions where endpoint = target_endpoint;
end;
$$;

drop function public.claim_notification_deliveries(integer);
create function public.claim_notification_deliveries(target_limit integer default 50)
returns table(delivery_id uuid, channel public.notification_channel, destination text, title text, body text, href text, attempt_count smallint, provider_payload jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.notification_deliveries set status = 'failed', locked_at = null, next_attempt_at = now(),
    error_code = 'STALE_WORKER_LOCK', updated_at = now()
  where status = 'processing' and locked_at < now() - interval '10 minutes';
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
    coalesce(case when u.channel = 'push' then ps.endpoint else cp.normalized_value end, ''),
    e.title, e.body, e.href, u.attempt_count,
    case when u.channel = 'push' then jsonb_build_object('p256dh', ps.p256dh, 'auth', ps.auth_secret) else '{}'::jsonb end
  from updated u join public.notification_events e on e.id = u.event_id
  left join public.contact_points cp on cp.id = u.contact_point_id
  left join public.user_devices ud on ud.id = u.device_id and ud.enabled
  left join public.push_subscriptions ps on ps.id = ud.push_subscription_id;
end;
$$;

drop function public.finish_notification_delivery(uuid,boolean,text,text,text,text);
create function public.finish_notification_delivery(target_delivery_id uuid, target_success boolean,
  target_provider text default null, target_provider_message_id text default null,
  target_error_code text default null, target_error_detail text default null, target_permanent boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare attempts smallint; maximum smallint;
begin
  select attempt_count, max_attempts into attempts, maximum from public.notification_deliveries where id = target_delivery_id for update;
  if attempts is null then raise exception 'delivery_not_found'; end if;
  update public.notification_deliveries set provider = nullif(trim(target_provider), ''), provider_message_id = target_provider_message_id,
    status = case when target_success then 'sent'::public.notification_delivery_status when target_permanent or attempts >= maximum then 'dead_letter'::public.notification_delivery_status else 'failed'::public.notification_delivery_status end,
    sent_at = case when target_success then now() else sent_at end,
    failed_at = case when target_success then null else now() end,
    next_attempt_at = case when target_success or target_permanent then next_attempt_at else now() + make_interval(secs => least(3600, power(2, attempts)::integer * 30)) end,
    locked_at = null, error_code = case when target_success then null else left(coalesce(target_error_code,'PROVIDER_FAILED'),80) end,
    error_detail = case when target_success then null else left(coalesce(target_error_detail,''),1000) end, updated_at = now()
  where id = target_delivery_id;
end;
$$;

insert into public.app_schema_versions(version, checksum)
values ('202608310006', 'v3-external-delivery-otp-20260831');

alter table public.contact_verification_challenges enable row level security;
revoke all on public.contact_verification_challenges from anon, authenticated;
revoke all on function public.create_contact_verification_challenge(uuid,uuid,text),
  public.cancel_contact_verification_challenge(uuid,uuid,text), public.verify_contact_verification_challenge(uuid,uuid,text),
  public.disable_push_subscription(text), public.claim_notification_deliveries(integer),
  public.finish_notification_delivery(uuid,boolean,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text,text,text,text,text,text,text) to authenticated;
revoke all on function public.save_push_subscription(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_contact_verification_challenge(uuid,uuid,text),
  public.cancel_contact_verification_challenge(uuid,uuid,text), public.verify_contact_verification_challenge(uuid,uuid,text),
  public.disable_push_subscription(text), public.claim_notification_deliveries(integer),
  public.finish_notification_delivery(uuid,boolean,text,text,text,text,boolean) to service_role;

commit;
