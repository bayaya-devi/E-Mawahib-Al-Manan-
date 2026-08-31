import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getClientEnvironment } from "@/lib/env/client";
import type { Database } from "@/types";

export async function refreshSession(request: NextRequest) {
  const environment = getClientEnvironment();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser validates the session with Supabase Auth; do not replace with getSession.
  const { data: auth } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (auth.user && (path.startsWith("/admin") || path.startsWith("/api/admin")) && !path.startsWith("/auth/mfa")) {
    const roles = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    const privileged = (roles.data ?? []).some(({ role }) => role === "admin" || role === "direction");
    if (privileged) {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.data?.currentLevel !== "aal2") {
        if (path.startsWith("/api/")) return NextResponse.json({ ok: false, code: "MFA_REQUIRED" }, { status: 403 });
        const target = request.nextUrl.clone(); target.pathname = "/auth/mfa"; target.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
        return NextResponse.redirect(target);
      }
    }
  }

  return response;
}
