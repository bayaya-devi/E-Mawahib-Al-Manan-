"use client";
import { useState } from "react";
import { Button, Dialog, useToast } from "@/components/ui";
import type { DatabaseAccountStatus } from "@/types/database";

export function AccountStatusControls({ userId, schoolId, status }: { userId: string; schoolId: string | null; status: DatabaseAccountStatus }) { const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const { showToast } = useToast();
  async function change(target: DatabaseAccountStatus): Promise<void> { if (!schoolId) return; setBusy(true); const response = await fetch(`/api/admin/accounts/${userId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: target, suspensionReason: target === "suspended" ? reason : null, schoolId }) }); setBusy(false); if (!response.ok) { showToast({ title: "تعذر تحديث الحساب", tone: "info" }); return; } showToast({ title: "تم تحديث حالة الحساب", tone: "success" }); window.location.reload(); }
  if (status === "suspended") return <Button loading={busy} onClick={() => void change("active")}>إعادة تفعيل الحساب</Button>;
  return <Dialog trigger={<Button variant="danger">إيقاف الحساب</Button>} title="إيقاف الحساب" description="لن يتمكن المستخدم من الدخول حتى إعادة التفعيل."><div className="command-form"><label>سبب الإيقاف<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label><Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => void change("suspended")}>تأكيد الإيقاف</Button></div></Dialog>;
}
