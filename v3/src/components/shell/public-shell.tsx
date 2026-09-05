"use client";

import { ChevronDown, LogIn, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { locales, pageFromPath, publicCopy, publicHref, publicPages, type PublicLocale } from "@/features/public-site/content";
import { PublicMotion } from "@/features/public-site/public-motion";

const localeLabels: Record<PublicLocale, string> = { ar: "العربية", fr: "Français", en: "English", amz: "ⵜⴰⵛⵍⵃⵉⵜ" };

export function PublicShell({ locale, children }: { locale: PublicLocale; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const copy = publicCopy[locale];
  const page = pageFromPath(pathname.split("/").filter(Boolean)[1]) ?? "home";
  useEffect(() => {
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLanguageOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return <div className="public-v3" lang={locale === "amz" ? "zgh-Tfng" : locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="public-v3__header">
      <Link className="public-v3__brand" href={publicHref(locale, "home")} aria-label={copy.brand}>
        <Image src="/dar-al-hadith/logo.webp" alt="" width={53} height={52} priority />
        <span><strong>{copy.brand}</strong><small>{copy.association}</small></span>
      </Link>
      <nav className="public-v3__desktop-nav" aria-label={copy.menu}>{publicPages.map((item) => <Link key={item} className={item === page ? "is-active" : undefined} href={publicHref(locale, item)}>{copy.nav[item]}</Link>)}</nav>
      <div className="public-v3__actions">
        <div className="public-v3__language" ref={languageRef}>
          <button type="button" aria-haspopup="menu" aria-expanded={languageOpen} aria-controls="public-language-menu" onClick={() => setLanguageOpen((value) => !value)}>{localeLabels[locale]}<ChevronDown aria-hidden="true" size={16} /></button>
          {languageOpen && <div id="public-language-menu" aria-label={copy.language}>{locales.filter((item) => item !== locale).map((item) => <Link key={item} href={publicHref(item, page)} hrefLang={item === "amz" ? "zgh" : item} onClick={() => { setLanguageOpen(false); setOpen(false); }}>{localeLabels[item]}</Link>)}</div>}
        </div>
        <Link className="public-v3__login" href="/login"><LogIn aria-hidden="true" size={17} />{copy.login}</Link>
        <button className="public-v3__menu" type="button" aria-label={copy.menu} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      </div>
      {open && <nav className="public-v3__mobile-nav" aria-label={copy.menu}>{publicPages.map((item) => <Link key={item} className={item === page ? "is-active" : undefined} href={publicHref(locale, item)} onClick={() => { setOpen(false); setLanguageOpen(false); }}>{copy.nav[item]}</Link>)}<Link className="public-v3__login public-v3__login--mobile" href="/login" onClick={() => { setOpen(false); setLanguageOpen(false); }}>{copy.login}</Link></nav>}
    </header>
    <main id="main-content">{children}</main>
    <footer className="public-v3__footer"><Image src="/dar-al-hadith/logo.webp" alt="" width={55} height={54} /><strong>{copy.footer}</strong><nav aria-label={copy.menu}>{publicPages.slice(1, 6).map((item) => <Link key={item} href={publicHref(locale, item)}>{copy.nav[item]}</Link>)}</nav></footer>
    <PublicMotion />
  </div>;
}
