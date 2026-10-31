"use client";

import { BookOpenText, CalendarDays, Clock3, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { publicCopy, type PublicLocale } from "./content";
import { ReplayActions } from "./replay-actions";
import type { PublicSiteData } from "./repository";

const days: Record<PublicLocale, string[]> = {
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  amz: ["ⴰⵙⴰⵎⴰⵙ", "ⴰⵢⵏⴰⵙ", "ⴰⵙⵉⵏⴰⵙ", "ⴰⴽⵕⴰⵙ", "ⴰⴽⵡⴰⵙ", "ⴰⵙⵉⵎⵡⴰⵙ", "ⴰⵙⵉⴹⵢⴰⵙ"],
};

export function DynamicPublicContent({ kind, locale, initial }: { kind: "schedule" | "news" | "replays"; locale: PublicLocale; initial: PublicSiteData }) {
  const [data, setData] = useState(initial);
  useEffect(() => { void fetch(`/api/public/content?locale=${locale}`).then(async (response) => { if (response.ok) setData(await response.json() as PublicSiteData); }); }, [locale]);
  const copy = publicCopy[locale];
  if (kind === "schedule") return data.schedules.length ? <section className="public-schedule-list">{data.schedules.map((item) => <article key={item.id}><CalendarDays aria-hidden="true" /><div><span>{days[locale][item.dayOfWeek]}</span><h2>{item.title}</h2><p>{item.audience}{item.location ? ` · ${item.location}` : ""}</p></div><strong><Clock3 aria-hidden="true" />{item.startsAt.slice(0, 5)} – {item.endsAt.slice(0, 5)}</strong></article>)}</section> : null;
  if (kind === "news") return data.news.length ? <section className="public-content-grid">{data.news.map((item) => <article key={item.id}>{item.imageUrl && <Image src={item.imageUrl} alt="" width={720} height={420} unoptimized />}<div>{item.eventDate && <time>{formatDate(item.eventDate, locale)}</time>}<h2>{item.title}</h2><p>{item.excerpt}</p></div></article>)}</section> : <Empty text={copy.news.empty} />;
  return data.replays.length ? <section className="public-content-grid public-content-grid--replays">{data.replays.map((item) => <article key={item.id} className={item.featured ? "is-featured" : undefined}>{item.thumbnailUrl ? <Image src={item.thumbnailUrl} alt="" width={720} height={405} unoptimized /> : <div className="replay-placeholder"><BookOpenText aria-hidden="true" /></div>}<div>{item.eventDate && <time>{formatDate(item.eventDate, locale)}</time>}<h2><a href={item.videoUrl} target="_blank" rel="noreferrer">{item.title}<ExternalLink aria-hidden="true" size={17} /></a></h2><p>{item.description}</p>{item.speaker && <strong>{item.speaker}</strong>}<ReplayActions replayId={item.id} initialLikes={item.likesCount} views={item.viewsCount} labels={copy.replays} /></div></article>)}</section> : <Empty text={copy.replays.empty} />;
}

function Empty({ text }: { text: string }) { return <div className="public-empty"><CalendarDays aria-hidden="true" /><p>{text}</p></div>; }
function formatDate(value: string, locale: PublicLocale) { return new Intl.DateTimeFormat(locale === "amz" ? "fr-MA" : locale, { dateStyle: "long" }).format(new Date(`${value}T12:00:00Z`)); }
