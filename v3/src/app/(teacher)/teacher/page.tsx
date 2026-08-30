import type { Metadata } from "next";
import { AppShell, ShellPage } from "@/components/shell";

export const metadata: Metadata = { title: "مساحة المعلّم" };
export default function TeacherPage() { return <AppShell kind="teacher"><ShellPage kind="teacher" /></AppShell>; }
