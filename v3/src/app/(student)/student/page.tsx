import type { Metadata } from "next";
import { AppShell, ShellPage } from "@/components/shell";

export const metadata: Metadata = { title: "مساحة الطالب" };
export default function StudentPage() { return <AppShell kind="student"><ShellPage kind="student" /></AppShell>; }
