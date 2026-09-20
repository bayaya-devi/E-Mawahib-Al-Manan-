"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Dialog, useToast } from "@/components/ui";
import type { DatabaseAccountStatus } from "@/types/database";

export function AccountStatusControls({ userId, schoolId, status }: { userId: string; schoolId: string | null; status: DatabaseAccountStatus }) {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  async function change(target: DatabaseAccountStatus): Promise<void> {
    if (!schoolId || busy) return;
    setBusy(true);
    const response = await fetch(`/api/admin/accounts/${userId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, suspensionReason: target === "suspended" ? reason : null, schoolId }) });
    setBusy(false);
    if (!response.ok) return showToast({ title: "تعذر تحديث الحساب", tone: "info" });
    showToast({ title: "تم تحديث حالة الحساب", tone: "success" });
    router.refresh();
  }

  async function permanentlyDelete(): Promise<void> {
    if (busy || confirmation.trim() !== "حذف") return;
    setBusy(true);
    const response = await fetch(`/api/admin/accounts/${userId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) return showToast({ title: result?.message ?? "تعذر حذف الحساب", tone: "info" });
    showToast({ title: "تم حذف الحساب نهائيا", tone: "success" });
    router.push("/admin/people");
    router.refresh();
  }

  const deletion = <Dialog trigger={<Button variant="danger">حذف نهائي</Button>} title="حذف الحساب نهائيا" description="هذا الإجراء لا يمكن التراجع عنه. الحسابات ذات السجل التعليمي أو المالي تُؤرشف حفاظا على التاريخ.">
    <div className="command-form">
      <label>اكتب «حذف» للتأكيد<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <Button variant="danger" loading={busy} disabled={confirmation.trim() !== "حذف"} onClick={() => void permanentlyDelete()}>حذف الحساب نهائيا</Button>
    </div>
  </Dialog>;

  if (status === "suspended" || status === "archived") {
    return <div className="person-status-actions"><Button loading={busy} onClick={() => void change("active")}>إعادة تفعيل الحساب</Button>{deletion}</div>;
  }
  return <div className="person-status-actions">
    <Dialog trigger={<Button variant="danger">إيقاف الحساب</Button>} title="إيقاف الحساب" description="لن يتمكن المستخدم من الدخول حتى إعادة التفعيل.">
      <div className="command-form"><label>سبب الإيقاف<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label><Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => void change("suspended")}>تأكيد الإيقاف</Button></div>
    </Dialog>
    <Dialog trigger={<Button variant="quiet">أرشفة</Button>} title="أرشفة الحساب" description="يبقى كل التاريخ محفوظا ويمكن إعادة التفعيل لاحقا."><Button variant="danger" loading={busy} onClick={() => void change("archived")}>تأكيد الأرشفة</Button></Dialog>
    {deletion}
  </div>;
}
