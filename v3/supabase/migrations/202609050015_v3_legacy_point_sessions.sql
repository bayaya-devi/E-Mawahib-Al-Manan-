begin;

alter table public.course_sessions drop constraint if exists course_sessions_check;
alter table public.course_sessions
  add constraint course_sessions_check check (ends_at >= starts_at);

comment on constraint course_sessions_check on public.course_sessions is
  'Equal timestamps are reserved for imported historical point-in-time recitations whose duration was not recorded.';

commit;
