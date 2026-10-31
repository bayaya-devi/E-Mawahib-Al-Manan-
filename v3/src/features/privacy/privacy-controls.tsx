"use client";
import { useState } from "react";
import { Button, Select, useToast } from "@/components/ui";

export function PrivacyControls() {
  const { showToast } = useToast(); const [kind, setKind] = useState("rectification"); const [details, setDetails] = useState(""); const [busy, setBusy] = useState(false);
  async function request() { setBusy(true); const response = await fetch("/api/privacy/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, details }) }); setBusy(false); if (response.ok) { setDetails(""); showToast({ title: "تم تسجيل الطلب", description: "ستراجعه الإدارة مع الحفاظ على السجل القانوني.", tone: "success" }); } else showToast({ title: "تعذر تسجيل الطلب", tone: "info" }); }
  return <section className="settings-section"><header><div><h2>الخصوصية والبيانات</h2><p>تحميل بياناتك أو إرسال طلب تصحيح أو حذف.</p></div></header><div className="privacy-account-actions"><a className="button button--secondary" href="/api/privacy/export" download>تحميل بياناتي JSON</a><Select label="نوع الطلب" value={kind} onChange={(event) => setKind(event.target.value)}><option value="rectification">تصحيح البيانات</option><option value="erasure">حذف أو إخفاء الهوية</option><option value="restriction">تقييد المعالجة</option></Select><label className="privacy-details"><span>التوضيح</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={4} /></label><Button loading={busy} onClick={() => void request()}>إرسال الطلب</Button></div></section>;
}
