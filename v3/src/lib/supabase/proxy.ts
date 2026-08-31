import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getClientEnvironment } from "@/lib/env/client";
import { mayAccessPath, requiredRolesForPath } from "@/lib/auth/route-access";
import type { Database } from "@/types";
import type { AppRole } from "@/types";

export async function refreshSession(request: NextRequest) {
  const environment = getClientEnvironment();
  let response = NextResponse.next({ request });

  if (environment.NEXT_PUBLIC_APP_ENV === "test") return response;

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
  const protectedRoles = requiredRolesForPath(path.startsWith("/api/admin") ? "/admin" : path);
  if (protectedRoles && !auth.user) return deny(request, 401);

  if (auth.user && protectedRoles) {
    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
    ]);
    const actorRoles = (roles.data ?? []).map(({ role }) => role as AppRole);
    if (profile.error || roles.error || profile.data?.status !== "active" || !mayAccessPath(path.startsWith("/api/admin") ? "/admin" : path, actorRoles)) {
      return deny(request, 403);
    }
    const privileged = actorRoles.some((role) => role === "admin" || role === "direction");
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

function deny(request: NextRequest, status: 401 | 403) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, code: status === 401 ? "AUTH_REQUIRED" : "NOT_AUTHORIZED" }, { status });
  }
  const target = request.nextUrl.clone();
  target.pathname = "/ar";
  target.search = status === 401 ? "?auth=required" : "?auth=forbidden";
  return NextResponse.redirect(target);
}
