"use client";

import { Activity, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type HealthPayload = {
  ok: boolean;
  appVersion?: string;
  environment?: string;
  checkedAt?: string;
  checks?: Record<string, "ready" | "degraded">;
  diagnostics?: Record<string, string | number>;
};

export function SystemHealth() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchHealth()); } catch { setData({ ok: false }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void fetchHealth().then((payload) => { if (active) setData(payload); }).catch(() => { if (active) setData({ ok: false }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section className="shell-page"><header className="shell-page__header"><div><span>الرقابة التقنية</span><h1>سلامة المنصة</h1><p>تشخيص غير حساس للخدمات وتكامل البيانات.</p></div><button className="ui-button ui-button--secondary" type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={18} className={loading ? "ui-spin" : undefined} />تحديث</button></header>
    {!data ? <div className="ui-skeleton" aria-label="جار الفحص" /> : !data.ok ? <div className="ui-state ui-state--error" role="alert"><CircleAlert /><strong>تعذر إتمام الفحص الآن</strong><span>بقية المنصة ما زالت متاحة.</span></div> : <>
      <div className="metric-grid">{Object.entries(data.checks ?? {}).map(([name, state]) => <article className="metric-card" key={name}><span>{state === "ready" ? <ShieldCheck size={20} /> : <CircleAlert size={20} />}{serviceLabel(name)}</span><strong>{state === "ready" ? "سليم" : "يحتاج متابعة"}</strong></article>)}</div>
      <section className="content-panel"><header className="content-panel__header"><Activity size={20} /><h2>سلامة البيانات</h2></header><div className="metric-grid">{Object.entries(data.diagnostics ?? {}).filter(([key]) => key !== "checked_at" && key !== "schema_version").map(([key, value]) => <article className="metric-card" key={key}><span>{diagnosticLabel(key)}</span><strong>{value}</strong></article>)}</div><p className="ui-muted">الإصدار {String(data.diagnostics?.schema_version ?? data.appVersion)} · {data.checkedAt ? new Date(data.checkedAt).toLocaleString("ar-MA") : ""}</p></section>
    </>}
  </section>;
}

function serviceLabel(key: string) { return ({ authentication: "الدخول", database: "قاعدة البيانات", storage: "الملفات", serviceWorker: "النسخة المحلية", notificationWorker: "عامل الإرسال", notificationEmail: "البريد الخارجي", notificationSms: "الرسائل النصية", notificationPush: "إشعارات الجهاز", contactOtp: "رموز التحقق" } as Record<string, string>)[key] ?? key; }
function diagnosticLabel(key: string) { return ({ auth_without_profile: "حساب بلا ملف", profile_without_role: "ملف بلا دور", student_without_class: "طالب بلا قسم", class_without_teacher: "قسم بلا أستاذ", stuck_offline_mutations: "مزامنة عالقة" } as Record<string, string>)[key] ?? key; }
async function fetchHealth(): Promise<HealthPayload> { const response = await fetch("/api/admin/health", { cache: "no-store" }); return response.json() as Promise<HealthPayload>; }
