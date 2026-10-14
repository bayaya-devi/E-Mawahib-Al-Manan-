"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("application_boundary", { digest: error.digest ?? "unavailable" });
  }, [error]);

  return <main className="fatal-state" id="main-content" role="alert"><div><span>تعذر تحميل هذا الجزء</span><h1>بقية المنصة ما زالت متاحة</h1><p>تحقق من الاتصال ثم أعد المحاولة.<br />Vérifiez la connexion · Check your connection</p><button type="button" onClick={reset}>إعادة المحاولة</button></div></main>;
}
