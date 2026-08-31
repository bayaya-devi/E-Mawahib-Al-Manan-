import "server-only";

import webPush from "web-push";

import type { DatabaseNotificationChannel, Json } from "@/types/database";

export type NotificationJob = { delivery_id: string; channel: DatabaseNotificationChannel; destination: string; title: string; body: string; href: string | null; attempt_count: number; provider_payload?: Json };
export type ProviderResult = { success: boolean; provider: string; messageId?: string; errorCode?: string; errorDetail?: string; permanent?: boolean };
export type NotificationProviderConfig = {
  appBaseUrl: string; resendApiKey?: string | undefined; emailFrom?: string | undefined; twilioAccountSid?: string | undefined; twilioAuthToken?: string | undefined;
  twilioFromNumber?: string | undefined; twilioMessagingServiceSid?: string | undefined; vapidPublicKey?: string | undefined; vapidPrivateKey?: string | undefined; vapidSubject?: string | undefined;
  webhook?: Partial<Record<"email" | "sms" | "push", { url?: string | undefined; token?: string | undefined }>>;
};

export async function deliverNotification(job: NotificationJob, config: NotificationProviderConfig): Promise<ProviderResult> {
  if (job.channel === "in_app" || job.channel === "whatsapp") return failure("none", "CHANNEL_NOT_AVAILABLE", "This channel is not handled by the external delivery worker.", true);
  if (job.channel === "email" && config.resendApiKey && config.emailFrom) return sendResend(job, config);
  if (job.channel === "sms" && config.twilioAccountSid && config.twilioAuthToken && (config.twilioFromNumber || config.twilioMessagingServiceSid)) return sendTwilio(job, config);
  if (job.channel === "push" && config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject) return sendWebPush(job, config);
  const webhook = config.webhook?.[job.channel];
  if (webhook?.url && webhook.token) return sendWebhook(job, webhook.url, webhook.token);
  return failure("unconfigured", "PROVIDER_NOT_CONFIGURED", `No server provider is configured for ${job.channel}.`);
}

export async function deliverOtp(kind: "email" | "phone", destination: string, code: string, config: NotificationProviderConfig): Promise<ProviderResult> {
  return deliverNotification({ delivery_id: `otp-${crypto.randomUUID()}`, channel: kind === "email" ? "email" : "sms", destination,
    title: "رمز التحقق من e-Mawahib", body: `رمز التحقق هو ${code}. تنتهي صلاحيته خلال 10 دقائق.`, href: null, attempt_count: 1 }, config);
}

async function sendResend(job: NotificationJob, config: NotificationProviderConfig): Promise<ProviderResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json", "idempotency-key": job.delivery_id }, body: JSON.stringify({ from: config.emailFrom, to: [job.destination], subject: job.title, text: `${job.body}${job.href ? `\n\n${absoluteHref(job.href, config.appBaseUrl)}` : ""}`, html: emailHtml(job, config.appBaseUrl) }) });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) return failure("resend", `RESEND_${response.status}`, payload.message ?? payload.name ?? response.statusText, response.status >= 400 && response.status < 500 && response.status !== 429);
    return payload.id ? { success: true, provider: "resend", messageId: payload.id } : { success: true, provider: "resend" };
  } catch (error) { return caught("resend", error); }
}

async function sendTwilio(job: NotificationJob, config: NotificationProviderConfig): Promise<ProviderResult> {
  const body = new URLSearchParams({ To: job.destination, Body: `${job.title}\n${job.body}` });
  if (config.twilioMessagingServiceSid) body.set("MessagingServiceSid", config.twilioMessagingServiceSid); else if (config.twilioFromNumber) body.set("From", config.twilioFromNumber);
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid ?? "")}/Messages.json`, { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body });
    const payload = await response.json().catch(() => ({})) as { sid?: string; code?: number; message?: string };
    if (!response.ok) return failure("twilio", payload.code ? `TWILIO_${payload.code}` : `TWILIO_${response.status}`, payload.message ?? response.statusText, response.status >= 400 && response.status < 500 && response.status !== 429);
    return payload.sid ? { success: true, provider: "twilio", messageId: payload.sid } : { success: true, provider: "twilio" };
  } catch (error) { return caught("twilio", error); }
}

async function sendWebPush(job: NotificationJob, config: NotificationProviderConfig): Promise<ProviderResult> {
  const keys = pushKeys(job.provider_payload);
  if (!keys) return failure("web-push", "INVALID_PUSH_SUBSCRIPTION", "The subscription keys are missing.", true);
  try {
    const result = await webPush.sendNotification({ endpoint: job.destination, keys }, JSON.stringify({ title: job.title, body: job.body, href: job.href ?? "/", tag: job.delivery_id }), { TTL: 3600, urgency: "normal", vapidDetails: { subject: config.vapidSubject ?? "", publicKey: config.vapidPublicKey ?? "", privateKey: config.vapidPrivateKey ?? "" } });
    return { success: true, provider: "web-push", ...(result.headers.location ? { messageId: result.headers.location } : {}) };
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
    return failure("web-push", statusCode ? `WEB_PUSH_${statusCode}` : "WEB_PUSH_FAILED", error instanceof Error ? error.message : "Web Push failed", statusCode === 404 || statusCode === 410);
  }
}

async function sendWebhook(job: NotificationJob, url: string, token: string): Promise<ProviderResult> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": job.delivery_id }, body: JSON.stringify({ channel: job.channel, destination: job.destination, title: job.title, body: job.body, href: job.href, providerPayload: job.provider_payload }) });
    const payload = await response.json().catch(() => ({})) as { id?: string; messageId?: string; error?: string };
    if (!response.ok) return failure(new URL(url).hostname, `HTTP_${response.status}`, payload.error ?? response.statusText, response.status >= 400 && response.status < 500 && response.status !== 429);
    const messageId = payload.messageId ?? payload.id;
    return messageId ? { success: true, provider: new URL(url).hostname, messageId } : { success: true, provider: new URL(url).hostname };
  } catch (error) { return caught("webhook", error); }
}

function pushKeys(payload: Json | undefined): { p256dh: string; auth: string } | null { if (!payload || Array.isArray(payload) || typeof payload !== "object") return null; const p256dh = payload.p256dh; const auth = payload.auth; return typeof p256dh === "string" && typeof auth === "string" ? { p256dh, auth } : null; }
function emailHtml(job: NotificationJob, appBaseUrl: string) { const link = job.href ? `<p><a href="${escapeHtml(absoluteHref(job.href, appBaseUrl))}">فتح المنصة</a></p>` : ""; return `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>${escapeHtml(job.title)}</h2><p>${escapeHtml(job.body)}</p>${link}</div>`; }
function absoluteHref(href: string, appBaseUrl: string) { return new URL(href, appBaseUrl).toString(); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }
function failure(provider: string, errorCode: string, errorDetail: string, permanent = false): ProviderResult { return { success: false, provider, errorCode, errorDetail: errorDetail.slice(0, 1000), permanent }; }
function caught(provider: string, error: unknown): ProviderResult { return failure(provider, "PROVIDER_UNREACHABLE", error instanceof Error ? error.message : "Unknown provider error"); }
