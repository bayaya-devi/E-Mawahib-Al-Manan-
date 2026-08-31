"use client";

import { useState } from "react";
import { ClipboardCheck, Send } from "lucide-react";
import { Button, EmptyState, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { StudentDashboardData } from "./models";

export function AssignmentWorkspace({ initialAssignments }: { initialAssignments: StudentDashboardData["assignments"] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { showToast } = useToast();
  if (!assignments.length) return <EmptyState title="لا توجد واجبات" description="ستظهر واجبات الأستاذ هنا فور إرسالها." />;

  async function update(id: string, status: "in_progress" | "submitted"): Promise<void> {
    setSaving(id);
    const { error } = await createClient().rpc("update_own_assignment", { target_assignment_id: id, target_status: status, target_response: responses[id] ?? null });
    setSaving(null);
    if (error) { showToast({ title: "تعذر تحديث الواجب", description: "تحقق من الاتصال ثم حاول مرة أخرى." }); return; }
    setAssignments((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    showToast({ title: status === "submitted" ? "تم تسليم الواجب" : "تم بدء الواجب", tone: "success" });
  }

  return <div className="assignment-list">{assignments.map((item) => <article key={item.id}>
    <ClipboardCheck size={22} />
    <div><strong>{item.title}</strong><p>{item.instructions ?? "لا توجد تعليمات إضافية"}</p>{item.status !== "corrected" ? <textarea aria-label={`ملاحظة الواجب ${item.title}`} value={responses[item.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="ملاحظة قصيرة عند الحاجة" rows={2} /> : null}<div className="assignment-actions">{item.status === "todo" ? <Button variant="secondary" loading={saving === item.id} onClick={() => void update(item.id, "in_progress")}>بدء الواجب</Button> : null}{item.status === "in_progress" ? <Button loading={saving === item.id} onClick={() => void update(item.id, "submitted")}><Send size={17} />تسليم</Button> : null}</div></div>
    <span>{({ todo: "مطلوب", in_progress: "قيد الإنجاز", submitted: "تم التسليم", corrected: "تم التصحيح" })[item.status]}</span>
  </article>)}</div>;
}

