begin;

do $$
declare
  table_name text;
  actual_roles text[];
  actual_statuses text[];
begin
  foreach table_name in array array[
    'profiles',
    'user_roles',
    'audit_logs',
    'schools',
    'school_memberships',
    'student_profiles',
    'parent_profiles',
    'teacher_profiles',
    'admin_profiles',
    'family_relationships',
    'classes',
    'class_enrollments',
    'class_teacher_assignments'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;

    if has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') then
      raise exception 'authenticated users have write privileges on public.%', table_name;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT') then
    raise exception 'authenticated users must not assign roles';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'anonymous users must not read profiles';
  end if;

  select array_agg(e.enumlabel order by e.enumsortorder)
  into actual_roles
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'app_role';

  if actual_roles <> array['student', 'parent', 'teacher', 'admin', 'direction'] then
    raise exception 'Unexpected app roles: %', actual_roles;
  end if;

  select array_agg(e.enumlabel order by e.enumsortorder)
  into actual_statuses
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'account_status';

  if actual_statuses <> array['pending', 'active', 'suspended', 'archived'] then
    raise exception 'Unexpected account statuses: %', actual_statuses;
  end if;

  if (select count(*) from pg_policies where schemaname = 'public') <> 15 then
    raise exception 'Unexpected RLS policy count';
  end if;
end;
$$;

rollback;
