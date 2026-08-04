-- E-Mawahib Al-Manan: fondation admin non destructive
create extension if not exists pgcrypto;
create table if not exists public.school_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  level text,
  principal_teacher_id uuid,
  capacity integer not null default 30 check (capacity > 0),
  schedule_days text[] not null default '{}',
  schedule_text text,
  room text,
  status text not null default 'active' check (status in ('active','archived')),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.student_admin_profiles (
  username text primary key,
  birth_date date,
  gender text check (gender in ('male','female','unknown')),
  guardian_name text,
  guardian_phone text,
  guardian_phone_secondary text,
  address text,
  level text,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  can_leave_alone boolean not null default false,
  needs_companion boolean not null default false,
  companion_identity text,
  enrollment_date date,
  administrative_notes text,
  pedagogical_notes text,
  disciplinary_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.teacher_admin_profiles (
  username text primary key,
  gender text check (gender in ('male','female','unknown')),
  phone text,
  email text,
  subject text,
  start_date date,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.class_students (
  class_id uuid not null references public.school_classes(id) on delete restrict,
  student_username text not null,
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (class_id, student_username)
);
create table if not exists public.teacher_classes (
  class_id uuid not null references public.school_classes(id) on delete restrict,
  teacher_username text not null,
  is_principal boolean not null default false,
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (class_id, teacher_username)
);
create table if not exists public.school_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  sender_role text not null check (sender_role in ('admin','prof','student','parent')),
  recipient_id text not null,
  recipient_role text not null check (recipient_role in ('admin','prof','student','parent')),
  subject text,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  is_read boolean not null default false,
  status text not null default 'sent' check (status in ('sent','read','archived')),
  parent_message_id uuid references public.school_messages(id) on delete set null,
  archived_at timestamptz
);
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_class_students_student on public.class_students(student_username) where removed_at is null;
create index if not exists idx_teacher_classes_teacher on public.teacher_classes(teacher_username) where removed_at is null;
create index if not exists idx_school_messages_recipient on public.school_messages(recipient_id, is_read, created_at desc);
create index if not exists idx_school_messages_sender on public.school_messages(sender_id, created_at desc);
create index if not exists idx_admin_audit_entity on public.admin_audit_logs(entity_type, entity_id, created_at desc);
-- RLS sera ajouté après raccordement de Supabase Auth, car les comptes actuels sont locaux.