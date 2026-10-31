import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability/logger";
import type { PublicLocale } from "./content";

export type PublicSiteData = {
  profile: null | { phone: string | null; email: string | null; mapUrl: string | null; minimumAge: number | null; monthlyFee: number | null; registrationOpen: boolean; name: string; tagline: string; description: string; address: string | null; registrationNote: string | null };
  schedules: Array<{ id: string; audience: string; dayOfWeek: number; startsAt: string; endsAt: string; location: string | null; title: string; notes: string | null }>;
  news: Array<{ id: string; title: string; excerpt: string; body: string; imageUrl: string | null; eventDate: string | null; publishedAt: string | null }>;
  replays: Array<{ id: string; title: string; description: string; videoUrl: string; thumbnailUrl: string | null; speaker: string | null; eventDate: string | null; featured: boolean; viewsCount: number; likesCount: number }>;
};

export async function getPublicSiteData(locale: PublicLocale): Promise<PublicSiteData> {
  const empty: PublicSiteData = { profile: null, schedules: [], news: [], replays: [] };
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return empty;
  try {
    const client = await createClient();
    const [profiles, schedules, news, replays] = await Promise.all([
      client.from("public_site_profiles").select("id,phone,email,map_url,minimum_age,monthly_fee,registration_open").limit(1).maybeSingle(),
      client.from("public_schedules").select("id,audience,day_of_week,starts_at,ends_at,location").eq("active", true).order("day_of_week").order("starts_at"),
      client.from("public_news").select("id,image_url,event_date,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(24),
      client.from("public_replays").select("id,video_url,thumbnail_url,speaker,event_date,featured,views_count,likes_count").eq("status", "published").order("featured", { ascending: false }).order("published_at", { ascending: false }).limit(24),
    ]);
    const profileRow = profiles.data;
    const scheduleRows = schedules.data ?? [];
    const newsRows = news.data ?? [];
    const replayRows = replays.data ?? [];
    const [profileTranslation, scheduleTranslations, newsTranslations, replayTranslations] = await Promise.all([
      profileRow ? client.from("public_site_profile_translations").select("name,tagline,description,address,registration_note").eq("profile_id", profileRow.id).eq("locale", locale).maybeSingle() : Promise.resolve({ data: null }),
      scheduleRows.length ? client.from("public_schedule_translations").select("schedule_id,title,notes").eq("locale", locale).in("schedule_id", scheduleRows.map((row) => row.id)) : Promise.resolve({ data: [] }),
      newsRows.length ? client.from("public_news_translations").select("news_id,title,excerpt,body").eq("locale", locale).in("news_id", newsRows.map((row) => row.id)) : Promise.resolve({ data: [] }),
      replayRows.length ? client.from("public_replay_translations").select("replay_id,title,description").eq("locale", locale).in("replay_id", replayRows.map((row) => row.id)) : Promise.resolve({ data: [] }),
    ]);
    const st = new Map((scheduleTranslations.data ?? []).map((row) => [row.schedule_id, row]));
    const nt = new Map((newsTranslations.data ?? []).map((row) => [row.news_id, row]));
    const rt = new Map((replayTranslations.data ?? []).map((row) => [row.replay_id, row]));
    return {
      profile: profileRow && profileTranslation.data ? { phone: profileRow.phone, email: profileRow.email, mapUrl: profileRow.map_url, minimumAge: profileRow.minimum_age, monthlyFee: Number(profileRow.monthly_fee), registrationOpen: profileRow.registration_open, name: profileTranslation.data.name, tagline: profileTranslation.data.tagline, description: profileTranslation.data.description, address: profileTranslation.data.address, registrationNote: profileTranslation.data.registration_note } : null,
      schedules: scheduleRows.flatMap((row) => { const translation = st.get(row.id); return translation ? [{ id: row.id, audience: row.audience, dayOfWeek: row.day_of_week, startsAt: row.starts_at, endsAt: row.ends_at, location: row.location, title: translation.title, notes: translation.notes }] : []; }),
      news: newsRows.flatMap((row) => { const translation = nt.get(row.id); return translation ? [{ id: row.id, title: translation.title, excerpt: translation.excerpt, body: translation.body, imageUrl: row.image_url, eventDate: row.event_date, publishedAt: row.published_at }] : []; }),
      replays: replayRows.flatMap((row) => { const translation = rt.get(row.id); return translation ? [{ id: row.id, title: translation.title, description: translation.description, videoUrl: row.video_url, thumbnailUrl: row.thumbnail_url, speaker: row.speaker, eventDate: row.event_date, featured: row.featured, viewsCount: Number(row.views_count), likesCount: Number(row.likes_count) }] : []; }),
    };
  } catch (error) { logServerError("PUBLIC_SITE_LOAD_FAILED", error, { locale }); return empty; }
}
