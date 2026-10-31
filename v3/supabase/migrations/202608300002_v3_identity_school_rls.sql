begin;

alter type public.app_role rename value 'super_admin' to 'direction';
alter type public.account_status rename value 'invited' to 'pending';

alter table public.profiles alter column status set default 'pending';
alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column suspension_reason text,
  add column created_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add constraint profiles_first_name_valid
    check (first_name is null or char_length(trim(first_name)) between 1 and 80),
  add constraint profiles_last_name_valid
    check (last_name is null or char_length(trim(last_name)) between 1 and 80),
  add constraint profiles_suspension_consistency
    check (
      (status = 'suspended' and char_length(trim(suspension_reason)) between 3 and 500)
      or (status <> 'suspended' and suspension_reason is null)
    );

create type public.membership_status as enum ('pending', 'active', 'suspended', 'archived');
create type public.enrollment_status as enum ('active', 'completed', 'withdrawn', 'suspended');
create type public.teacher_assignment_kind as enum ('primary', 'assistant', 'substitute');
create type public.guardian_relationship as enum (
  'mother',
  'father',
  'guardian',
  'other'
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,32}$'),
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status public.membership_status not null default 'pending',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  primary key (school_id, user_id),
  constraint school_membership_end_consistency check (
    (status = 'archived' and ended_at is not null)
    or (status <> 'archived' and ended_at is null)
  )
);

create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  student_number text unique,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female', 'unspecified')),
  accessibility_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parent_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  employee_number text unique,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_profiles (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_relationships (
  parent_id uuid not null references public.parent_profiles(user_id) on delete restrict,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  relationship public.guardian_relationship not null default 'guardian',
  status public.membership_status not null default 'active',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (parent_id, student_id)
);

create unique index family_relationships_one_primary_parent_idx
  on public.family_relationships (student_id)
  where is_primary and status = 'active';

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  level text,
  capacity integer check (capacity is null or capacity > 0),
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  student_id uuid not null references public.student_profiles(user_id) on delete restrict,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  constraint class_enrollment_end_consistency check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index class_enrollments_one_active_idx
  on public.class_enrollments (student_id)
  where status = 'active';
create index class_enrollments_class_status_idx
  on public.class_enrollments (class_id, status);

create table public.class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete restrict,
  assignment_kind public.teacher_assignment_kind not null default 'primary',
  status public.membership_status not null default 'active',
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  constraint teacher_assignment_end_consistency check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index class_teacher_assignments_active_idx
  on public.class_teacher_assignments (class_id, teacher_id)
  where status = 'active';
create index class_teacher_assignments_teacher_status_idx
  on public.class_teacher_assignments (teacher_id, status);

alter table public.audit_logs
  add column school_id uuid references public.schools(id) on delete set null,
  add column request_id uuid;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.migration_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('planned', 'running', 'completed', 'failed', 'rolled_back')),
  source_count bigint not null default 0 check (source_count >= 0),
  migrated_count bigint not null default 0 check (migrated_count >= 0),
  rejected_count bigint not null default 0 check (rejected_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.legacy_account_links (
  source_name text not null,
  legacy_user_id text not null,
  new_user_id uuid references public.profiles(id) on delete restrict,
  identifier_fingerprint text not null,
  migration_status text not null default 'pending'
    check (migration_status in ('pending', 'migrated', 'rejected', 'review')),
  requires_password_reset boolean not null default true,
  migrated_at timestamptz,
  last_error_code text,
  primary key (source_name, legacy_user_id),
  unique (source_name, identifier_fingerprint)
);

create table private.login_aliases (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  normalized_alias text not null unique
    check (char_length(normalized_alias) between 3 and 80),
  created_at timestamptz not null default now()
);

revoke all on all tables in schema private from public, anon, authenticated;

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();
create trigger parent_profiles_set_updated_at
before update on public.parent_profiles
for each row execute function public.set_updated_at();
create trigger teacher_profiles_set_updated_at
before update on public.teacher_profiles
for each row execute function public.set_updated_at();
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();
create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and p.status = 'active'
  );
$$;

create function public.is_administration()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin') or public.has_role('direction');
$$;

create function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_memberships sm
    join public.profiles p on p.id = sm.user_id
    where sm.school_id = target_school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and p.status = 'active'
  );
$$;

create function public.can_manage_school(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('direction')
    or (
      public.has_role('admin')
      and public.is_school_member(target_school_id)
    );
$$;

create function public.can_manage_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('direction') or exists (
    select 1
    from public.school_memberships target_membership
    where target_membership.user_id = target_user_id
      and target_membership.status <> 'archived'
      and public.can_manage_school(target_membership.school_id)
  );
$$;

create function public.parent_has_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_relationships fr
    join public.profiles parent_profile on parent_profile.id = fr.parent_id
    where fr.parent_id = (select auth.uid())
      and fr.student_id = target_student_id
      and fr.status = 'active'
      and parent_profile.status = 'active'
  );
$$;

create function public.teacher_has_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.class_enrollments ce
    join public.class_teacher_assignments cta on cta.class_id = ce.class_id
    join public.classes c on c.id = ce.class_id
    join public.profiles teacher_profile on teacher_profile.id = cta.teacher_id
    join public.school_memberships teacher_membership
      on teacher_membership.school_id = c.school_id
      and teacher_membership.user_id = cta.teacher_id
    where ce.student_id = target_student_id
      and ce.status = 'active'
      and cta.teacher_id = (select auth.uid())
      and cta.status = 'active'
      and teacher_profile.status = 'active'
      and teacher_membership.status = 'active'
  );
$$;

create function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_student_id = (select auth.uid())
    or public.parent_has_student(target_student_id)
    or public.teacher_has_student(target_student_id)
    or public.can_manage_user(target_student_id);
$$;

create function public.can_manage_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_manage_user(target_student_id);
$$;

create function public.can_access_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and (
        public.can_manage_school(c.school_id)
        or (
          public.is_school_member(c.school_id)
          and (
            exists (
              select 1 from public.class_teacher_assignments cta
              where cta.class_id = c.id
                and cta.teacher_id = (select auth.uid())
                and cta.status = 'active'
            )
            or exists (
              select 1 from public.class_enrollments ce
              where ce.class_id = c.id
                and ce.student_id = (select auth.uid())
                and ce.status = 'active'
            )
            or exists (
              select 1
              from public.class_enrollments ce
              join public.family_relationships fr on fr.student_id = ce.student_id
              where ce.class_id = c.id
                and ce.status = 'active'
                and fr.parent_id = (select auth.uid())
                and fr.status = 'active'
            )
          )
        )
      )
  );
$$;

revoke all on function public.is_administration() from public, anon;
revoke all on function public.is_school_member(uuid) from public, anon;
revoke all on function public.can_manage_school(uuid) from public, anon;
revoke all on function public.can_manage_user(uuid) from public, anon;
revoke all on function public.parent_has_student(uuid) from public, anon;
revoke all on function public.teacher_has_student(uuid) from public, anon;
revoke all on function public.can_access_student(uuid) from public, anon;
revoke all on function public.can_manage_student(uuid) from public, anon;
revoke all on function public.can_access_class(uuid) from public, anon;
grant execute on function public.is_administration() to authenticated;
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.can_manage_school(uuid) to authenticated;
grant execute on function public.can_manage_user(uuid) to authenticated;
grant execute on function public.parent_has_student(uuid) to authenticated;
grant execute on function public.teacher_has_student(uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;
grant execute on function public.can_manage_student(uuid) to authenticated;
grant execute on function public.can_access_class(uuid) to authenticated;

alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.student_profiles enable row level security;
alter table public.parent_profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.family_relationships enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.class_teacher_assignments enable row level security;

drop policy profiles_select_admin on public.profiles;
create policy profiles_select_scoped
on public.profiles for select to authenticated
using (
  public.can_access_student(id)
  or public.can_manage_user(id)
  or id = (select auth.uid())
);

drop policy user_roles_select_admin on public.user_roles;
create policy user_roles_select_administration
on public.user_roles for select to authenticated
using (
  public.has_role('direction')
  or public.can_manage_user(user_id)
);

drop policy audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_administration
on public.audit_logs for select to authenticated
using (
  public.has_role('direction')
  or (public.has_role('admin') and school_id is not null and public.can_manage_school(school_id))
);

create policy schools_select_member
on public.schools for select to authenticated
using (public.is_school_member(id) or public.has_role('direction'));

create policy school_memberships_select_scoped
on public.school_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_manage_school(school_id)
);

create policy student_profiles_select_scoped
on public.student_profiles for select to authenticated
using (public.can_access_student(user_id));

create policy parent_profiles_select_self_or_admin
on public.parent_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_manage_user(user_id)
);

create policy teacher_profiles_select_self_or_admin
on public.teacher_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_manage_user(user_id)
);

create policy admin_profiles_select_self_or_direction
on public.admin_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role('direction')
);

create policy family_relationships_select_scoped
on public.family_relationships for select to authenticated
using (
  parent_id = (select auth.uid())
  or student_id = (select auth.uid())
  or public.can_manage_student(student_id)
);

create policy classes_select_scoped
on public.classes for select to authenticated
using (public.can_access_class(id));

create policy class_enrollments_select_scoped
on public.class_enrollments for select to authenticated
using (
  (student_id = (select auth.uid()) and public.has_role('student'))
  or public.parent_has_student(student_id)
  or public.teacher_has_student(student_id)
  or public.can_manage_student(student_id)
);

create policy class_teacher_assignments_select_scoped
on public.class_teacher_assignments for select to authenticated
using (
  (teacher_id = (select auth.uid()) and public.has_role('teacher'))
  or exists (
    select 1
    from public.classes c
    where c.id = class_id
      and public.can_manage_school(c.school_id)
  )
);

revoke all on public.schools, public.school_memberships, public.student_profiles,
  public.parent_profiles, public.teacher_profiles, public.admin_profiles,
  public.family_relationships, public.classes, public.class_enrollments,
  public.class_teacher_assignments from anon;

revoke insert, update, delete, truncate, references, trigger
  on public.schools, public.school_memberships, public.student_profiles,
  public.parent_profiles, public.teacher_profiles, public.admin_profiles,
  public.family_relationships, public.classes, public.class_enrollments,
  public.class_teacher_assignments from authenticated;

grant select on public.schools, public.school_memberships, public.student_profiles,
  public.parent_profiles, public.teacher_profiles, public.admin_profiles,
  public.family_relationships, public.classes, public.class_enrollments,
  public.class_teacher_assignments to authenticated;

create function public.provision_account_data(
  target_user_id uuid,
  target_login_alias text,
  target_first_name text,
  target_last_name text,
  target_roles public.app_role[],
  target_school_id uuid,
  actor_user_id uuid,
  target_locale text default 'ar'
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_is_direction boolean;
  actor_is_admin boolean;
  normalized_display_name text;
begin
  if target_user_id is null or actor_user_id is null then
    raise exception using errcode = '22023', message = 'invalid_account_request';
  end if;

  if coalesce(array_length(target_roles, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'at_least_one_role_required';
  end if;

  if char_length(lower(trim(coalesce(target_login_alias, '')))) not between 3 and 80 then
    raise exception using errcode = '22023', message = 'invalid_login_alias';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception using errcode = '23503', message = 'auth_user_missing';
  end if;

  select
    exists (
      select 1 from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
      where ur.user_id = actor_user_id and ur.role = 'direction' and p.status = 'active'
    ),
    exists (
      select 1 from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
      join public.school_memberships sm on sm.user_id = ur.user_id
      where ur.user_id = actor_user_id
        and ur.role = 'admin'
        and p.status = 'active'
        and sm.school_id = target_school_id
        and sm.status = 'active'
    )
  into actor_is_direction, actor_is_admin;

  if not actor_is_direction and not actor_is_admin then
    raise exception using errcode = '42501', message = 'account_provision_forbidden';
  end if;

  if not actor_is_direction and target_roles && array['admin', 'direction']::public.app_role[] then
    raise exception using errcode = '42501', message = 'privileged_role_forbidden';
  end if;

  normalized_display_name := trim(target_first_name) || ' ' || trim(target_last_name);
  if char_length(trim(target_first_name)) not between 1 and 80
    or char_length(trim(target_last_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'invalid_person_name';
  end if;

  insert into public.profiles (
    id, first_name, last_name, display_name, locale, status, created_by
  ) values (
    target_user_id,
    trim(target_first_name),
    trim(target_last_name),
    normalized_display_name,
    target_locale,
    'pending',
    actor_user_id
  );

  insert into public.user_roles (user_id, role, assigned_by)
  select target_user_id, requested_role, actor_user_id
  from unnest(target_roles) as requested_role
  on conflict do nothing;

  insert into private.login_aliases (user_id, normalized_alias)
  values (target_user_id, lower(trim(target_login_alias)));

  insert into public.school_memberships (school_id, user_id, status, created_by)
  values (target_school_id, target_user_id, 'pending', actor_user_id);

  if 'student' = any(target_roles) then
    insert into public.student_profiles (user_id) values (target_user_id);
  end if;
  if 'parent' = any(target_roles) then
    insert into public.parent_profiles (user_id) values (target_user_id);
  end if;
  if 'teacher' = any(target_roles) then
    insert into public.teacher_profiles (user_id) values (target_user_id);
  end if;
  if target_roles && array['admin', 'direction']::public.app_role[] then
    insert into public.admin_profiles (user_id) values (target_user_id);
  end if;

  insert into public.audit_logs (
    actor_id, school_id, action, entity_type, entity_id, metadata
  ) values (
    actor_user_id,
    target_school_id,
    'account.provisioned',
    'profile',
    target_user_id::text,
    jsonb_build_object('roles', to_jsonb(target_roles), 'status', 'pending')
  );
end;
$$;

create function public.bootstrap_direction_data(
  target_user_id uuid,
  target_login_alias text,
  target_first_name text,
  target_last_name text,
  target_school_name text,
  target_school_code text,
  target_locale text default 'ar'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  created_school_id uuid;
begin
  if exists (select 1 from public.user_roles where role = 'direction') then
    raise exception using errcode = '42501', message = 'direction_bootstrap_closed';
  end if;
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception using errcode = '23503', message = 'auth_user_missing';
  end if;
  if char_length(lower(trim(coalesce(target_login_alias, '')))) not between 3 and 80 then
    raise exception using errcode = '22023', message = 'invalid_login_alias';
  end if;

  insert into public.profiles (
    id, first_name, last_name, display_name, locale, status
  ) values (
    target_user_id,
    trim(target_first_name),
    trim(target_last_name),
    trim(target_first_name) || ' ' || trim(target_last_name),
    target_locale,
    'active'
  );
  insert into public.user_roles (user_id, role)
  values (target_user_id, 'direction');
  insert into public.admin_profiles (user_id) values (target_user_id);
  insert into private.login_aliases (user_id, normalized_alias)
  values (target_user_id, lower(trim(target_login_alias)));

  insert into public.schools (name, code)
  values (trim(target_school_name), upper(trim(target_school_code)))
  returning id into created_school_id;

  insert into public.school_memberships (school_id, user_id, status)
  values (created_school_id, target_user_id, 'active');

  insert into public.audit_logs (
    actor_id, school_id, action, entity_type, entity_id, metadata
  ) values (
    target_user_id,
    created_school_id,
    'direction.bootstrapped',
    'profile',
    target_user_id::text,
    jsonb_build_object('role', 'direction')
  );

  return created_school_id;
end;
$$;

create function public.resolve_login_alias(target_login_alias text)
returns text
language sql
stable
security definer
set search_path = public, private, auth, pg_temp
as $$
  select auth_user.email
  from private.login_aliases login_alias
  join auth.users auth_user on auth_user.id = login_alias.user_id
  where login_alias.normalized_alias = lower(trim(target_login_alias))
  limit 1;
$$;

create function public.set_account_status(
  target_user_id uuid,
  target_status public.account_status,
  target_suspension_reason text,
  actor_user_id uuid,
  target_school_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_status public.account_status;
  actor_is_direction boolean;
  target_is_privileged boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = actor_user_id
      and ur.role = 'direction'
      and p.status = 'active'
  ) into actor_is_direction;

  if not exists (
    select 1
    from public.user_roles actor_role
    join public.profiles actor_profile on actor_profile.id = actor_role.user_id
    left join public.school_memberships actor_membership
      on actor_membership.user_id = actor_role.user_id
      and actor_membership.school_id = target_school_id
      and actor_membership.status = 'active'
    where actor_role.user_id = actor_user_id
      and actor_profile.status = 'active'
      and (
        actor_role.role = 'direction'
        or (actor_role.role = 'admin' and actor_membership.user_id is not null)
      )
  ) then
    raise exception using errcode = '42501', message = 'account_status_forbidden';
  end if;

  if not actor_is_direction and not exists (
    select 1 from public.school_memberships
    where school_id = target_school_id
      and user_id = target_user_id
      and status <> 'archived'
  ) then
    raise exception using errcode = '42501', message = 'target_outside_admin_school';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = target_user_id and role in ('admin', 'direction')
  ) into target_is_privileged;

  if target_is_privileged and not actor_is_direction then
    raise exception using errcode = '42501', message = 'privileged_status_change_forbidden';
  end if;

  if target_status = 'suspended'
    and char_length(trim(coalesce(target_suspension_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'suspension_reason_required';
  end if;

  select status into strict previous_status
  from public.profiles
  where id = target_user_id;

  update public.profiles
  set status = target_status,
      suspension_reason = case when target_status = 'suspended'
        then trim(target_suspension_reason) else null end,
      archived_at = case when target_status = 'archived' then now() else null end
  where id = target_user_id;

  update public.school_memberships
  set status = case
        when target_status = 'active' then 'active'::public.membership_status
        when target_status = 'pending' then 'pending'::public.membership_status
        when target_status = 'suspended' then 'suspended'::public.membership_status
        else 'archived'::public.membership_status
      end,
      ended_at = case when target_status = 'archived' then now() else null end
  where user_id = target_user_id and school_id = target_school_id;

  insert into public.audit_logs (
    actor_id, school_id, action, entity_type, entity_id, metadata
  ) values (
    actor_user_id,
    target_school_id,
    'account.status_changed',
    'profile',
    target_user_id::text,
    jsonb_build_object(
      'previous_status', previous_status,
      'new_status', target_status,
      'has_suspension_reason', target_status = 'suspended'
    )
  );
end;
$$;

revoke all on function public.provision_account_data(
  uuid, text, text, text, public.app_role[], uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.bootstrap_direction_data(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.resolve_login_alias(text) from public, anon, authenticated;
revoke all on function public.set_account_status(
  uuid, public.account_status, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.provision_account_data(
  uuid, text, text, text, public.app_role[], uuid, uuid, text
) to service_role;
grant execute on function public.bootstrap_direction_data(
  uuid, text, text, text, text, text, text
) to service_role;
grant execute on function public.resolve_login_alias(text) to service_role;
grant execute on function public.set_account_status(
  uuid, public.account_status, text, uuid, uuid
) to service_role;

comment on function public.provision_account_data(
  uuid, text, text, text, public.app_role[], uuid, uuid, text
) is 'Trusted server transaction after Supabase Auth admin user creation.';
comment on function public.bootstrap_direction_data(
  uuid, text, text, text, text, text, text
) is 'One-time service-role bootstrap; closes after the first direction role exists.';
comment on table private.legacy_account_links is
  'V1 account mapping without legacy passwords or raw login identifiers.';

commit;
