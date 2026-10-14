begin;

create table public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  anonymous_hash text not null check (char_length(anonymous_hash) = 64),
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  necessary boolean not null default true check (necessary),
  audience_measurement boolean not null default false,
  marketing boolean not null default false,
  locale text not null check (locale in ('ar','fr','en','amz')),
  user_agent_family text,
  recorded_at timestamptz not null default now()
);
create index privacy_consents_hash_recorded_idx on public.privacy_consents(anonymous_hash, recorded_at desc);

create type public.data_right_kind as enum ('access','rectification','erasure','restriction');
create type public.data_right_status as enum ('submitted','in_review','fulfilled','rejected','cancelled');
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  kind public.data_right_kind not null,
  status public.data_right_status not null default 'submitted',
  details text check (details is null or char_length(details) <= 2000),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  check ((status in ('fulfilled','rejected','cancelled')) = (resolved_at is not null))
);
create index data_subject_requests_user_idx on public.data_subject_requests(user_id, submitted_at desc);
create index data_subject_requests_status_idx on public.data_subject_requests(status, submitted_at);

alter table public.privacy_consents enable row level security;
alter table public.data_subject_requests enable row level security;
revoke all on public.privacy_consents, public.data_subject_requests from anon, authenticated;
grant select on public.data_subject_requests to authenticated;

create policy data_subject_requests_own_select on public.data_subject_requests for select to authenticated using (user_id = (select auth.uid()));
create policy data_subject_requests_admin_select on public.data_subject_requests for select to authenticated using (public.has_role('admin') or public.has_role('direction'));

create or replace function public.run_privacy_retention()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare consent_count bigint; challenge_count bigint; receipt_count bigint;
begin
  delete from public.privacy_consents where recorded_at < now() - interval '25 months'; get diagnostics consent_count = row_count;
  delete from public.contact_verification_challenges where expires_at < now() - interval '30 days'; get diagnostics challenge_count = row_count;
  delete from public.offline_mutation_receipts where created_at < now() - interval '90 days'; get diagnostics receipt_count = row_count;
  insert into public.audit_logs(actor_id, action, entity_type, metadata) values ((select auth.uid()), 'PRIVACY_RETENTION_RUN', 'privacy', jsonb_build_object('consents', consent_count, 'challenges', challenge_count, 'offlineReceipts', receipt_count));
  return jsonb_build_object('consents', consent_count, 'challenges', challenge_count, 'offlineReceipts', receipt_count);
end; $$;
revoke all on function public.run_privacy_retention() from public, anon, authenticated;
grant execute on function public.run_privacy_retention() to service_role;

commit;
