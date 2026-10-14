import "server-only";

import { fetchWithResilience } from "@/lib/http/resilience";

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = { success?: boolean };

/** Validates a single-use Turnstile token when the server secret is configured. */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const payload = new FormData();
    payload.set("secret", secret);
    payload.set("response", token);
    const response = await fetchWithResilience(siteverifyUrl, { method: "POST", body: payload, cache: "no-store", timeoutMs: 5_000, retries: 1, circuitKey: "cloudflare-turnstile" });
    if (!response.ok) return false;
    return (await response.json() as TurnstileResponse).success === true;
  } catch {
    return false;
  }
}
