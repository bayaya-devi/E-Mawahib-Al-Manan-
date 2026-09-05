begin;

drop policy if exists parent_feedback_student_select on public.parent_feedback;
create policy parent_feedback_student_select on public.parent_feedback
for select to authenticated using (
  student_id = (select auth.uid())
  or (student_id is not null and public.parent_has_student(student_id))
  or public.can_manage_school(coalesce(
    school_id,
    (select sm.school_id from public.school_memberships sm where sm.user_id = parent_feedback.student_id and sm.status = 'active' limit 1)
  ))
);

commit;
