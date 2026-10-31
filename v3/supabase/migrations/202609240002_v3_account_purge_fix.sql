begin;

-- The former purge routine referenced a table that never existed in V3,
-- causing every definitive deletion to roll back.  Keep the routine intact
-- and remove only that invalid statement.
create or replace function public.cleanup_provisioned_account_data(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  delete from public.message_attachments where message_id in (select id from public.conversation_messages where sender_id = target_user_id);
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

commit;
