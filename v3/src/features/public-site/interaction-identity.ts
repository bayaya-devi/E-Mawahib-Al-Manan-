import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

import { getPrivilegedServerEnvironment } from "@/lib/env/server";

const visitorCookie = "mawahib_public_visitor";

export async function getPublicInteractionIdentity(replayId: string) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const visitor = cookieStore.get(visitorCookie)?.value ?? randomUUID();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip") ?? "unknown";
  const networkPrefix = forwarded.includes(":") ? forwarded.split(":").slice(0, 4).join(":") : forwarded.split(".").slice(0, 3).join(".");
  const userAgent = (headerStore.get("user-agent") ?? "unknown").slice(0, 160);
  const key = getPrivilegedServerEnvironment().INTERACTION_HMAC_KEY;
  const hash = (value: string) => createHmac("sha256", key).update(value).digest("hex");
  return { isNew: !cookieStore.has(visitorCookie), visitor, visitorHash: hash(`${visitor}|${userAgent}|${replayId}`), networkHash: hash(`${networkPrefix}|${userAgent.slice(0, 48)}|${replayId}`) };
}
