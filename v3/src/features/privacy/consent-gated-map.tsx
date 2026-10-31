"use client";
import { useEffect, useState } from "react";
import { readConsent } from "./consent-banner";

export function ConsentGatedMap({ title, source }: { title: string; source: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { const update = () => setAllowed(readConsent()?.audience === true); update(); window.addEventListener("mawahib:consent-changed", update); return () => window.removeEventListener("mawahib:consent-changed", update); }, []);
  if (!allowed) return <div className="privacy-map-placeholder"><p>يتم تحميل الخريطة بعد الموافقة على قياس الجمهور.<br />La carte externe nécessite votre accord.</p><button type="button" onClick={() => window.dispatchEvent(new Event("mawahib:privacy-open"))}>إدارة الخصوصية</button></div>;
  return <iframe title={title} src={source} loading="lazy" referrerPolicy="no-referrer" />;
}
