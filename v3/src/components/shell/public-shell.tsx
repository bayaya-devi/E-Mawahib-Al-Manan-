import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { publicCopy, publicHref, publicPages, type PublicLocale, type PublicPage } from "@/features/public-site/content";
import { ConsentBanner } from "@/features/privacy/consent-banner";
import { PublicMotion } from "@/features/public-site/public-motion";
import { PublicDocumentLanguage } from "./public-document-language";
import { PrivacyPreferencesButton, PublicHeaderControls } from "./public-shell-controls";

export async function PublicShell({ locale, page, children }: { locale: PublicLocale; page?: PublicPage; children: ReactNode }) {
  const copy = publicCopy[locale];
  const consentStored = (await cookies()).has("mawahib_consent");
  const navItems = publicPages.map((item) => ({ id: item, label: copy.nav[item], href: publicHref(locale, item) }));
  const languageItems = (["ar", "fr", "en", "amz"] as const).filter((item) => item !== locale).map((item) => ({ locale: item, href: page ? publicHref(item, page) : `/${item}` }));
  return <div className="public-v3" lang={locale === "amz" ? "zgh-Tfng" : locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <PublicDocumentLanguage locale={locale} />
    <header className="public-v3__header">
      <Link className="public-v3__brand" href={publicHref(locale, "home")} aria-label={copy.brand}><Image src="/dar-al-hadith/logo.webp" alt="" width={53} height={52} priority /><span><strong>{copy.brand}</strong><small>{copy.association}</small></span></Link>
      <nav className="public-v3__desktop-nav" aria-label={copy.menu}>{navItems.map((item) => <Link key={item.id} className={item.id === page ? "is-active" : undefined} href={item.href}>{item.label}</Link>)}</nav>
      <PublicHeaderControls locale={locale} currentPage={page} labels={{ login: copy.login, menu: copy.menu, language: copy.language }} navItems={navItems} languageItems={languageItems} />
    </header>
    <main id="main-content">{children}</main>
    <footer className="public-v3__footer"><Image src="/dar-al-hadith/logo.webp" alt="" width={55} height={54} /><strong>{copy.footer}</strong><nav aria-label={copy.menu}>{navItems.slice(1, 6).map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}<Link href={`/${locale}/legal/privacy`}>{locale === "ar" ? "الخصوصية" : locale === "en" ? "Privacy" : "Confidentialité"}</Link><Link href={`/${locale}/legal/cookies`}>{locale === "ar" ? "ملفات الارتباط" : "Cookies"}</Link><Link href={`/${locale}/legal/terms`}>{locale === "ar" ? "شروط الاستخدام" : locale === "en" ? "Terms" : "Conditions"}</Link><Link href={`/${locale}/legal/legal`}>{locale === "ar" ? "الإشعار القانوني" : locale === "en" ? "Legal" : "Mentions légales"}</Link><PrivacyPreferencesButton locale={locale} /></nav></footer>
    <ConsentBanner locale={locale} initialOpen={!consentStored} />
    <PublicMotion />
  </div>;
}
