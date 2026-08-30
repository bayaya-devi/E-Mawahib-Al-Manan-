import type { Metadata } from "next";
import { AppShell, ShellPage } from "@/components/shell";

export const metadata: Metadata = { title: "مساحة الأسرة" };
export default function FamilyPage() { return <AppShell kind="family"><ShellPage kind="family" /></AppShell>; }
