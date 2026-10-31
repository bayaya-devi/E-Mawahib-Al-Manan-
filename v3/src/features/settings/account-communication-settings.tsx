"use client";

import { Bell, KeyRound, Laptop, Mail, Phone, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, Input, Select, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseContactKind, DatabaseContactLabel, DatabaseNotificationCategory } from "@/types/database";
import { enablePushNotifications } from "@/features/notifications/push-subscription";
import { normalizeContact } from "./normalize-contact";

type Contact = { link_id: string; kind: DatabaseContactKind; masked_value: string; label: DatabaseContactLabel; is_primary: boolean; notification_enabled: boolean; use_for_login: boolean; use_for_notifications: boolean; is_emergency: boolean; verification_status: "unverified" | "pending" | "verified" | "disabled" };
type Preference = { category: DatabaseNotificationCategory; in_app: boolean; push: boolean; email: boolean; sms: boolean; digest_frequency: string };
type Device = { id: string; name: string; platform: string | null; browser: string | null; enabled: boolean; last_seen_at: string };

const categoryLabels: Record<DatabaseNotificationCategory, string> = { message: "الرسائل", request: "الطلبات", assignment: "الواجبات", learning: "التعلّم", attendance: "الحضور", session: "الحصص", administration: "الإدارة", system: "النظام" };
const contactLabels: Record<DatabaseContactLabel, string> = { personal: "شخصي", professional: "مهني", parent: "ولي الأمر", emergency: "للطوارئ", other: "آخر" };
const categories = Object.keys(categoryLabels) as DatabaseNotificationCategory[];

export function AccountCommunicationSettings() {
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [kind, setKind] = useState<DatabaseContactKind>("phone");
  const [label, setLabel] = useState<DatabaseContactLabel>("personal");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpLinkId, setOtpLinkId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  const load = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_APP_ENV === "test") return;
    const client = createClient(); const { data: auth } = await client.auth.getUser(); const id = auth.user?.id ?? null; setUserId(id); if (!id) return;
    const storedKey = window.localStorage.getItem("mawahib-device-key"); const deviceKey = storedKey ?? crypto.randomUUID(); if (!storedKey) window.localStorage.setItem("mawahib-device-key", deviceKey);
    await client.rpc("register_user_device", { target_device_key: deviceKey, target_name: navigator.platform || "هذا الجهاز", target_platform: navigator.platform || "", target_browser: navigator.userAgent, target_push_subscription_id: null });
    const [contactResult, preferenceResult, deviceResult] = await Promise.all([
      client.rpc("list_my_contacts"),
      client.from("notification_preferences").select("category,in_app,push,email,sms,digest_frequency").eq("user_id", id).order("category"),
      client.from("user_devices").select("id,name,platform,browser,enabled,last_seen_at").eq("user_id", id).eq("enabled", true).order("last_seen_at", { ascending: false }),
    ]);
    setContacts(contactResult.data ?? []); setPreferences(preferenceResult.data ?? []); setDevices(deviceResult.data ?? []);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function addContact() {
    if (!userId || busy) return; setBusy(true);
    try {
      const { normalized, countryCode: country } = normalizeContact(kind, value);
      const result = await createClient().rpc("save_user_contact", { target_user_id: userId, target_kind: kind, target_normalized_value: normalized, target_display_value: value.trim(), target_country_code: country, target_label: label, target_is_primary: contacts.length === 0, target_notification_enabled: true, target_use_for_login: false, target_use_for_notifications: true, target_is_emergency: label === "emergency", target_relationship: null });
      if (result.error) throw result.error; setValue(""); await load(); showToast({ title: "تمت إضافة وسيلة الاتصال", description: "لن تستخدم للإرسال الخارجي قبل التحقق منها.", tone: "success" });
    } catch (error) { showToast({ title: error instanceof Error ? error.message : "تعذرت إضافة وسيلة الاتصال", tone: "info" }); }
    finally { setBusy(false); }
  }

  async function removeContact(id: string) { const result = await createClient().rpc("remove_user_contact", { target_link_id: id }); if (result.error) return showToast({ title: "تعذر حذف وسيلة الاتصال", tone: "info" }); await load(); }
  function preferenceFor(category: DatabaseNotificationCategory): Preference { return preferences.find((item) => item.category === category) ?? { category, in_app: true, push: false, email: false, sms: false, digest_frequency: "immediate" }; }
  async function toggle(category: DatabaseNotificationCategory, channel: "in_app" | "push" | "email" | "sms") {
    const current = preferenceFor(category); const next = { ...current, [channel]: !current[channel] };
    const result = await createClient().rpc("set_notification_channels", { target_category: category, target_in_app: next.in_app, target_push: next.push, target_email: next.email, target_sms: next.sms, target_whatsapp: false, target_digest_frequency: next.digest_frequency, target_quiet_start: null, target_quiet_end: null });
    if (result.error) return showToast({ title: "تعذر حفظ التفضيلات", tone: "info" });
    setPreferences((items) => [...items.filter((item) => item.category !== category), next]);
  }
  async function removeDevice(id: string) { await createClient().rpc("remove_user_device", { target_device_id: id }); await load(); }
  async function requestOtp(linkId: string) {
    setOtpBusy(true); const response = await fetch("/api/contacts/verification/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId }) });
    const result = await response.json().catch(() => ({ message: "تعذر إرسال الرمز." })) as { message: string };
    setOtpBusy(false); showToast({ title: result.message, tone: response.ok ? "success" : "info" }); if (response.ok) { setOtpLinkId(linkId); setOtpCode(""); await load(); }
  }
  async function verifyOtp() {
    if (!otpLinkId || otpCode.length !== 6) return; setOtpBusy(true);
    const response = await fetch("/api/contacts/verification/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId: otpLinkId, code: otpCode }) });
    const result = await response.json().catch(() => ({ message: "رمز غير صحيح أو منتهي." })) as { message: string };
    setOtpBusy(false); showToast({ title: result.message, tone: response.ok ? "success" : "info" }); if (response.ok) { setOtpLinkId(null); setOtpCode(""); await load(); }
  }
  async function enablePush() { try { await enablePushNotifications(); await load(); showToast({ title: "تم تفعيل إشعارات الجهاز", tone: "success" }); } catch (error) { showToast({ title: error instanceof Error ? error.message : "تعذر تفعيل الإشعارات", tone: "info" }); } }

  return <div className="communication-settings">
    <section className="settings-section"><header><span><Phone size={20} /></span><div><h2>وسائل الاتصال</h2><p>تظهر البيانات مخفية لحماية الخصوصية.</p></div></header>
      <div className="contact-list">{contacts.map((contact) => <Card key={contact.link_id} className="contact-row"><span className="contact-icon">{contact.kind === "email" ? <Mail size={19} /> : <Phone size={19} />}</span><div><strong dir="ltr">{contact.masked_value}</strong><small>{contactLabels[contact.label]}</small></div><Badge tone={contact.verification_status === "verified" ? "success" : "warning"}>{contact.verification_status === "verified" ? "موثّق" : contact.verification_status === "pending" ? "قيد التحقق" : "غير موثّق"}</Badge><span className="contact-actions">{contact.verification_status !== "verified" ? <Button variant="secondary" size="sm" loading={otpBusy && otpLinkId === contact.link_id} onClick={() => void requestOtp(contact.link_id)}><KeyRound size={16} />تحقق</Button> : null}<Button variant="quiet" size="icon" aria-label="حذف" onClick={() => void removeContact(contact.link_id)}><Trash2 size={17} /></Button></span></Card>)}</div>
      {otpLinkId ? <div className="otp-form"><Input label="رمز التحقق" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/gu, ""))} /><Button loading={otpBusy} disabled={otpCode.length !== 6} onClick={() => void verifyOtp()}>تأكيد الرمز</Button></div> : null}
      <div className="contact-form"><Select label="النوع" value={kind} onChange={(event) => setKind(event.target.value as DatabaseContactKind)}><option value="phone">هاتف</option><option value="email">بريد إلكتروني</option></Select><Select label="الاستخدام" value={label} onChange={(event) => setLabel(event.target.value as DatabaseContactLabel)}>{Object.entries(contactLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</Select><Input label={kind === "phone" ? "رقم الهاتف" : "البريد الإلكتروني"} dir="ltr" value={value} onChange={(event) => setValue(event.target.value)} placeholder={kind === "phone" ? "+212 6..." : "name@example.com"} /><Button loading={busy} onClick={() => void addContact()}><Plus size={18} />إضافة</Button></div>
    </section>

    <section className="settings-section"><header><span><Bell size={20} /></span><div><h2>تفضيلات الإشعارات</h2><p>قد تفرض الإدارة إشعارات السلامة أو الحالات المستعجلة.</p></div></header>
      <div className="preference-grid"><div className="preference-head"><span>الفئة</span><span>داخل التطبيق</span><span>الجهاز</span><span>البريد</span><span>رسالة نصية</span></div>{categories.map((category) => { const current = preferenceFor(category); return <div className="preference-row" key={category}><strong>{categoryLabels[category]}</strong>{(["in_app", "push", "email", "sms"] as const).map((channel) => <label className="setting-toggle" key={channel}><input type="checkbox" checked={current[channel]} onChange={() => void toggle(category, channel)} /><span /></label>)}</div>; })}</div>
    </section>

    <section className="settings-section"><header><span><Laptop size={20} /></span><div><h2>الأجهزة</h2><p>يمكن إيقاف جهاز لم تعد تستخدمه.</p></div></header><div><Button variant="secondary" onClick={() => void enablePush()}><Bell size={18} />تفعيل إشعارات هذا الجهاز</Button></div>
      <div className="device-list">{devices.length ? devices.map((device) => <Card className="device-row" key={device.id}><ShieldCheck size={19} /><div><strong>{device.name}</strong><small>{[device.platform, device.browser].filter(Boolean).join(" · ") || "جهاز مسجل"}</small></div><time>{new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(device.last_seen_at))}</time><Button variant="quiet" size="sm" onClick={() => void removeDevice(device.id)}>إيقاف</Button></Card>) : <p className="settings-empty">لا توجد أجهزة مسجلة للإشعارات.</p>}</div>
    </section>
  </div>;
}
