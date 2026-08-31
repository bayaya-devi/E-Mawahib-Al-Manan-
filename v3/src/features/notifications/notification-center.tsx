"use client";

import { Bell, BellRing, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Drawer, IconButton, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseNotificationCategory } from "@/types/database";

type NotificationItem = { id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string; category: DatabaseNotificationCategory };

export function NotificationCenter() {
  const { showToast } = useToast(); const [open, setOpen] = useState(false); const [items, setItems] = useState<NotificationItem[]>([]);
  useEffect(() => {
    const client = createClient(); let userId: string | undefined;
    void client.auth.getUser().then(async ({ data }) => {
      userId = data.user?.id; if (!userId) return;
      const result = await client.from("user_notifications").select("id,title,body,href,read_at,created_at,category").eq("user_id", userId).order("created_at", { ascending: false }).limit(40);
      setItems(result.data ?? []);
    });
    const channel = client.channel(`notifications:${crypto.randomUUID()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications" }, (payload) => {
      const item = payload.new as NotificationItem & { user_id?: string }; if (userId && item.user_id !== userId) return;
      setItems((current) => [item, ...current].slice(0, 40)); showToast({ title: item.title, description: item.body, tone: "info" });
      if (Notification.permission === "granted") void navigator.serviceWorker?.ready.then((registration) => registration.showNotification(item.title, { body: item.body, tag: item.id, data: { href: item.href } }));
    }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [showToast]);
  const unread = items.filter((item) => !item.read_at).length;
  async function markRead(item: NotificationItem): Promise<void> { if (!item.read_at) await createClient().rpc("mark_notification_read", { target_notification_id: item.id }); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: entry.read_at ?? new Date().toISOString() } : entry)); if (item.href) window.location.assign(item.href); }
  async function enableBrowser(): Promise<void> {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await createClient().rpc("set_notification_preference", { target_category: "system", target_in_app: true, target_browser: true, target_realtime: true });
      showToast({ title: "تم تفعيل إشعارات المتصفح", tone: "success" });
    }
  }
  return <><span className="notification-trigger"><IconButton label="الإشعارات" onClick={() => setOpen(true)}>{unread ? <BellRing aria-hidden="true" size={20} /> : <Bell aria-hidden="true" size={20} />}</IconButton>{unread ? <b>{Math.min(unread, 99)}</b> : null}</span><Drawer open={open} onOpenChange={setOpen} title="الإشعارات"><div className="notification-list"><Button variant="secondary" size="sm" onClick={() => void enableBrowser()}><Bell size={17} />تفعيل إشعارات المتصفح</Button>{items.length ? items.map((item) => <button className={item.read_at ? undefined : "is-unread"} type="button" key={item.id} onClick={() => void markRead(item)}><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time></span>{item.read_at ? <CheckCheck size={16} /> : <i />}</button>) : <p className="notification-empty">لا توجد إشعارات.</p>}</div></Drawer></>;
}
