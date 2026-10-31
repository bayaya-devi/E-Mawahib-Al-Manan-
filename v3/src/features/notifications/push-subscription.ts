"use client";

import { createClient } from "@/lib/supabase/client";

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("هذا الجهاز لا يدعم الإشعارات الخارجية.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("خدمة إشعارات الجهاز غير مهيأة بعد.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("لم يتم السماح بإشعارات الجهاز.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("تعذر إنشاء اشتراك الإشعارات.");
  const storedKey = window.localStorage.getItem("mawahib-device-key"); const deviceKey = storedKey ?? crypto.randomUUID();
  if (!storedKey) window.localStorage.setItem("mawahib-device-key", deviceKey);
  const result = await createClient().rpc("save_push_subscription", { target_device_key: deviceKey, target_name: navigator.platform || "هذا الجهاز", target_platform: navigator.platform || "", target_browser: navigator.userAgent, target_endpoint: json.endpoint, target_p256dh: json.keys.p256dh, target_auth_secret: json.keys.auth });
  if (result.error) throw new Error("تعذر حفظ اشتراك الإشعارات.");
  return result.data;
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/gu, "+").replace(/_/gu, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
