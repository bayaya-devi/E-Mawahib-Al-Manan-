import { Card, EmptyState } from "@/components/ui";
import { ClipboardCheck } from "lucide-react";
import type { AdminCommandData } from "./models";

export function ParentFeedbackList({ items }: { items: AdminCommandData["parentFeedback"] }) {
  return <section className="admin-parent-feedback"><header><div><span>متابعة الأسر</span><h2>استبيانات الوالدين</h2></div><strong>{items.length}</strong></header>{items.length ? <div className="admin-feedback-list">{items.map((item) => <Card key={item.id}><div><strong>{item.studentName}</strong><time>{new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(item.createdAt))}</time></div><p>{item.scores.map((score) => `${score}/10`).join(" · ")}</p>{item.comment ? <small>{item.comment}</small> : null}</Card>)}</div> : <EmptyState title="لا توجد استبيانات" description="ستظهر هنا بعد إرسالها من مساحة الوالدين." icon={ClipboardCheck} />}</section>;
}
