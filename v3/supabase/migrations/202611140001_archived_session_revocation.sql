begin;

create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'active'
      and deleted_at is null
  );
$$;

revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

-- A valid JWT is not sufficient after an account is archived. This
-- restrictive policy is combined with every existing public-table policy,
-- closing direct PostgREST access for all previously issued sessions.
do $$
declare
  relation record;
begin
  for relation in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    execute format('drop policy if exists active_account_gate on public.%I', relation.relname);
    execute format(
      'create policy active_account_gate on public.%I as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account())',
      relation.relname
    );
  end loop;
end;
$$;

create or replace function public.admin_soft_delete_account(
  target_user_id uuid,
  target_school_id uuid
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := (select auth.uid());
  target_is_privileged boolean;
  target_deleted_at timestamptz;
begin
  perform public.require_administration_aal2();
  if actor = target_user_id then raise exception 'self_delete_forbidden'; end if;
  if not public.can_manage_school(target_school_id) then raise exception 'account_scope_denied'; end if;
  if not exists(select 1 from public.school_memberships where user_id=target_user_id and school_id=target_school_id) then
    raise exception 'account_scope_denied';
  end if;
  if exists(select 1 from public.school_memberships where user_id=target_user_id and school_id<>target_school_id and status='active')
    and not public.has_role('direction') then raise exception 'multi_school_account_requires_direction'; end if;
  select exists(select 1 from public.user_roles where user_id=target_user_id and role in ('admin','direction'))
  into target_is_privileged;
  if target_is_privileged and not public.has_role('direction') then raise exception 'privileged_status_change_forbidden'; end if;

  select deleted_at into target_deleted_at
  from public.profiles
  where id=target_user_id
  for update;
  if not found then raise exception 'account_not_found'; end if;
  if target_deleted_at is not null then return; end if;

  update public.profiles set status='archived', archived_at=coalesce(archived_at,now()),
    deleted_at=now(), deleted_by=actor, suspension_reason=null
  where id=target_user_id;
  update public.school_memberships set status='archived',ended_at=coalesce(ended_at,now())
  where user_id=target_user_id;
  update public.class_enrollments ce set status='withdrawn',ended_at=coalesce(ended_at,now())
  where ce.student_id=target_user_id and ce.status='active'
    and exists(select 1 from public.classes c where c.id=ce.class_id and c.school_id=target_school_id);
  update public.class_teacher_assignments cta set status='archived',ended_at=coalesce(ended_at,now())
  where cta.teacher_id=target_user_id and cta.status='active'
    and exists(select 1 from public.classes c where c.id=cta.class_id and c.school_id=target_school_id);
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,target_school_id,'account.moved_to_trash','profile',target_user_id,'{}');
end;
$$;

revoke all on function public.admin_soft_delete_account(uuid,uuid) from public, anon;
grant execute on function public.admin_soft_delete_account(uuid,uuid) to authenticated;

commit;
