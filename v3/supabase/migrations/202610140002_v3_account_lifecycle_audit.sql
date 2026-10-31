begin;

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_deleted_consistency;
alter table public.profiles add constraint profiles_deleted_consistency check (
  deleted_at is null or status = 'archived'
);

create index if not exists profiles_deleted_at_idx on public.profiles(deleted_at)
  where deleted_at is not null;

create or replace function private.sanitize_audit_metadata(payload jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare result jsonb;
begin
  if payload is null then return '{}'::jsonb; end if;
  if jsonb_typeof(payload) = 'object' then
    select coalesce(jsonb_object_agg(key, private.sanitize_audit_metadata(value)), '{}'::jsonb)
    into result
    from jsonb_each(payload)
    where key !~* '(password|secret|token|authorization|cookie)';
    return result;
  elsif jsonb_typeof(payload) = 'array' then
    select coalesce(jsonb_agg(private.sanitize_audit_metadata(value)), '[]'::jsonb)
    into result from jsonb_array_elements(payload);
    return result;
  end if;
  return payload;
end;
$$;

create or replace function public.audit_logs_sanitize_insert()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  new.metadata := private.sanitize_audit_metadata(new.metadata);
  return new;
end;
$$;

drop trigger if exists audit_logs_sanitize_insert on public.audit_logs;
create trigger audit_logs_sanitize_insert before insert on public.audit_logs
for each row execute function public.audit_logs_sanitize_insert();

create or replace function public.protect_account_lifecycle()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'active' then
    new.deleted_at := null;
    new.deleted_by := null;
  end if;
  if old.status = 'active' and new.status <> 'active'
    and exists(select 1 from public.user_roles where user_id=old.id and role='direction')
    and (select count(*) from public.user_roles ur join public.profiles p on p.id=ur.user_id
         where ur.role='direction' and p.status='active') <= 1 then
    raise exception 'last_direction_account_required';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_account_lifecycle on public.profiles;
create trigger profiles_protect_account_lifecycle before update on public.profiles
for each row execute function public.protect_account_lifecycle();

create or replace function public.admin_soft_delete_account(
  target_user_id uuid,
  target_school_id uuid
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid()); target_is_privileged boolean;
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

  update public.profiles set status='archived', archived_at=coalesce(archived_at,now()),
    deleted_at=now(), deleted_by=actor, suspension_reason=null
  where id=target_user_id;
  if not found then raise exception 'account_not_found'; end if;
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

create or replace function public.admin_restore_account(
  target_user_id uuid,
  target_school_id uuid
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := (select auth.uid());
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) then raise exception 'account_scope_denied'; end if;
  if not exists(select 1 from public.school_memberships where user_id=target_user_id and school_id=target_school_id) then
    raise exception 'account_scope_denied';
  end if;
  if exists(select 1 from public.user_roles where user_id=target_user_id and role in ('admin','direction'))
    and not public.has_role('direction') then raise exception 'privileged_status_change_forbidden'; end if;
  update public.profiles set status='active',archived_at=null,deleted_at=null,deleted_by=null,suspension_reason=null
  where id=target_user_id and deleted_at is not null;
  if not found then raise exception 'account_not_in_trash'; end if;
  update public.school_memberships set status='active',ended_at=null
  where user_id=target_user_id and school_id=target_school_id;
  insert into public.audit_logs(actor_id,school_id,action,entity_type,entity_id,metadata)
  values(actor,target_school_id,'account.restored_from_trash','profile',target_user_id,'{}');
end;
$$;

revoke all on function private.sanitize_audit_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.audit_logs_sanitize_insert() from public, anon, authenticated;
revoke all on function public.protect_account_lifecycle() from public, anon, authenticated;
revoke all on function public.admin_soft_delete_account(uuid,uuid) from public, anon;
revoke all on function public.admin_restore_account(uuid,uuid) from public, anon;
grant execute on function public.admin_soft_delete_account(uuid,uuid) to authenticated;
grant execute on function public.admin_restore_account(uuid,uuid) to authenticated;

comment on column public.profiles.deleted_at is 'Trash timestamp. Archival without deletion keeps this null.';
comment on function public.admin_restore_account(uuid,uuid) is 'Restores identity access only; historical class assignments remain closed.';

commit;
