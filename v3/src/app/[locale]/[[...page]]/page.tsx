import { ArrowRight, BookOpenText, Check, ExternalLink, MapPin, Phone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/shell";
import { isPublicLocale, pageFromPath, publicCopy, publicHref, type PublicLocale, type PublicPage } from "@/features/public-site/content";
import { DynamicPublicContent } from "@/features/public-site/dynamic-content";
import { getPublicSiteData, type PublicSiteData } from "@/features/public-site/repository";

type RouteProps = { params: Promise<{ locale: string; page?: string[] }> };
export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: rawLocale, page: segments } = await params;
  if (!isPublicLocale(rawLocale)) return {};
  const page = pageFromPath(segments?.[0]);
  if (!page || (segments?.length ?? 0) > 1) return {};
  const copy = publicCopy[rawLocale];
  return { title: page === "home" ? copy.brand : `${copy.nav[page]} · ${copy.brand}`, description: copy.hero.copy };
}

export default async function LocalizedPublicPage({ params }: RouteProps) {
  const { locale: rawLocale, page: segments } = await params;
  if (!isPublicLocale(rawLocale) || (segments?.length ?? 0) > 1) notFound();
  const page = pageFromPath(segments?.[0]);
  if (!page) notFound();
  const data = await getPublicSiteData(rawLocale);
  return <PublicShell locale={rawLocale}><PublicPage locale={rawLocale} page={page} data={data} /></PublicShell>;
}

function PageIntro({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return <header className="public-page__intro"><span>{eyebrow}</span><h1>{title}</h1>{intro && <p>{intro}</p>}</header>;
}

function PublicPage({ locale, page, data }: { locale: PublicLocale; page: PublicPage; data: PublicSiteData }) {
  const copy = publicCopy[locale];
  if (page === "home") return <>
    <section className="public-home-hero">
      <Image className="public-home-hero__image" src="/dar-al-hadith/facade.webp" alt="" fill sizes="100vw" priority />
      <div className="public-home-hero__shade" />
      <div className="public-home-hero__content"><span>{copy.hero.kicker}</span><h1>{copy.hero.title}</h1><p>{data.profile?.tagline ?? copy.hero.copy}</p><div><Link className="public-cta" href={publicHref(locale, "registration")}>{copy.hero.primary}<ArrowRight aria-hidden="true" size={19} /></Link><Link className="public-cta public-cta--quiet" href={publicHref(locale, "programs")}>{copy.hero.secondary}</Link></div></div>
    </section>
    <section className="public-trust"><Sparkles aria-hidden="true" /><strong>{copy.hero.trust}</strong></section>
    <section className="public-feature-band"><div><span>{copy.about.eyebrow}</span><h2>{copy.about.title}</h2><p>{data.profile?.description ?? copy.about.paragraphs[0]}</p><Link href={publicHref(locale, "about")}>{copy.nav.about}<ArrowRight aria-hidden="true" size={18} /></Link></div><Image src="/dar-al-hadith/classroom.jpg" alt={copy.about.caption} width={720} height={480} /></section>
    <section className="public-home-grid">{copy.programs.items.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}</section>
  </>;
  if (page === "about") return <div className="public-page"><PageIntro eyebrow={copy.about.eyebrow} title={copy.about.title} /><section className="public-story"><div>{copy.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><figure><Image src="/dar-al-hadith/classroom.jpg" alt={copy.about.caption} width={760} height={520} /><figcaption>{copy.about.caption}</figcaption></figure></section></div>;
  if (page === "programs") return <div className="public-page"><PageIntro eyebrow={copy.programs.eyebrow} title={copy.programs.title} intro={copy.programs.intro} /><section className="public-program-list">{copy.programs.items.map((item, index) => <article key={item.title}><span>0{index + 1}</span><div><h2>{item.title}</h2><p>{item.copy}</p></div><BookOpenText aria-hidden="true" /></article>)}</section></div>;
  if (page === "schedule") return <div className="public-page"><PageIntro eyebrow={copy.schedule.eyebrow} title={copy.schedule.title} intro={copy.schedule.intro} /><DynamicPublicContent kind="schedule" locale={locale} initial={data} /></div>;
  if (page === "courses") return <div className="public-page"><PageIntro eyebrow={copy.courses.eyebrow} title={copy.courses.title} intro={copy.courses.intro} /><section className="public-check-list">{copy.courses.items.map((item) => <article key={item}><Check aria-hidden="true" /><strong>{item}</strong></article>)}</section></div>;
  if (page === "registration") return <div className="public-page"><PageIntro eyebrow={copy.registration.eyebrow} title={copy.registration.title} intro={data.profile?.registrationNote ?? copy.registration.copy} /><section className="public-registration"><div><h2>{copy.registration.documents}</h2>{copy.registration.items.map((item) => <p key={item}><Check aria-hidden="true" />{item}</p>)}</div><aside><span>{copy.registration.fee}</span><strong>{data.profile?.monthlyFee ? `${data.profile.monthlyFee} DH` : "100 DH"}</strong>{data.profile?.phone && <a href={`tel:${data.profile.phone}`}><Phone aria-hidden="true" />{data.profile.phone}</a>}</aside></section></div>;
  if (page === "news") return <div className="public-page"><PageIntro eyebrow={copy.news.eyebrow} title={copy.news.title} intro={copy.news.intro} /><DynamicPublicContent kind="news" locale={locale} initial={data} /></div>;
  if (page === "replays") return <div className="public-page"><PageIntro eyebrow={copy.replays.eyebrow} title={copy.replays.title} intro={copy.replays.intro} /><DynamicPublicContent kind="replays" locale={locale} initial={data} /></div>;
  if (page === "faq") return <div className="public-page"><PageIntro eyebrow={copy.faq.eyebrow} title={copy.faq.title} /><section className="public-faq">{copy.faq.items.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</section></div>;
  const mapsUrl = "https://maps.app.goo.gl/EfrBwvpKfKZmuCSd9";
  const mapEmbed = "https://www.google.com/maps?q=33.802143,-6.8072948&z=17&output=embed";
  return <div className="public-page"><PageIntro eyebrow={copy.contact.eyebrow} title={copy.contact.title} intro={copy.contact.copy} /><section className="public-contact"><div className="public-contact__details"><a href="tel:+212639598936"><Phone aria-hidden="true" /><span><small>{copy.contact.phone}</small><strong dir="ltr">0639-598936</strong></span></a><p><MapPin aria-hidden="true" /><span><small>{copy.contact.address}</small><strong>دار القرآن والحديث - جمعية مواهب المنان</strong></span></p><a className="public-cta" href={mapsUrl} target="_blank" rel="noreferrer">{copy.contact.map}<ExternalLink aria-hidden="true" size={18} /></a></div><div className="public-contact__map"><iframe title="دار القرآن والحديث - جمعية مواهب المنان" src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section></div>;
}
