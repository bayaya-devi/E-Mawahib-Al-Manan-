begin;

alter table public.learning_events
  add column if not exists legacy_source_key text;

alter table public.parent_feedback
  add column if not exists school_id uuid references public.schools(id) on delete restrict;

create unique index if not exists learning_events_legacy_source_unique
  on public.learning_events(legacy_source_key)
  where legacy_source_key is not null;

create table if not exists public.legacy_history_records (
  id uuid primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  source_name text not null,
  legacy_id text not null,
  category text not null check (category in (
    'student_message', 'student_payment_snapshot', 'student_admin_snapshot',
    'schedule_snapshot', 'teacher_report', 'remote_class', 'remote_attendance',
    'remote_status', 'unmapped_record'
  )),
  subject_id uuid references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  occurred_at timestamptz,
  historical_date_label text,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  migrated_at timestamptz not null default now(),
  unique(source_name, legacy_id, category)
);

create index if not exists legacy_history_subject_time_idx
  on public.legacy_history_records(subject_id, occurred_at desc nulls last);
create index if not exists legacy_history_actor_time_idx
  on public.legacy_history_records(actor_id, occurred_at desc nulls last);
create index if not exists legacy_history_school_category_idx
  on public.legacy_history_records(school_id, category, occurred_at desc nulls last);

create table if not exists public.legacy_migration_records (
  id bigint generated always as identity primary key,
  batch_key text not null,
  source_name text not null,
  source_table text not null,
  legacy_id text not null,
  target_table text,
  target_id text,
  fingerprint text not null,
  disposition text not null check (disposition in (
    'already_present', 'restored', 'reconciled', 'historically_deleted',
    'ambiguous', 'insufficient_source', 'error'
  )),
  detail jsonb not null default '{}'::jsonb,
  migrated_at timestamptz not null default now(),
  unique(source_name, source_table, legacy_id, target_table)
);

alter table public.legacy_history_records enable row level security;
alter table public.legacy_migration_records enable row level security;

drop policy if exists legacy_history_records_read on public.legacy_history_records;
create policy legacy_history_records_read on public.legacy_history_records
for select to authenticated using (
  subject_id = (select auth.uid())
  or actor_id = (select auth.uid())
  or (subject_id is not null and public.parent_has_student(subject_id))
  or public.can_manage_school(school_id)
);

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

revoke all on public.legacy_history_records, public.legacy_migration_records from anon;
revoke insert, update, delete, truncate, references, trigger on public.legacy_history_records from authenticated;
grant select on public.legacy_history_records to authenticated;
revoke all on public.legacy_migration_records from authenticated;
grant all on public.legacy_history_records, public.legacy_migration_records to service_role;
grant usage, select on sequence public.legacy_migration_records_id_seq to service_role;

comment on table public.legacy_history_records is
  'Read-only archive for legitimate V1 history that cannot be represented without inventing missing dates or relations.';
comment on table public.legacy_migration_records is
  'Server-only provenance and idempotency ledger for V1 to V3 historical recovery.';

commit;
