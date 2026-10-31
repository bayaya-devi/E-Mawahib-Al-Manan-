import { afterEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification } }));

import { deliverNotification } from "./providers";

const job = { delivery_id: "delivery-1", channel: "email" as const, destination: "parent@example.test", title: "Title", body: "Body", href: "/student", attempt_count: 1 };

describe("external notification providers", () => {
  afterEach(() => { vi.unstubAllGlobals(); sendNotification.mockReset(); });

  it("fails closed when no real provider is configured", async () => {
    await expect(deliverNotification(job, { appBaseUrl: "https://app.example.test" })).resolves.toMatchObject({ success: false, errorCode: "PROVIDER_NOT_CONFIGURED", permanent: false });
  });

  it("sends email through Resend with idempotency", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await deliverNotification(job, { appBaseUrl: "https://app.example.test", resendApiKey: "re_test", emailFrom: "Mawahib <notify@example.test>" });
    expect(result).toEqual({ success: true, provider: "resend", messageId: "email-1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "idempotency-key": "delivery-1" }) }));
  });

  it("sends SMS through Twilio in E.164 format", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sid: "SM123" }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await deliverNotification({ ...job, channel: "sms", destination: "+212612345678" }, { appBaseUrl: "https://app.example.test", twilioAccountSid: `AC${"1".repeat(32)}`, twilioAuthToken: "secret-token-value", twilioFromNumber: "+15005550006" });
    expect(result).toEqual({ success: true, provider: "twilio", messageId: "SM123" });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(options.body)).toContain("To=%2B212612345678");
  });

  it("sends encrypted Web Push payloads and expires dead subscriptions", async () => {
    sendNotification.mockResolvedValueOnce({ headers: { location: "push-message-1" } });
    const config = { appBaseUrl: "https://app.example.test", vapidPublicKey: "public-key-with-more-than-forty-characters-123", vapidPrivateKey: "private-key-with-more-than-thirty-characters", vapidSubject: "mailto:admin@example.test" };
    const pushJob = { ...job, channel: "push" as const, destination: "https://push.example.test/abc", provider_payload: { p256dh: "public-device-key", auth: "auth-secret" } };
    await expect(deliverNotification(pushJob, config)).resolves.toEqual({ success: true, provider: "web-push", messageId: "push-message-1" });
    expect(sendNotification).toHaveBeenCalledOnce();
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    await expect(deliverNotification(pushJob, config)).resolves.toMatchObject({ success: false, errorCode: "WEB_PUSH_410", permanent: true });
  });
});
