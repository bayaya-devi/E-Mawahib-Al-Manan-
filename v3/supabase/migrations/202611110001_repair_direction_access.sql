begin;

do $$
declare
  direction_user_id uuid;
  direction_count integer;
begin
  select count(*)
  into direction_count
  from public.user_roles
  where role = 'direction';

  if direction_count = 0 then
    return;
  end if;

  if direction_count <> 1 then
    raise exception 'expected_exactly_one_direction_account';
  end if;

  select user_id
  into direction_user_id
  from public.user_roles
  where role = 'direction';

  insert into private.login_aliases (user_id, normalized_alias)
  values (direction_user_id, 't_auti1.0110')
  on conflict (user_id) do update
    set normalized_alias = excluded.normalized_alias;
end;
$$;

commit;
