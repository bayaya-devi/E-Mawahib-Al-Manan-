begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'user_roles', 'audit_logs']
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
  end loop;

  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT') then
    raise exception 'authenticated users must not assign roles';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'anonymous users must not read profiles';
  end if;
end;
$$;

rollback;
