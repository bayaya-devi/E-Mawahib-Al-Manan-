begin;

-- A class may be prepared before its teacher is assigned.  Enrollment must not
-- prevent the administration from creating the student's account in that case.
create or replace function public.admin_set_student_relations(
  target_student_id uuid,
  target_class_id uuid,
  target_teacher_ids uuid[]
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  school uuid;
  actor uuid := (select auth.uid());
  teacher uuid;
  requested_teachers uuid[] := coalesce(target_teacher_ids, '{}');
begin
  perform public.require_administration_aal2();

  select school_id into school
  from public.school_memberships
  where user_id = actor and status = 'active'
  limit 1;

  if school is null or not public.can_manage_school(school)
    or not exists (
      select 1 from public.school_memberships
      where user_id = target_student_id and school_id = school and status = 'active'
    ) then
    raise exception 'student_scope_denied';
  end if;

  if not exists (
    select 1 from public.classes
    where id = target_class_id and school_id = school and status = 'active'
  ) then
    raise exception 'class_scope_denied';
  end if;

  if cardinality(requested_teachers) = 0 then
    select teacher_id into teacher
    from public.class_teacher_assignments
    where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
    limit 1;
    if teacher is not null then
      requested_teachers := array[teacher];
    end if;
  end if;

  if cardinality(requested_teachers) > 0 and exists (
    select 1
    from unnest(requested_teachers) requested(id)
    left join public.teacher_profiles tp on tp.user_id = requested.id
    left join public.school_memberships sm
      on sm.user_id = requested.id and sm.school_id = school and sm.status = 'active'
    where tp.user_id is null or sm.user_id is null
  ) then
    raise exception 'teacher_scope_denied';
  end if;

  foreach teacher in array requested_teachers loop
    if not exists (
      select 1 from public.class_teacher_assignments
      where class_id = target_class_id and teacher_id = teacher and status = 'active'
    ) then
      insert into public.class_teacher_assignments(
        class_id, teacher_id, assignment_kind, status, created_by
      ) values (
        target_class_id,
        teacher,
        case when exists (
          select 1 from public.class_teacher_assignments
          where class_id = target_class_id and status = 'active' and assignment_kind = 'primary'
        ) then 'assistant'::public.teacher_assignment_kind else 'primary'::public.teacher_assignment_kind end,
        'active', actor
      );
    end if;
  end loop;

  update public.class_enrollments
  set status = 'withdrawn', ended_at = now()
  where student_id = target_student_id and status = 'active' and class_id <> target_class_id;

  insert into public.class_enrollments(class_id, student_id, status, ended_at, created_by)
  values(target_class_id, target_student_id, 'active', null, actor)
  on conflict (class_id, student_id) do update
    set status = 'active', ended_at = null;

  insert into public.audit_logs(actor_id, school_id, action, entity_type, entity_id, metadata)
  values(actor, school, 'admin.student_relations_updated', 'student', target_student_id,
    jsonb_build_object('class_id', target_class_id, 'teacher_ids', requested_teachers));
end;
$$;

-- Explicit permanent deletion deliberately removes the target account's
-- educational and operational records before deleting its identity.  Finance
-- and school incidents use SET NULL and remain as anonymous accounting facts.
create or replace function public.cleanup_provisioned_account_data(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  delete from public.message_attachments where message_id in (
    select id from public.conversation_messages where sender_id = target_user_id
  );
  delete from public.conversation_messages where sender_id = target_user_id;
  delete from public.conversation_members where user_id = target_user_id;
  delete from public.conversations where created_by = target_user_id;
  delete from public.service_request_events where actor_id = target_user_id;
  delete from public.service_requests where requester_id = target_user_id;
  delete from public.staff_messages where sender_id = target_user_id or recipient_id = target_user_id;
  delete from public.legacy_history_records where subject_id = target_user_id or actor_id = target_user_id;

  delete from public.assignment_submissions where student_id = target_user_id;
  delete from public.assignments where student_id = target_user_id or teacher_id = target_user_id;
  delete from public.exam_results where student_id = target_user_id;
  delete from public.attendance_records where student_id = target_user_id or recorded_by = target_user_id;
  delete from public.learning_goals where student_id = target_user_id;
  delete from public.student_verse_progress where student_id = target_user_id;
  delete from public.student_surah_progress where student_id = target_user_id;
  delete from public.review_passages where student_id = target_user_id;
  delete from public.learning_events where student_id = target_user_id;
  delete from public.game_attempts where student_id = target_user_id;
  delete from public.recitation_attempts where student_id = target_user_id;
  delete from public.authorized_documents where student_id = target_user_id or uploaded_by = target_user_id;
  delete from private.v1_learning_imports where student_id = target_user_id;
  delete from public.student_learning_sessions where student_id = target_user_id;
  delete from public.teacher_student_notes where student_id = target_user_id or teacher_id = target_user_id;
  delete from public.teacher_quick_absences where student_id = target_user_id or teacher_id = target_user_id;
  delete from public.teacher_student_list_preferences where student_id = target_user_id or teacher_id = target_user_id;
  delete from public.parent_feedback where student_id = target_user_id;
  delete from public.student_family_profiles where student_id = target_user_id;
  delete from public.family_relationships where student_id = target_user_id or parent_id = target_user_id;

  delete from public.teacher_recitations where student_id = target_user_id or recorded_by = target_user_id;
  delete from public.teacher_session_students where student_id = target_user_id;
  delete from public.teacher_session_reports where teacher_id = target_user_id;
  delete from public.teacher_session_runs where teacher_id = target_user_id;
  delete from public.course_sessions where teacher_id = target_user_id;
  delete from public.teacher_requests where teacher_id = target_user_id;
  delete from public.teacher_salary_records where teacher_id = target_user_id;
  delete from public.teacher_documents where teacher_id = target_user_id or uploaded_by = target_user_id;

  delete from public.school_announcements where created_by = target_user_id;
  delete from public.school_events where created_by = target_user_id;
  delete from public.exams where created_by = target_user_id;
  delete from public.validated_learning_content where validated_by = target_user_id;
  delete from public.school_incidents where created_by = target_user_id;
  delete from public.finance_transactions where created_by = target_user_id;
  delete from public.school_documents where uploaded_by = target_user_id;
  delete from public.academic_years where created_by = target_user_id;
  delete from public.admin_permission_grants where user_id = target_user_id or granted_by = target_user_id;
  delete from public.contact_verification_challenges where user_id = target_user_id;
  delete from public.offline_mutation_receipts where user_id = target_user_id;

  delete from public.student_digital_files where student_id = target_user_id;
  delete from public.class_enrollments where student_id = target_user_id;
  delete from public.class_teacher_assignments where teacher_id = target_user_id;
  delete from public.staff_profiles where user_id = target_user_id;
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
