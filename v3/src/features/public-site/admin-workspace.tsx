"use client";

import { Building2, CalendarPlus, Newspaper, Plus, RadioTower } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

const localeNames = { ar: "العربية", fr: "Français", en: "English", amz: "ⵜⴰⵛⵍⵃⵉⵜ" } as const;
type Resource = "site" | "news" | "replay" | "schedule";
type Listing = { news?: Array<{ id: string; status: string; event_date: string | null }>; replays?: Array<{ id: string; status: string; speaker: string | null; featured: boolean }>; schedules?: Array<{ id: string; audience: string; day_of_week: number; starts_at: string; ends_at: string; active: boolean }> };

export function PublicSiteAdminWorkspace() {
  const [resource, setResource] = useState<Resource>("news");
  const [listing, setListing] = useState<Listing>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh() { setLoading(true); const response = await fetch("/api/admin/public-content"); if (response.ok) setListing(await response.json() as Listing); else setMessage("تعذر تحميل المحتوى أو لا تملك الصلاحية."); setLoading(false); }
  useEffect(() => {
    void fetch("/api/admin/public-content").then(async (response) => {
      if (response.ok) setListing(await response.json() as Listing);
      else setMessage("تعذر تحميل المحتوى أو لا تملك الصلاحية.");
      setLoading(false);
    });
  }, []);
  return <div className="site-admin">
    <header className="site-admin__intro"><span>إدارة الموقع العام</span><h1>النشر والمواعيد</h1><p>المحتوى المنشور هنا يظهر مباشرة في موقع دار الحديث والقرآن.</p></header>
    <div className="site-admin__tabs" role="tablist" aria-label="أقسام الموقع">
      <button className={resource === "site" ? "is-active" : ""} onClick={() => setResource("site")} type="button"><Building2 />بيانات الموقع</button>
      <button className={resource === "news" ? "is-active" : ""} onClick={() => setResource("news")} type="button"><Newspaper />الأخبار</button>
      <button className={resource === "replay" ? "is-active" : ""} onClick={() => setResource("replay")} type="button"><RadioTower />المحاضرات</button>
      <button className={resource === "schedule" ? "is-active" : ""} onClick={() => setResource("schedule")} type="button"><CalendarPlus />المواعيد</button>
    </div>
    {message && <p className="site-admin__message" role="status">{message}</p>}
    <ContentForm resource={resource} onSaved={() => { setMessage("تم الحفظ بنجاح."); void refresh(); }} />
    {resource !== "site" && <section className="site-admin__records"><h2>المحتوى الحالي</h2>{loading ? <p>جار التحميل…</p> : <RecordList resource={resource} listing={listing} onChanged={() => void refresh()} />}</section>}
  </div>;
}

function ContentForm({ resource, onSaved }: { resource: Resource; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const translations = Object.keys(localeNames).map((locale) => ({ locale, title: String(data.get(`${locale}-title`) ?? ""), summary: String(data.get(`${locale}-summary`) ?? "") }));
    const base = { resource, translations };
    const payload = resource === "site" ? { ...base, phone: data.get("phone"), email: data.get("email"), mapUrl: data.get("mapUrl"), minimumAge: Number(data.get("minimumAge")), monthlyFee: Number(data.get("monthlyFee")), registrationOpen: data.get("registrationOpen") === "on" } : resource === "news" ? { ...base, status: data.get("status"), imageUrl: data.get("imageUrl"), eventDate: data.get("eventDate") } : resource === "replay" ? { ...base, status: data.get("status"), videoUrl: data.get("videoUrl"), thumbnailUrl: data.get("thumbnailUrl"), speaker: data.get("speaker"), eventDate: data.get("eventDate"), featured: data.get("featured") === "on" } : { ...base, active: data.get("active") === "on", audience: data.get("audience"), dayOfWeek: Number(data.get("dayOfWeek")), startsAt: data.get("startsAt"), endsAt: data.get("endsAt"), location: data.get("location") };
    const response = await fetch("/api/admin/public-content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false); if (response.ok) { form.reset(); onSaved(); }
  }
  return <form className="site-admin__form" onSubmit={submit}><div className="site-admin__form-heading"><div><span>إضافة جديدة</span><h2>{resource === "news" ? "خبر" : resource === "replay" ? "محاضرة أو إعادة" : "موعد"}</h2></div><Plus aria-hidden="true" /></div>
    {resource !== "schedule" && resource !== "site" && <div className="site-admin__row"><label>حالة النشر<select name="status" defaultValue="draft"><option value="draft">مسودة</option><option value="published">منشور</option><option value="archived">مؤرشف</option></select></label><label>التاريخ<input name="eventDate" type="date" /></label></div>}
    {resource === "site" && <><div className="site-admin__row"><label>الهاتف<input name="phone" inputMode="tel" /></label><label>البريد الإلكتروني<input name="email" type="email" /></label></div><label>رابط الخريطة<input name="mapUrl" type="url" inputMode="url" /></label><div className="site-admin__row"><label>السن الأدنى<input name="minimumAge" type="number" min="3" defaultValue="5" required /></label><label>الواجب الشهري<input name="monthlyFee" type="number" min="0" defaultValue="100" required /></label></div><label className="site-admin__check"><input name="registrationOpen" type="checkbox" defaultChecked />التسجيل مفتوح</label></>}
    {resource === "news" && <label>رابط الصورة<input name="imageUrl" type="url" inputMode="url" placeholder="https://" /></label>}
    {resource === "replay" && <><label>رابط الفيديو<input name="videoUrl" type="url" required inputMode="url" placeholder="https://" /></label><div className="site-admin__row"><label>رابط الصورة المصغرة<input name="thumbnailUrl" type="url" inputMode="url" /></label><label>المتحدث<input name="speaker" /></label></div><label className="site-admin__check"><input name="featured" type="checkbox" />عرض مميز</label></>}
    {resource === "schedule" && <><div className="site-admin__row"><label>الفئة<input name="audience" required placeholder="الأطفال، النساء…" /></label><label>اليوم<select name="dayOfWeek" defaultValue="0">{["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label></div><div className="site-admin__row"><label>البداية<input name="startsAt" type="time" required /></label><label>النهاية<input name="endsAt" type="time" required /></label><label>المكان<input name="location" /></label></div><label className="site-admin__check"><input name="active" type="checkbox" defaultChecked />موعد ظاهر</label></>}
    <div className="site-admin__translations">{Object.entries(localeNames).map(([locale, name], index) => <details key={locale} open={index === 0}><summary>{name}</summary><label>العنوان<input name={`${locale}-title`} required /></label><label>الوصف<textarea name={`${locale}-summary`} required rows={3} /></label></details>)}</div>
    <button className="site-admin__submit" type="submit" disabled={busy}>{busy ? "جار الحفظ…" : "حفظ"}</button>
  </form>;
}

function RecordList({ resource, listing, onChanged }: { resource: Exclude<Resource, "site">; listing: Listing; onChanged: () => void }) {
  const records = resource === "news" ? listing.news : resource === "replay" ? listing.replays : listing.schedules;
  if (!records?.length) return <p>لا يوجد محتوى في هذا القسم.</p>;
  async function change(id: string, state: string | boolean) { const response = await fetch("/api/admin/public-content", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource, id, state }) }); if (response.ok) onChanged(); }
  return <div className="site-admin__record-list">{records.map((record) => <article key={record.id}><code>{record.id.slice(0, 8)}</code><strong>{"status" in record ? record.status : record.audience}</strong>{"starts_at" in record && <span>{record.starts_at.slice(0, 5)} – {record.ends_at.slice(0, 5)}</span>}<div>{resource === "schedule" ? <button type="button" onClick={() => void change(record.id, !("active" in record && record.active))}>{"active" in record && record.active ? "إخفاء" : "إظهار"}</button> : <><button type="button" onClick={() => void change(record.id, "published")}>نشر</button><button type="button" onClick={() => void change(record.id, "draft")}>مسودة</button><button type="button" onClick={() => void change(record.id, "archived")}>أرشفة</button></>}</div></article>)}</div>;
}
