import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page() { const client = await createClient(); const { data: auth } = await client.auth.getUser(); if (!auth.user) redirect("/"); const { data } = await client.from("user_roles").select("role").eq("user_id", auth.user.id); const roles = new Set((data ?? []).map((item) => item.role)); if (roles.has("direction") || roles.has("admin")) redirect("/admin/communications"); if (roles.has("teacher")) redirect("/teacher/messages"); if (roles.has("parent")) redirect("/family/messages"); redirect("/student/messages"); }
