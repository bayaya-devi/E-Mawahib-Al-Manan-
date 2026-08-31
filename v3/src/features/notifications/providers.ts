import "server-only";
import type { DatabaseNotificationChannel } from "@/types/database";

export type NotificationJob = { delivery_id: string; channel: DatabaseNotificationChannel; destination: string; title: string; body: string; href: string | null; attempt_count: number };
export type ProviderResult = { success: boolean; provider: string; messageId?: string; errorCode?: string; errorDetail?: string };
type ProviderConfig = { url: string | undefined; token: string | undefined };

export async function deliverNotification(job: NotificationJob, configs: Partial<Record<DatabaseNotificationChannel, ProviderConfig>>): Promise<ProviderResult> {
  if (job.channel === "in_app" || job.channel === "whatsapp") return { success: false, provider: "none", errorCode: "CHANNEL_NOT_AVAILABLE", errorDetail: "This channel is not handled by the external delivery worker." };
  const config = configs[job.channel];
  if (!config?.url || !config.token) return { success: false, provider: "unconfigured", errorCode: "PROVIDER_NOT_CONFIGURED", errorDetail: `No server provider is configured for ${job.channel}.` };
  try {
    const response = await fetch(config.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.token}`, "idempotency-key": job.delivery_id }, body: JSON.stringify({ channel: job.channel, destination: job.destination, title: job.title, body: job.body, href: job.href }) });
    const payload = await response.json().catch(() => ({})) as { id?: string; messageId?: string; error?: string };
    if (!response.ok) return { success: false, provider: new URL(config.url).hostname, errorCode: `HTTP_${response.status}`, errorDetail: payload.error ?? response.statusText };
    const messageId = payload.messageId ?? payload.id;
    return messageId ? { success: true, provider: new URL(config.url).hostname, messageId } : { success: true, provider: new URL(config.url).hostname };
  } catch (error) { return { success: false, provider: "webhook", errorCode: "PROVIDER_UNREACHABLE", errorDetail: error instanceof Error ? error.message : "Unknown provider error" }; }
}
