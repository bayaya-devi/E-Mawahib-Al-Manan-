begin;

create table if not exists public.parent_feedback (
  id uuid primary key default gen_random_uuid(), student_id uuid not null default auth.uid() references public.student_profiles(user_id) on delete cascade,
  scores smallint[] not null check (cardinality(scores) = 5 and scores <@ array[1,2,3,4,5,6,7,8,9,10]::smallint[]), comment text, created_at timestamptz not null default now()
);
alter table public.parent_feedback add column if not exists student_id uuid references public.student_profiles(user_id) on delete cascade;
alter table public.parent_feedback alter column student_id set default auth.uid();
alter table public.parent_feedback add column if not exists scores smallint[];
alter table public.parent_feedback add column if not exists comment text;
alter table public.parent_feedback add column if not exists created_at timestamptz not null default now();
create index if not exists parent_feedback_student_idx on public.parent_feedback(student_id, created_at desc);
alter table public.parent_feedback enable row level security;
drop policy if exists parent_feedback_student_insert on public.parent_feedback;
drop policy if exists parent_feedback_student_select on public.parent_feedback;
drop policy if exists student_digital_files_student_read on public.student_digital_files;
drop policy if exists finance_transactions_student_read on public.finance_transactions;
create policy parent_feedback_student_insert on public.parent_feedback for insert to authenticated with check (student_id = auth.uid() and public.has_role('student'));
create policy parent_feedback_student_select on public.parent_feedback for select to authenticated using (student_id = auth.uid() or public.can_manage_school((select school_id from public.school_memberships where user_id = parent_feedback.student_id and status = 'active' limit 1)));
create policy student_digital_files_student_read on public.student_digital_files for select to authenticated using (student_id = auth.uid());
create policy finance_transactions_student_read on public.finance_transactions for select to authenticated using (student_id = auth.uid());
revoke all on public.parent_feedback from anon;
grant select, insert on public.parent_feedback to authenticated;
commit;
