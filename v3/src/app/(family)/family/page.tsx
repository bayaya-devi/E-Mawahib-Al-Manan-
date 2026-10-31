import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { FamilyDashboard } from "@/features/learning/family-dashboard";
import { getFamilyChild, getFamilyChildren } from "@/features/learning/repository";

export const metadata: Metadata = { title: "مساحة الأسرة" };
export const dynamic = "force-dynamic";
export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const children = await getFamilyChildren();
  const requested = (await searchParams).child;
  const selected = children.some(({ id }) => id === requested) ? requested : children[0]?.id;
  const data = selected ? await getFamilyChild(selected) : null;
  return <AppShell kind="family"><FamilyDashboard accounts={children} data={data} /></AppShell>;
}
