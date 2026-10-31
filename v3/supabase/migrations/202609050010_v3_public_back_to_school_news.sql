do $$
declare
  target_school_id uuid;
  actor_id uuid;
  entry_id constant uuid := '70000000-0000-4000-8000-000000000001';
begin
  select s.id, sm.user_id
    into target_school_id, actor_id
  from public.schools s
  join public.school_memberships sm on sm.school_id = s.id
  join public.profiles p on p.id = sm.user_id
  where p.status = 'active'
  order by sm.joined_at
  limit 1;

  if target_school_id is null or actor_id is null then
    return;
  end if;

  insert into public.public_news
    (id, school_id, status, event_date, published_at, created_by, updated_by)
  values
    (entry_id, target_school_id, 'published', date '2026-09-07', timestamptz '2026-09-05 09:00:00+00', actor_id, actor_id)
  on conflict (id) do nothing;

  insert into public.public_news_translations (news_id, locale, slug, title, excerpt, body)
  values
    (entry_id, 'fr', 'rentree-des-cours-2026-2027', 'Rentrée des cours 2026-2027', 'La rentrée des cours à Dar Al-Qur’an wal-Hadith aura lieu le lundi 7 septembre 2026.', 'La rentrée des cours à Dar Al-Qur’an wal-Hadith aura lieu le lundi 7 septembre 2026. Nous sommes heureux de retrouver nos élèves pour le début de cette nouvelle année d’apprentissage.'),
    (entry_id, 'ar', 'start-of-classes-2026-2027-ar', 'انطلاق الدراسة للموسم 2026-2027', 'ستنطلق الدراسة بدار القرآن والحديث يوم الاثنين 7 شتنبر 2026.', 'ستنطلق الدراسة بدار القرآن والحديث يوم الاثنين 7 شتنبر 2026. يسعدنا استقبال تلاميذنا من جديد مع بداية هذه السنة الدراسية الجديدة.'),
    (entry_id, 'en', 'start-of-classes-2026-2027', 'Start of Classes 2026–2027', 'Classes at Dar Al-Qur’an wal-Hadith will resume on Monday, September 7, 2026.', 'Classes at Dar Al-Qur’an wal-Hadith will resume on Monday, September 7, 2026. We are pleased to welcome our students back for the beginning of a new year of learning.'),
    (entry_id, 'amz', 'start-of-classes-2026-2027-amz', 'ⴰⵙⵏⵜⵉ ⵏ ⵜⵉⵖⵔⵉⵡⵉⵏ 2026-2027', 'ⴰⴷ ⴱⴷⵓⵏⵜ ⵜⵉⵖⵔⵉⵡⵉⵏ ⴳ ⴷⴰⵔ ⵍⵇⵔⴰⵏ ⴷ ⵍⵃⴷⵉⵜ ⴰⵙⵙ ⵏ ⴰⵢⵏⴰⵙ 7 ⵛⵜⴰⵎⴱⵉⵔ 2026.', 'ⴰⴷ ⴱⴷⵓⵏⵜ ⵜⵉⵖⵔⵉⵡⵉⵏ ⴳ ⴷⴰⵔ ⵍⵇⵔⴰⵏ ⴷ ⵍⵃⴷⵉⵜ ⴰⵙⵙ ⵏ ⴰⵢⵏⴰⵙ 7 ⵛⵜⴰⵎⴱⵉⵔ 2026. ⴰⴷ ⵏⵙⵙⵓⴼⵖ ⵙ ⵜⵎⵏⵉⴷⴰ ⵉⵏⵍⵎⴰⴷⵏ ⵏⵏⵖ ⵉ ⵓⵙⵏⵜⵉ ⵏ ⵓⵙⴳⴳⴰⵙ ⴰⵎⴰⵢⵏⵓ ⵏ ⵜⵖⵔⵉ.')
  on conflict (news_id, locale) do nothing;
end;
$$;
