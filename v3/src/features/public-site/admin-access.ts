import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getSiteManager() {
  const session = await createClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return null;
  const [{ data: profile }, { data: roles }, { data: memberships }] = await Promise.all([
    session.from("profiles").select("status").eq("id", auth.user.id).maybeSingle(),
    session.from("user_roles").select("role").eq("user_id", auth.user.id),
    session.from("school_memberships").select("school_id,status").eq("user_id", auth.user.id).eq("status", "active").limit(1),
  ]);
  const allowed = (roles ?? []).some(({ role }) => role === "admin" || role === "direction");
  if (profile?.status !== "active" || !allowed || !memberships?.[0]) return null;
  return { actorId: auth.user.id, schoolId: memberships[0].school_id, admin: createAdminClient() };
}
