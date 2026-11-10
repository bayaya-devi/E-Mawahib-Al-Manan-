"use client";

import { useEffect } from "react";

import type { PublicLocale } from "@/features/public-site/content";

const skipLabels: Record<PublicLocale, string> = {
  ar: "انتقل إلى المحتوى",
  fr: "Aller au contenu",
  en: "Skip to content",
  amz: "ⴷⴷⵓ ⵖⵔ ⵓⴳⴱⵓⵔ",
};

export function PublicDocumentLanguage({ locale }: { locale: PublicLocale }) {
  useEffect(() => {
    const root = document.documentElement;
    const skipLink = document.querySelector<HTMLElement>(".skip-link");
    const previous = { lang: root.lang, dir: root.dir, skip: skipLink?.textContent ?? "" };

    root.lang = locale === "amz" ? "zgh-Tfng" : locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
    if (skipLink) skipLink.textContent = skipLabels[locale];

    return () => {
      root.lang = previous.lang;
      root.dir = previous.dir;
      if (skipLink) skipLink.textContent = previous.skip;
    };
  }, [locale]);

  return null;
}
