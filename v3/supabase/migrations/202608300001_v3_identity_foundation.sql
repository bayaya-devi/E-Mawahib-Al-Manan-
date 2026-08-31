begin;

create type public.app_role as enum (
  'student',
  'parent',
  'teacher',
  'admin',
  'super_admin'
);

create type public.account_status as enum (
  'invited',
  'active',
  'suspended',
  'archived'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  locale text not null default 'ar' check (locale in ('ar', 'fr', 'en', 'zgh')),
  status public.account_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint archived_status_consistency check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  )
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_logs_actor_occurred_idx
  on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

revoke all on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_select_admin
on public.profiles for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('super_admin')
);

create policy user_roles_select_own
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy user_roles_select_admin
on public.user_roles for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('super_admin')
);

create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('super_admin')
);

revoke all on public.profiles, public.user_roles, public.audit_logs from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles, public.user_roles, public.audit_logs
  from authenticated;
grant select on public.profiles, public.user_roles, public.audit_logs to authenticated;

comment on table public.audit_logs is
  'Append-only security and business audit trail; writes use trusted server code.';
comment on table public.user_roles is
  'Roles are provisioned by trusted server code; clients cannot self-promote.';

commit;
