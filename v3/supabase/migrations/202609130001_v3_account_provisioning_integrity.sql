begin;

alter table public.student_digital_files
  add column if not exists guardian_first_name text,
  add column if not exists guardian_last_name text,
  add column if not exists guardian_secondary_phone text,
  add column if not exists can_leave_alone boolean not null default false;

create or replace function public.admin_update_person(target_user_id uuid, payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare school uuid; actor uuid := (select auth.uid()); target_role public.app_role;
begin
  perform public.require_administration_aal2();
  select sm.school_id into school from public.school_memberships sm where sm.user_id = target_user_id and sm.status = 'active' limit 1;
  if school is null or not public.can_manage_school(school) then raise exception 'person_scope_denied'; end if;
  update public.profiles set
    first_name = coalesce(nullif(trim(payload->>'first_name'), ''), first_name),
    last_name = coalesce(nullif(trim(payload->>'last_name'), ''), last_name),
    display_name = trim(concat(coalesce(nullif(trim(payload->>'first_name'), ''), first_name), ' ', coalesce(nullif(trim(payload->>'last_name'), ''), last_name)))
  where id = target_user_id;
  select role into target_role from public.user_roles where user_id = target_user_id and role in ('student','teacher') order by role limit 1;
  if target_role = 'student' then
    update public.student_profiles set date_of_birth = nullif(payload->>'date_of_birth','')::date,
      gender = coalesce(nullif(payload->>'gender',''), gender), accessibility_notes = nullif(trim(payload->>'accessibility_notes'),'')
    where user_id = target_user_id;
    insert into public.student_digital_files(
      student_id, school_id, guardian_name, guardian_first_name, guardian_last_name,
      guardian_phone, guardian_secondary_phone, guardian_email, secondary_contact,
      can_leave_alone, monthly_fee, payment_required,
      identity_document_received, birth_certificate_received, guardian_identity_received,
      medical_or_accessibility_notes, administrative_notes, updated_by
    ) values(
      target_user_id, school,
      nullif(trim(concat_ws(' ', nullif(trim(payload->>'guardian_first_name'), ''), nullif(trim(payload->>'guardian_last_name'), ''))), ''),
      nullif(trim(payload->>'guardian_first_name'), ''), nullif(trim(payload->>'guardian_last_name'), ''),
      nullif(trim(payload->>'guardian_phone'), ''), nullif(trim(payload->>'guardian_secondary_phone'), ''),
      nullif(trim(payload->>'guardian_email'), ''), nullif(trim(payload->>'secondary_contact'), ''),
      coalesce((payload->>'can_leave_alone')::boolean, false),
      coalesce((payload->>'monthly_fee')::numeric, 0), coalesce((payload->>'monthly_fee')::numeric, 0) > 0,
      coalesce((payload->>'identity_document_received')::boolean, false),
      coalesce((payload->>'birth_certificate_received')::boolean, false),
      coalesce((payload->>'guardian_identity_received')::boolean, false),
      nullif(trim(payload->>'accessibility_notes'), ''), nullif(trim(payload->>'administrative_notes'), ''), actor
    )
    on conflict(student_id) do update set
      guardian_name = excluded.guardian_name,
      guardian_first_name = excluded.guardian_first_name,
      guardian_last_name = excluded.guardian_last_name,
      guardian_phone = excluded.guardian_phone,
      guardian_secondary_phone = excluded.guardian_secondary_phone,
      guardian_email = excluded.guardian_email,
      secondary_contact = excluded.secondary_contact,
      can_leave_alone = excluded.can_leave_alone,
      monthly_fee = excluded.monthly_fee,
      payment_required = excluded.payment_required,
      identity_document_received = excluded.identity_document_received,
      birth_certificate_received = excluded.birth_certificate_received,
      guardian_identity_received = excluded.guardian_identity_received,
      medical_or_accessibility_notes = excluded.medical_or_accessibility_notes,
      administrative_notes = excluded.administrative_notes,
      updated_by = actor;
  elsif target_role = 'teacher' then
    update public.teacher_profiles set phone = nullif(trim(payload->>'phone'), ''), email = nullif(trim(payload->>'email'), ''),
      gender = coalesce(nullif(payload->>'gender',''), gender), monthly_salary = coalesce((payload->>'monthly_salary')::numeric, monthly_salary)
    where user_id = target_user_id;
  end if;
  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'admin.person_updated', 'profile', target_user_id, jsonb_build_object('role', target_role));
end;
$$;

create or replace function public.cleanup_provisioned_account_data(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  delete from public.student_digital_files where student_id = target_user_id;
  delete from public.class_enrollments where student_id = target_user_id;
  delete from public.class_teacher_assignments where teacher_id = target_user_id;
  delete from public.student_profiles where user_id = target_user_id;
  delete from public.teacher_profiles where user_id = target_user_id;
  delete from public.parent_profiles where user_id = target_user_id;
  delete from public.admin_profiles where user_id = target_user_id;
  delete from public.school_memberships where user_id = target_user_id;
  delete from private.login_aliases where user_id = target_user_id;
  delete from public.user_roles where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
end;
$$;

revoke all on function public.cleanup_provisioned_account_data(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_provisioned_account_data(uuid) to service_role;

commit;
