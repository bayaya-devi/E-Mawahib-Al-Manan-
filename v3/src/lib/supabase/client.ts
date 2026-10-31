"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnvironment } from "@/lib/env/client";
import type { Database } from "@/types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!browserClient) {
    const environment = getClientEnvironment();
    browserClient = createBrowserClient<Database>(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  return browserClient;
}
