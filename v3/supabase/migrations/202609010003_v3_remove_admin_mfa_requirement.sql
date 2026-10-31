-- Administration remains protected by authenticated roles and school scope.
-- The additional AAL2/TOTP requirement is intentionally disabled.

create or replace function public.require_administration_aal2()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_administration() then
    raise exception 'administration_role_required';
  end if;
end;
$$;

create or replace function public.can_manage_school(target_school_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_role('direction')
    or (public.has_role('admin') and public.is_school_member(target_school_id));
$$;
