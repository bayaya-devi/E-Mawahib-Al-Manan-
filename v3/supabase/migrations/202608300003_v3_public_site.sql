create type public.public_locale as enum ('ar', 'fr', 'en', 'amz');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.public_content_kind as enum ('news', 'replay');

create table public.public_site_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  phone text,
  email text,
  map_url text,
  minimum_age integer check (minimum_age is null or minimum_age between 3 and 99),
  monthly_fee numeric(12,2) check (monthly_fee is null or monthly_fee >= 0),
  registration_open boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_site_profile_translations (
  profile_id uuid not null references public.public_site_profiles(id) on delete cascade,
  locale public.public_locale not null,
  name text not null check (char_length(name) between 2 and 160),
  tagline text not null check (char_length(tagline) between 2 and 240),
  description text not null,
  address text,
  registration_note text,
  primary key (profile_id, locale)
);

create table public.public_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, slug)
);

create table public.public_category_translations (
  category_id uuid not null references public.public_categories(id) on delete cascade,
  locale public.public_locale not null,
  name text not null check (char_length(name) between 1 and 100),
  primary key (category_id, locale)
);

create table public.public_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  status public.publication_status not null default 'draft',
  image_url text,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, slug)
);

create table public.public_program_translations (
  program_id uuid not null references public.public_programs(id) on delete cascade,
  locale public.public_locale not null,
  title text not null check (char_length(title) between 2 and 160),
  summary text not null,
  body text,
  primary key (program_id, locale)
);

create table public.public_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  program_id uuid references public.public_programs(id) on delete set null,
  audience text not null check (char_length(audience) between 1 and 80),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  location text,
  active boolean not null default true,
  effective_from date,
  effective_to date,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table public.public_schedule_translations (
  schedule_id uuid not null references public.public_schedules(id) on delete cascade,
  locale public.public_locale not null,
  title text not null check (char_length(title) between 1 and 160),
  notes text,
  primary key (schedule_id, locale)
);

create table public.public_news (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category_id uuid references public.public_categories(id) on delete set null,
  status public.publication_status not null default 'draft',
  image_url text,
  event_date date,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_news_translations (
  news_id uuid not null references public.public_news(id) on delete cascade,
  locale public.public_locale not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 2 and 180),
  excerpt text not null,
  body text not null,
  primary key (news_id, locale),
  unique (locale, slug)
);

create table public.public_replays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  status public.publication_status not null default 'draft',
  video_url text not null,
  thumbnail_url text,
  speaker text,
  event_date date,
  featured boolean not null default false,
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_replay_translations (
  replay_id uuid not null references public.public_replays(id) on delete cascade,
  locale public.public_locale not null,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 2 and 180),
  description text not null,
  primary key (replay_id, locale),
  unique (locale, slug)
);

create table public.public_replay_categories (
  replay_id uuid not null references public.public_replays(id) on delete cascade,
  category_id uuid not null references public.public_categories(id) on delete cascade,
  primary key (replay_id, category_id)
);

create table private.public_content_likes (
  kind public.public_content_kind not null,
  content_id uuid not null,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (kind, content_id, visitor_hash)
);

create table private.public_like_rate_limits (
  kind public.public_content_kind not null,
  content_id uuid not null,
  network_hash text not null check (char_length(network_hash) = 64),
  bucket_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (kind, content_id, network_hash, bucket_date)
);

create table private.public_content_views (
  kind public.public_content_kind not null,
  content_id uuid not null,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  bucket_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (kind, content_id, visitor_hash, bucket_date)
);

create index public_news_listing_idx on public.public_news (school_id, status, published_at desc);
create index public_replays_listing_idx on public.public_replays (school_id, status, featured desc, published_at desc);
create index public_schedules_listing_idx on public.public_schedules (school_id, active, day_of_week, starts_at);

alter table public.public_site_profiles enable row level security;
alter table public.public_site_profile_translations enable row level security;
alter table public.public_categories enable row level security;
alter table public.public_category_translations enable row level security;
alter table public.public_programs enable row level security;
alter table public.public_program_translations enable row level security;
alter table public.public_schedules enable row level security;
alter table public.public_schedule_translations enable row level security;
alter table public.public_news enable row level security;
alter table public.public_news_translations enable row level security;
alter table public.public_replays enable row level security;
alter table public.public_replay_translations enable row level security;
alter table public.public_replay_categories enable row level security;

grant select on public.public_site_profiles, public.public_site_profile_translations,
  public.public_categories, public.public_category_translations, public.public_programs,
  public.public_program_translations, public.public_schedules, public.public_schedule_translations,
  public.public_news, public.public_news_translations, public.public_replays,
  public.public_replay_translations, public.public_replay_categories to anon, authenticated;

revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on private.public_content_likes, private.public_like_rate_limits,
  private.public_content_views from public, anon, authenticated;
grant execute on function public.can_manage_school(uuid) to anon;

create policy public_site_profile_read on public.public_site_profiles for select to anon, authenticated using (true);
create policy public_site_profile_translation_read on public.public_site_profile_translations for select to anon, authenticated using (true);
create policy public_category_read on public.public_categories for select to anon, authenticated using (active or public.can_manage_school(school_id));
create policy public_category_translation_read on public.public_category_translations for select to anon, authenticated using (
  exists (select 1 from public.public_categories c where c.id = category_id and (c.active or public.can_manage_school(c.school_id)))
);
create policy public_program_read on public.public_programs for select to anon, authenticated using (
  (status = 'published' and published_at <= now()) or public.can_manage_school(school_id)
);
create policy public_program_translation_read on public.public_program_translations for select to anon, authenticated using (
  exists (select 1 from public.public_programs p where p.id = program_id and ((p.status = 'published' and p.published_at <= now()) or public.can_manage_school(p.school_id)))
);
create policy public_schedule_read on public.public_schedules for select to anon, authenticated using (active or public.can_manage_school(school_id));
create policy public_schedule_translation_read on public.public_schedule_translations for select to anon, authenticated using (
  exists (select 1 from public.public_schedules s where s.id = schedule_id and (s.active or public.can_manage_school(s.school_id)))
);
create policy public_news_read on public.public_news for select to anon, authenticated using (
  (status = 'published' and published_at <= now()) or public.can_manage_school(school_id)
);
create policy public_news_translation_read on public.public_news_translations for select to anon, authenticated using (
  exists (select 1 from public.public_news n where n.id = news_id and ((n.status = 'published' and n.published_at <= now()) or public.can_manage_school(n.school_id)))
);
create policy public_replay_read on public.public_replays for select to anon, authenticated using (
  (status = 'published' and published_at <= now()) or public.can_manage_school(school_id)
);
create policy public_replay_translation_read on public.public_replay_translations for select to anon, authenticated using (
  exists (select 1 from public.public_replays r where r.id = replay_id and ((r.status = 'published' and r.published_at <= now()) or public.can_manage_school(r.school_id)))
);
create policy public_replay_category_read on public.public_replay_categories for select to anon, authenticated using (
  exists (select 1 from public.public_replays r where r.id = replay_id and ((r.status = 'published' and r.published_at <= now()) or public.can_manage_school(r.school_id)))
);

create or replace function public.toggle_public_replay_like(
  target_replay_id uuid,
  target_visitor_hash text,
  target_network_hash text
) returns table (liked boolean, likes_count bigint)
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare current_likes bigint;
begin
  if current_user not in ('service_role', 'postgres') then raise exception using errcode = '42501', message = 'service_role_required'; end if;
  if char_length(target_visitor_hash) <> 64 or char_length(target_network_hash) <> 64 then raise exception using errcode = '22023', message = 'invalid_fingerprint'; end if;
  if not exists (select 1 from public.public_replays where id = target_replay_id and status = 'published' and published_at <= now()) then raise exception using errcode = 'P0002', message = 'replay_not_found'; end if;

  if exists (select 1 from private.public_content_likes where kind = 'replay' and content_id = target_replay_id and visitor_hash = target_visitor_hash) then
    delete from private.public_content_likes where kind = 'replay' and content_id = target_replay_id and visitor_hash = target_visitor_hash;
    delete from private.public_like_rate_limits where kind = 'replay' and content_id = target_replay_id and network_hash = target_network_hash and bucket_date = current_date;
    update public.public_replays set likes_count = greatest(0, public_replays.likes_count - 1) where id = target_replay_id returning public_replays.likes_count into current_likes;
    return query select false, current_likes;
    return;
  end if;

  if exists (select 1 from private.public_like_rate_limits where kind = 'replay' and content_id = target_replay_id and network_hash = target_network_hash and bucket_date = current_date) then
    raise exception using errcode = 'P0001', message = 'like_rate_limited';
  end if;
  insert into private.public_content_likes(kind, content_id, visitor_hash) values ('replay', target_replay_id, target_visitor_hash);
  insert into private.public_like_rate_limits(kind, content_id, network_hash) values ('replay', target_replay_id, target_network_hash);
  update public.public_replays set likes_count = public_replays.likes_count + 1 where id = target_replay_id returning public_replays.likes_count into current_likes;
  return query select true, current_likes;
end;
$$;

create or replace function public.register_public_replay_view(
  target_replay_id uuid,
  target_visitor_hash text
) returns bigint
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare current_views bigint;
begin
  if current_user not in ('service_role', 'postgres') then raise exception using errcode = '42501', message = 'service_role_required'; end if;
  if char_length(target_visitor_hash) <> 64 then raise exception using errcode = '22023', message = 'invalid_fingerprint'; end if;
  insert into private.public_content_views(kind, content_id, visitor_hash) values ('replay', target_replay_id, target_visitor_hash) on conflict do nothing;
  if found then update public.public_replays set views_count = public_replays.views_count + 1 where id = target_replay_id and status = 'published'; end if;
  select views_count into current_views from public.public_replays where id = target_replay_id and status = 'published';
  if current_views is null then raise exception using errcode = 'P0002', message = 'replay_not_found'; end if;
  return current_views;
end;
$$;

revoke all on function public.toggle_public_replay_like(uuid, text, text) from public, anon, authenticated;
revoke all on function public.register_public_replay_view(uuid, text) from public, anon, authenticated;
grant execute on function public.toggle_public_replay_like(uuid, text, text) to service_role;
grant execute on function public.register_public_replay_view(uuid, text) to service_role;

comment on table public.public_schedules is 'Shared source of truth for public and authenticated application schedules.';
comment on table private.public_content_likes is 'Non-reversible visitor fingerprints; never exposed to clients.';
