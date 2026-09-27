import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side authority for administration mutations.  UI domains must not
 * decide who is an administrator; API routes call this boundary instead.
 */
export async function getAdministrationAccess() {
  const session = await createClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: roles }, { data: memberships }] = await Promise.all([
    session.from("profiles").select("status").eq("id", auth.user.id).maybeSingle(),
    session.from("user_roles").select("role").eq("user_id", auth.user.id),
    session
      .from("school_memberships")
      .select("school_id,status")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .limit(1),
  ]);

  const isAdministrator = (roles ?? []).some(
    ({ role }) => role === "admin" || role === "direction",
  );
  const membership = memberships?.[0];
  if (profile?.status !== "active" || !isAdministrator || !membership) return null;

  return {
    actorId: auth.user.id,
    schoolId: membership.school_id,
    admin: createAdminClient(),
  };
}
