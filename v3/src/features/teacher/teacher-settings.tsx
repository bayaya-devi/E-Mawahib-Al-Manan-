"use client";

import { Check, LogIn, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { applyAppearance, readAccent, readAppearance, saveAppearance } from "@/features/settings/appearance";
import type { AppearanceAccent as Accent, AppearanceMode as Appearance } from "@/features/settings/appearance";
import { deviceAccountHome, readDeviceAccounts, rememberAuthenticatedAccount, removeDeviceAccount } from "./device-account-vault";
import type { SavedDeviceAccount } from "./device-account-vault";


export function TeacherSettings() {
  const router = useRouter(); const { showToast } = useToast(); const [accounts, setAccounts] = useState<SavedDeviceAccount[]>([]); const [activeId, setActiveId] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());
  const [appearance, setAppearance] = useState<Appearance>(readAppearance); const [accent, setAccent] = useState<Accent>(readAccent);
  useEffect(() => { applyAppearance(appearance, accent); void rememberAuthenticatedAccount().then(({ items, active }) => { setAccounts(items); setActiveId(active); }); }, [appearance, accent]);
  function changeAppearance(value: Appearance) { setAppearance(value); saveAppearance(value, accent); }
  function changeAccent(value: Accent) { setAccent(value); saveAppearance(appearance, value); }
  async function switchAccount(account: SavedDeviceAccount) { if (account.id === activeId) return; if (expiredIds.has(account.id)) return router.push("/login?addAccount=1"); setBusy(true); const result = await createClient().auth.setSession({ access_token: account.accessToken, refresh_token: account.refreshToken }); setBusy(false); if (result.error || !result.data.session) { setExpiredIds((current) => new Set(current).add(account.id)); return showToast({ title: "إعادة الاتصال مطلوبة", description: "أدخل(ي) بيانات هذا الحساب مرة واحدة.", tone: "info" }); } router.push(deviceAccountHome(account.kind)); router.refresh(); }
  async function remove(account: SavedDeviceAccount) { if (!window.confirm(`إزالة ${account.name} من هذا الجهاز فقط؟`)) return; removeDeviceAccount(account.id); setAccounts(readDeviceAccounts()); if (account.id === activeId) { await createClient().auth.signOut({ scope: "local" }); router.replace("/login"); router.refresh(); } }
  return <div className="teacher-settings"><section className="settings-compact"><h2>المظهر</h2><div className="setting-options" role="group" aria-label="نمط العرض">{(["light", "dark", "system"] as Appearance[]).map((value) => <button type="button" className={appearance === value ? "is-active" : undefined} key={value} onClick={() => changeAppearance(value)}>{appearanceLabel(value)}{appearance === value ? <Check size={16} /> : null}</button>)}</div><div className="accent-options" aria-label="لون الواجهة">{(["green", "blue", "plum", "gold"] as Accent[]).map((value) => <button type="button" className={accent === value ? `is-active is-${value}` : `is-${value}`} aria-label={accentLabel(value)} title={accentLabel(value)} key={value} onClick={() => changeAccent(value)} />)}</div></section><section className="settings-compact"><h2>الحسابات</h2><div className="device-accounts">{accounts.map((account) => <article key={account.id}><span><UserRound size={19} /></span><div><strong>{account.name}</strong><small>{roleLabel(account.kind)}</small></div>{account.id === activeId ? <Badge tone="success">الحساب الحالي</Badge> : expiredIds.has(account.id) ? <Button size="sm" variant="secondary" onClick={() => router.push("/login?addAccount=1")}>إعادة الاتصال</Button> : <Button size="sm" variant="secondary" disabled={busy} onClick={() => void switchAccount(account)}>تبديل</Button>}<Button size="icon" variant="quiet" aria-label={`إزالة ${account.name} من الجهاز`} onClick={() => void remove(account)}><Trash2 size={17} /></Button></article>)}</div><Button variant="secondary" onClick={() => router.push("/login?addAccount=1")}><LogIn size={18} />إضافة حساب</Button></section></div>;
}

function roleLabel(role: SavedDeviceAccount["kind"]) { return ({ teacher: "أستاذ(ة)", student: "طالب(ة)", parent: "ولي(ة)", admin: "إدارة", direction: "إدارة" })[role]; }
function appearanceLabel(value: Appearance) { return ({ light: "فاتح", dark: "داكن", system: "حسب الجهاز" })[value]; }
function accentLabel(value: Accent) { return ({ green: "أخضر", blue: "أزرق", plum: "خمري", gold: "ذهبي" })[value]; }
