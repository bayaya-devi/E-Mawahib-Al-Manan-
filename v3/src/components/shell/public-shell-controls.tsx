"use client";

import { ChevronDown, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicLocale, PublicPage } from "@/features/public-site/content";

const localeLabels: Record<PublicLocale, string> = { ar: "العربية", fr: "Français", en: "English", amz: "ⵜⴰⵛⵍⵃⵉⵜ" };
type NavItem = { id: PublicPage; label: string; href: string };

export function PublicHeaderControls({ locale, currentPage, labels, navItems, languageItems }: { locale: PublicLocale; currentPage: PublicPage | undefined; labels: { login: string; menu: string; language: string }; navItems: NavItem[]; languageItems: Array<{ locale: PublicLocale; href: string }> }) {
  const [open, setOpen] = useState(false); const [languageOpen, setLanguageOpen] = useState(false); const languageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const outside = (event: MouseEvent) => { if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setLanguageOpen(false); } }; document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); }; }, []);
  const chooseLanguage = useCallback((nextLocale: PublicLocale) => { document.cookie = `public_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`; setOpen(false); setLanguageOpen(false); }, []);
  return <><div className="public-v3__actions"><div className="public-v3__language" ref={languageRef}><button type="button" aria-haspopup="menu" aria-expanded={languageOpen} aria-controls="public-language-menu" onClick={() => setLanguageOpen((value) => !value)}>{localeLabels[locale]}<ChevronDown aria-hidden="true" size={16} /></button>{languageOpen && <div id="public-language-menu" aria-label={labels.language}>{languageItems.map((item) => <Link key={item.locale} href={item.href} hrefLang={item.locale === "amz" ? "zgh" : item.locale} onClick={() => chooseLanguage(item.locale)}>{localeLabels[item.locale]}</Link>)}</div>}</div><Link className="public-v3__login" href="/login" prefetch={false} aria-label={labels.login} title={labels.login}><LogIn aria-hidden="true" size={17} /><span>{labels.login}</span></Link><button className="public-v3__menu" type="button" aria-label={labels.menu} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div>{open && <nav className="public-v3__mobile-nav" aria-label={labels.menu}>{navItems.map((item) => <Link key={item.id} className={item.id === currentPage ? "is-active" : undefined} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}<Link className="public-v3__login public-v3__login--mobile" href="/login" prefetch={false} onClick={() => setOpen(false)}><LogIn aria-hidden="true" size={17} /><span>{labels.login}</span></Link></nav>}</>;
}

export function PrivacyPreferencesButton({ locale }: { locale: PublicLocale }) { return <button type="button" className="public-footer-privacy" onClick={() => window.dispatchEvent(new Event("mawahib:privacy-open"))}>{locale === "ar" ? "اختيارات الخصوصية" : locale === "en" ? "Privacy choices" : "Choix de confidentialité"}</button>; }
