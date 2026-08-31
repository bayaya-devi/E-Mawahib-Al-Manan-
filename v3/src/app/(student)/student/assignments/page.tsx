import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { AssignmentWorkspace } from "@/features/learning/assignment-workspace";
import { getStudentDashboard } from "@/features/learning/repository";

export const metadata: Metadata = { title: "الواجبات" };
export const dynamic = "force-dynamic";
export default async function AssignmentsPage() {
  const data = await getStudentDashboard();
  return <AppShell kind="student"><div className="learning-page"><header className="simple-page-head"><span>متابعة واضحة</span><h1>الواجبات</h1><p>المطلوب، الجاري، المسلّم والمصحح في مكان واحد.</p></header><AssignmentWorkspace initialAssignments={data.assignments} /></div></AppShell>;
}
