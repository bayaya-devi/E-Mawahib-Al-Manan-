begin;

drop policy if exists legacy_history_records_read on public.legacy_history_records;
create policy legacy_history_records_read on public.legacy_history_records
for select to authenticated using (
  subject_id = (select auth.uid())
  or actor_id = (select auth.uid())
  or (subject_id is not null and public.parent_has_student(subject_id))
  or public.can_manage_school(school_id)
);

commit;
