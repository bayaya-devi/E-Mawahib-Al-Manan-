begin;

alter table public.admin_school_settings
  add column if not exists show_student_class_ranking_names boolean not null default true;

create or replace function public.admin_set_student_class_ranking_names(
  target_school_id uuid,
  target_names_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_administration_aal2();
  if not public.can_manage_school(target_school_id) then
    raise exception 'school_scope_denied';
  end if;

  insert into public.admin_school_settings(
    school_id,
    show_student_class_ranking_names,
    updated_by
  )
  values(target_school_id, target_names_visible, auth.uid())
  on conflict(school_id) do update set
    show_student_class_ranking_names = excluded.show_student_class_ranking_names,
    updated_by = auth.uid(),
    updated_at = now();
end;
$$;

create or replace function public.get_student_class_leaderboard(target_student uuid)
returns table(
  class_id uuid,
  class_name text,
  names_visible boolean,
  student_id uuid,
  display_name text,
  total_stars integer,
  class_rank integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  active_class_id uuid;
  active_class_name text;
  visible_names boolean := true;
begin
  if actor is null or not public.can_switch_student_profile(target_student) then
    raise exception 'leaderboard_scope_denied';
  end if;

  select c.id, c.name
  into active_class_id, active_class_name
  from public.class_enrollments ce
  join public.classes c on c.id = ce.class_id and c.status = 'active'
  where ce.student_id = target_student and ce.status = 'active'
  order by ce.enrolled_at desc
  limit 1;

  if active_class_id is null then
    return;
  end if;

  select coalesce(settings.show_student_class_ranking_names, true)
  into visible_names
  from public.classes c
  left join public.admin_school_settings settings on settings.school_id = c.school_id
  where c.id = active_class_id;

  return query
  with active_students as (
    select ce.student_id, p.display_name,
      coalesce(sum(progress.stars), 0)::integer as stars
    from public.class_enrollments ce
    join public.profiles p on p.id = ce.student_id and p.status = 'active'
    left join public.student_surah_progress progress on progress.student_id = ce.student_id
    where ce.class_id = active_class_id and ce.status = 'active'
    group by ce.student_id, p.display_name
  ), ranked_students as (
    select *, rank() over(order by stars desc)::integer as rank_value
    from active_students
  )
  select
    active_class_id,
    active_class_name,
    visible_names,
    ranked.student_id,
    case when visible_names then ranked.display_name else null end,
    ranked.stars,
    ranked.rank_value
  from ranked_students ranked
  order by ranked.stars desc, lower(ranked.display_name), ranked.student_id;
end;
$$;

revoke all on function public.admin_set_student_class_ranking_names(uuid,boolean) from public, anon;
revoke all on function public.get_student_class_leaderboard(uuid) from public, anon;
grant execute on function public.admin_set_student_class_ranking_names(uuid,boolean) to authenticated;
grant execute on function public.get_student_class_leaderboard(uuid) to authenticated;

commit;
