begin;

create table public.permissions (
  key text primary key check (key ~ '^[a-z]+([._][a-z]+)+$'),
  description text not null check (char_length(description) between 3 and 240),
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role public.app_role not null,
  permission_key text not null references public.permissions(key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  enabled boolean not null default false,
  allowed_roles public.app_role[] not null default '{}',
  description text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.app_schema_versions (
  version text primary key,
  checksum text not null check (char_length(checksum) >= 12),
  applied_at timestamptz not null default now()
);

create table public.offline_mutation_receipts (
  user_id uuid not null references public.profiles(id) on delete restrict,
  mutation_id uuid not null,
  mutation_kind text not null check (mutation_kind in ('message.send','request.create','quran.practice','assignment.update')),
  state text not null default 'processing' check (state in ('processing','completed','failed')),
  lease_until timestamptz not null default (now() + interval '2 minutes'),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);
create index offline_mutation_receipts_cleanup_idx on public.offline_mutation_receipts(state, updated_at);

insert into public.permissions(key, description) values
  ('student.read.self', 'Read the authenticated student learning record'),
  ('parent.read.children', 'Read records of explicitly linked children'),
  ('teacher.read.class', 'Read assigned classes and students'),
  ('teacher.write.attendance', 'Record attendance for an assigned class'),
  ('teacher.write.recitation', 'Record recitation for an assigned student'),
  ('admin.manage.students', 'Manage students in an administered school'),
  ('admin.manage.teachers', 'Manage teachers in an administered school'),
  ('admin.manage.website', 'Manage public school content'),
  ('admin.manage.payroll', 'Manage payroll in an administered school'),
  ('direction.read.analytics', 'Read direction analytics'),
  ('direction.manage.permissions', 'Manage role and permission assignments'),
  ('system.read.diagnostics', 'Read non-sensitive production diagnostics');

insert into public.role_permissions(role, permission_key) values
  ('student', 'student.read.self'),
  ('parent', 'parent.read.children'),
  ('teacher', 'teacher.read.class'),
  ('teacher', 'teacher.write.attendance'),
  ('teacher', 'teacher.write.recitation'),
  ('admin', 'admin.manage.students'),
  ('admin', 'admin.manage.teachers'),
  ('admin', 'admin.manage.website'),
  ('admin', 'admin.manage.payroll'),
  ('direction', 'admin.manage.students'),
  ('direction', 'admin.manage.teachers'),
  ('direction', 'admin.manage.website'),
  ('direction', 'admin.manage.payroll'),
  ('direction', 'direction.read.analytics'),
  ('direction', 'direction.manage.permissions'),
  ('direction', 'system.read.diagnostics');

insert into public.feature_flags(key, enabled, allowed_roles, description) values
  ('digital_teacher_v3', false, array['student']::public.app_role[], 'New recitation analysis engine'),
  ('offline_mutations_v3', true, array['student','parent','teacher','admin','direction']::public.app_role[], 'IndexedDB mutation queue'),
  ('teacher_session_v3', true, array['teacher','admin','direction']::public.app_role[], 'Guided teacher session workflow');

insert into public.app_schema_versions(version, checksum)
values ('202608310004', 'v3-production-hardening-20260831');

create function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.status = 'active'
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid()) and rp.permission_key = required_permission
  );
$$;

create function public.is_feature_enabled(target_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.feature_flags f
    where f.key = target_key and f.enabled
      and exists (
        select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id and p.status = 'active'
        where ur.user_id = (select auth.uid()) and ur.role = any(f.allowed_roles)
      )
  );
$$;

create function public.claim_offline_mutation(target_id uuid, target_kind text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); receipt public.offline_mutation_receipts%rowtype;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and status = 'active') then raise exception 'active_session_required'; end if;
  if target_kind not in ('message.send','request.create','quran.practice','assignment.update') then raise exception 'invalid_mutation_kind'; end if;
  insert into public.offline_mutation_receipts(user_id, mutation_id, mutation_kind)
  values(actor, target_id, target_kind) on conflict do nothing returning * into receipt;
  if found then return 'claimed'; end if;
  select * into receipt from public.offline_mutation_receipts where user_id = actor and mutation_id = target_id for update;
  if receipt.mutation_kind <> target_kind then raise exception 'mutation_kind_conflict'; end if;
  if receipt.state = 'completed' then return 'completed'; end if;
  if receipt.state = 'processing' and receipt.lease_until > now() then return 'busy'; end if;
  update public.offline_mutation_receipts set state = 'processing', lease_until = now() + interval '2 minutes', last_error_code = null, updated_at = now()
  where user_id = actor and mutation_id = target_id;
  return 'claimed';
end;
$$;

create function public.finish_offline_mutation(target_id uuid, target_success boolean, target_error_code text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.offline_mutation_receipts set state = case when target_success then 'completed' else 'failed' end,
    last_error_code = case when target_success then null else left(coalesce(target_error_code, 'SYNC_FAILED'), 80) end,
    lease_until = now(), updated_at = now()
  where user_id = (select auth.uid()) and mutation_id = target_id;
  if not found then raise exception 'mutation_receipt_not_found'; end if;
end;
$$;

create function public.system_diagnostics()
returns jsonb language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare result jsonb;
begin
  perform public.require_administration_aal2();
  if not public.has_permission('system.read.diagnostics') then raise exception 'diagnostics_forbidden'; end if;
  select jsonb_build_object(
    'schema_version', (select version from public.app_schema_versions order by applied_at desc limit 1),
    'auth_without_profile', (select count(*) from auth.users u left join public.profiles p on p.id = u.id where p.id is null),
    'profile_without_role', (select count(*) from public.profiles p left join public.user_roles r on r.user_id = p.id where r.user_id is null and p.status = 'active'),
    'student_without_class', (select count(*) from public.student_profiles s join public.profiles p on p.id = s.user_id and p.status = 'active' where not exists (select 1 from public.class_enrollments e where e.student_id = s.user_id and e.status = 'active')),
    'class_without_teacher', (select count(*) from public.classes c where c.status = 'active' and not exists (select 1 from public.class_teacher_assignments a where a.class_id = c.id and a.status = 'active')),
    'stuck_offline_mutations', (select count(*) from public.offline_mutation_receipts where state = 'processing' and lease_until < now()),
    'checked_at', now()
  ) into result;
  return result;
end;
$$;

create function public.prevent_audit_log_mutation()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user <> 'postgres' then raise exception 'audit_log_is_append_only'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.app_schema_versions enable row level security;
alter table public.offline_mutation_receipts enable row level security;

create policy permissions_active_read on public.permissions for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active')
);
create policy role_permissions_active_read on public.role_permissions for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active')
);
create policy feature_flags_active_read on public.feature_flags for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and status = 'active')
);
create policy schema_versions_direction_read on public.app_schema_versions for select to authenticated using (
  public.has_permission('system.read.diagnostics')
);
create policy offline_mutation_receipts_own_read on public.offline_mutation_receipts for select to authenticated using (
  user_id = (select auth.uid())
);

revoke all on public.permissions, public.role_permissions, public.feature_flags, public.app_schema_versions, public.offline_mutation_receipts from anon;
revoke insert, update, delete, truncate, references, trigger on public.permissions, public.role_permissions, public.feature_flags, public.app_schema_versions, public.offline_mutation_receipts from authenticated;
grant select on public.permissions, public.role_permissions, public.feature_flags, public.app_schema_versions, public.offline_mutation_receipts to authenticated;
revoke all on function public.has_permission(text), public.is_feature_enabled(text), public.claim_offline_mutation(uuid,text), public.finish_offline_mutation(uuid,boolean,text), public.system_diagnostics() from public, anon;
grant execute on function public.has_permission(text), public.is_feature_enabled(text), public.claim_offline_mutation(uuid,text), public.finish_offline_mutation(uuid,boolean,text), public.system_diagnostics() to authenticated;

commit;
