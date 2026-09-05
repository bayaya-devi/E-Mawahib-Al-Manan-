import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { publicLocaleCookie, resolvePublicLocale } from "@/features/public-site/locale-preference";

export default async function RootPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const accepted = requestHeaders.get("accept-language")?.split(",").map((item) => item.split(";", 1)[0]?.trim()).filter((item): item is string => Boolean(item));
  const locale = resolvePublicLocale(accepted, cookieStore.get(publicLocaleCookie)?.value);
  redirect(`/${locale}`);
}
