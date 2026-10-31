begin;

revoke insert on public.parent_feedback from authenticated;

create or replace function public.submit_parent_feedback(target_scores smallint[], target_comment text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.has_role('student') then raise exception 'student_session_required'; end if;
  if cardinality(target_scores) <> 5 or exists (select 1 from unnest(target_scores) value where value < 1 or value > 10) then raise exception 'invalid_scores'; end if;
  insert into public.parent_feedback (student_id, scores, comment) values (auth.uid(), target_scores, nullif(trim(target_comment), ''));
end;
$$;

revoke all on function public.submit_parent_feedback(smallint[], text) from public, anon;
grant execute on function public.submit_parent_feedback(smallint[], text) to authenticated;
commit;
