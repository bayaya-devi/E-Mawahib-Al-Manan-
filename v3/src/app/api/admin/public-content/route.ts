import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteManager } from "@/features/public-site/admin-access";
import { hasTrustedOrigin } from "@/lib/http/same-origin";

const status = z.enum(["draft", "published", "archived"]);
const translations = z.array(z.object({ locale: z.enum(["ar", "fr", "en", "amz"]), title: z.string().min(2).max(180), summary: z.string().min(2).max(10000) })).length(4);
const mutation = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("site"), phone: z.string().max(40).optional(), email: z.string().email().or(z.literal("")).optional(), mapUrl: z.string().url().or(z.literal("")).optional(), minimumAge: z.number().int().min(3).max(99), monthlyFee: z.number().min(0), registrationOpen: z.boolean(), translations }),
  z.object({ resource: z.literal("news"), id: z.string().uuid().optional(), status, imageUrl: z.string().url().or(z.literal("")).optional(), eventDate: z.string().date().or(z.literal("")).optional(), translations: translations.refine((rows)=>rows.every((row)=>row.summary.trim().split(/\s+/u).filter(Boolean).length<=1500),"news_too_long") }),
  z.object({ resource: z.literal("replay"), id: z.string().uuid().optional(), status, videoUrl: z.string().url(), thumbnailUrl: z.string().url().or(z.literal("")).optional(), speaker: z.string().max(160).optional(), eventDate: z.string().date().or(z.literal("")).optional(), featured: z.boolean().default(false), translations }),
  z.object({ resource: z.literal("schedule"), id: z.string().uuid().optional(), active: z.boolean().default(true), audience: z.string().min(1).max(80), dayOfWeek: z.number().int().min(0).max(6), startsAt: z.string().regex(/^\d{2}:\d{2}$/), endsAt: z.string().regex(/^\d{2}:\d{2}$/), location: z.string().max(160).optional(), translations }),
]);

export async function GET() {
  const access = await getSiteManager();
  if (!access) return NextResponse.json({ ok: false }, { status: 403 });
  const [profiles, profileT, news, newsT, replays, replayT, schedules, scheduleT] = await Promise.all([
    access.admin.from("public_site_profiles").select("*").eq("school_id", access.schoolId).limit(1),
    access.admin.from("public_site_profile_translations").select("*"),
    access.admin.from("public_news").select("*").eq("school_id", access.schoolId).order("updated_at", { ascending: false }),
    access.admin.from("public_news_translations").select("*"),
    access.admin.from("public_replays").select("*").eq("school_id", access.schoolId).order("updated_at", { ascending: false }),
    access.admin.from("public_replay_translations").select("*"),
    access.admin.from("public_schedules").select("*").eq("school_id", access.schoolId).order("day_of_week"),
    access.admin.from("public_schedule_translations").select("*"),
  ]);
  return NextResponse.json({ ok: true, profiles: profiles.data ?? [], profileTranslations: profileT.data ?? [], news: news.data ?? [], newsTranslations: newsT.data ?? [], replays: replays.data ?? [], replayTranslations: replayT.data ?? [], schedules: schedules.data ?? [], scheduleTranslations: scheduleT.data ?? [] });
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const access = await getSiteManager();
  if (!access) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  if (input.resource === "site") {
    const profile = await access.admin.from("public_site_profiles").upsert({ school_id: access.schoolId, phone: input.phone || null, email: input.email || null, map_url: input.mapUrl || null, minimum_age: input.minimumAge, monthly_fee: input.monthlyFee, registration_open: input.registrationOpen, updated_by: access.actorId, updated_at: new Date().toISOString() }, { onConflict: "school_id" }).select("id").single();
    if (profile.error || !profile.data) return NextResponse.json({ ok: false }, { status: 400 });
    const rows = input.translations.map((item) => ({ profile_id: profile.data.id, locale: item.locale, name: item.title, tagline: item.summary, description: item.summary, address: null, registration_note: null }));
    const saved = await access.admin.from("public_site_profile_translations").upsert(rows, { onConflict: "profile_id,locale" });
    return NextResponse.json({ ok: !saved.error, id: profile.data.id }, { status: saved.error ? 400 : 200 });
  }
  if (input.resource === "news") {
    const values = { school_id: access.schoolId, status: input.status, image_url: input.imageUrl || null, event_date: input.eventDate || null, published_at: input.status === "published" ? new Date().toISOString() : null, created_by: access.actorId, updated_by: access.actorId, updated_at: new Date().toISOString() };
    const result = input.id ? await access.admin.from("public_news").update(values).eq("id", input.id).eq("school_id", access.schoolId).select("id").single() : await access.admin.from("public_news").insert(values).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ ok: false }, { status: 400 });
    const rows = input.translations.map((item) => ({ news_id: result.data.id, locale: item.locale, slug: `news-${result.data.id.slice(0, 8)}-${item.locale}`, title: item.title, excerpt: item.summary.slice(0, 320), body: item.summary }));
    const saved = await access.admin.from("public_news_translations").upsert(rows, { onConflict: "news_id,locale" });
    if (saved.error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.data.id });
  }
  if (input.resource === "replay") {
    const values = { school_id: access.schoolId, status: input.status, video_url: input.videoUrl, thumbnail_url: input.thumbnailUrl || null, speaker: input.speaker || null, event_date: input.eventDate || null, featured: input.featured, published_at: input.status === "published" ? new Date().toISOString() : null, created_by: access.actorId, updated_by: access.actorId, updated_at: new Date().toISOString() };
    const result = input.id ? await access.admin.from("public_replays").update(values).eq("id", input.id).eq("school_id", access.schoolId).select("id").single() : await access.admin.from("public_replays").insert(values).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ ok: false }, { status: 400 });
    const rows = input.translations.map((item) => ({ replay_id: result.data.id, locale: item.locale, slug: `replay-${result.data.id.slice(0, 8)}-${item.locale}`, title: item.title, description: item.summary }));
    const saved = await access.admin.from("public_replay_translations").upsert(rows, { onConflict: "replay_id,locale" });
    if (saved.error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.data.id });
  }
  const values = { school_id: access.schoolId, audience: input.audience, day_of_week: input.dayOfWeek, starts_at: input.startsAt, ends_at: input.endsAt, location: input.location || null, active: input.active, updated_by: access.actorId, updated_at: new Date().toISOString() };
  const result = input.id ? await access.admin.from("public_schedules").update(values).eq("id", input.id).eq("school_id", access.schoolId).select("id").single() : await access.admin.from("public_schedules").insert(values).select("id").single();
  if (result.error || !result.data) return NextResponse.json({ ok: false }, { status: 400 });
  const rows = input.translations.map((item) => ({ schedule_id: result.data.id, locale: item.locale, title: item.title, notes: item.summary }));
  const saved = await access.admin.from("public_schedule_translations").upsert(rows, { onConflict: "schedule_id,locale" });
  return NextResponse.json({ ok: !saved.error, id: result.data.id }, { status: saved.error ? 400 : 200 });
}

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const access = await getSiteManager();
  if (!access) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = z.object({ resource: z.enum(["news", "replay", "schedule"]), id: z.string().uuid(), state: z.union([status, z.boolean()]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { resource, id, state } = parsed.data;
  if (resource === "schedule") {
    if (typeof state !== "boolean") return NextResponse.json({ ok: false }, { status: 400 });
    const { error } = await access.admin.from("public_schedules").update({ active: state, updated_by: access.actorId, updated_at: new Date().toISOString() }).eq("id", id).eq("school_id", access.schoolId);
    return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
  }
  if (typeof state !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const table = resource === "news" ? "public_news" : "public_replays";
  const { error } = await access.admin.from(table).update({ status: state, published_at: state === "published" ? new Date().toISOString() : null, updated_by: access.actorId, updated_at: new Date().toISOString() }).eq("id", id).eq("school_id", access.schoolId);
  return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
}
