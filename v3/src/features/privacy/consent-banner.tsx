"use client";

import { useEffect, useState } from "react";

import type { PublicLocale } from "@/features/public-site/content";

const cookieName = "mawahib_consent";
const policyVersion = "2026-10-14";
type Choices = { necessary: true; audience: boolean; marketing: boolean; version: string };
const copy = {
  ar: { title: "اختيارات الخصوصية", text: "نستعمل ملفات ضرورية لتشغيل الموقع. لن تُحمّل خدمات القياس أو التسويق دون اختيارك.", refuse: "رفض غير الضروري", accept: "قبول الكل", save: "حفظ الاختيارات", audience: "قياس الجمهور", marketing: "التسويق" },
  fr: { title: "Choix de confidentialité", text: "Nous utilisons les éléments nécessaires au fonctionnement. La mesure d’audience et le marketing restent bloqués sans votre choix.", refuse: "Tout refuser", accept: "Tout accepter", save: "Enregistrer", audience: "Mesure d’audience", marketing: "Marketing" },
  en: { title: "Privacy choices", text: "Necessary storage keeps the site working. Audience measurement and marketing stay blocked unless you choose them.", refuse: "Reject optional", accept: "Accept all", save: "Save choices", audience: "Audience measurement", marketing: "Marketing" },
} as const;

export function ConsentBanner({ locale }: { locale: PublicLocale }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const text = copy[locale === "amz" ? "fr" : locale];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = readConsent();
      if (!current || current.version !== policyVersion) setOpen(true);
      else { setAudience(current.audience); setMarketing(current.marketing); }
    }, 0);
    const show = () => setOpen(true);
    window.addEventListener("mawahib:privacy-open", show);
    return () => { window.clearTimeout(timer); window.removeEventListener("mawahib:privacy-open", show); };
  }, []);

  async function persist(nextAudience: boolean, nextMarketing: boolean) {
    const choices: Choices = { necessary: true, audience: nextAudience, marketing: nextMarketing, version: policyVersion };
    document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(choices))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setAudience(nextAudience); setMarketing(nextMarketing); setOpen(false);
    window.dispatchEvent(new CustomEvent("mawahib:consent-changed", { detail: choices }));
    await fetch("/api/privacy/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audience: nextAudience, marketing: nextMarketing, locale, policyVersion }) }).catch(() => undefined);
  }
  if (!open) return null;
  return <section className="privacy-consent" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <div><h2 id="privacy-title">{text.title}</h2><p>{text.text}</p><fieldset><legend className="sr-only">{text.title}</legend><label><input type="checkbox" checked disabled />{locale === "ar" ? "ضروري" : locale === "en" ? "Necessary" : "Nécessaire"}</label><label><input type="checkbox" checked={audience} onChange={(event) => setAudience(event.target.checked)} />{text.audience}</label><label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />{text.marketing}</label></fieldset><nav><button type="button" onClick={() => void persist(false, false)}>{text.refuse}</button><button type="button" onClick={() => void persist(audience, marketing)}>{text.save}</button><button type="button" onClick={() => void persist(true, true)}>{text.accept}</button></nav></div>
  </section>;
}

export function readConsent(): Choices | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie.split("; ").find((item) => item.startsWith(`${cookieName}=`))?.split("=").slice(1).join("=");
  if (!value) return null;
  try { const parsed = JSON.parse(decodeURIComponent(value)) as Partial<Choices>; return parsed.necessary === true && typeof parsed.audience === "boolean" && typeof parsed.marketing === "boolean" && typeof parsed.version === "string" ? parsed as Choices : null; } catch { return null; }
}
