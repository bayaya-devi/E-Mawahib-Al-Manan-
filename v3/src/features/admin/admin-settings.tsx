"use client";

import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import { TeacherSettings } from "@/features/teacher/teacher-settings";
import { createClient } from "@/lib/supabase/client";

export function AdminSettings({
  schoolId,
  initialThreshold,
  initialClassRankingNamesVisible,
}: {
  schoolId: string | null;
  initialThreshold: number;
  initialClassRankingNamesVisible: boolean;
}) {
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [namesVisible, setNamesVisible] = useState(initialClassRankingNamesVisible);
  const [busy, setBusy] = useState<"finance" | "ranking" | null>(null);
  const { showToast } = useToast();

  async function saveFinanceThreshold() {
    if (!schoolId) return;
    setBusy("finance");
    const result = await createClient().rpc("admin_set_finance_threshold", { target_school_id: schoolId, target_amount: Number(threshold) });
    setBusy(null);
    if (result.error) return showToast({ title: "تعذر حفظ العتبة", tone: "info" });
    showToast({ title: "تم حفظ عتبة التنبيه", tone: "success" });
  }

  async function saveClassRankingPrivacy() {
    if (!schoolId) return;
    setBusy("ranking");
    const result = await createClient().rpc("admin_set_student_class_ranking_names", { target_school_id: schoolId, target_names_visible: namesVisible });
    setBusy(null);
    if (result.error) return showToast({ title: "تعذر حفظ إعداد الترتيب", tone: "info" });
    showToast({ title: "تم حفظ إعداد الخصوصية", tone: "success" });
  }

  return (
    <div className="admin-settings">
      <TeacherSettings />
      <section className="settings-compact">
        <h2>تنبيه المالية</h2>
        <label>التنبيه عندما يقل الرصيد عن
          <input type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </label>
        <Button loading={busy === "finance"} disabled={Number(threshold) < 0 || busy !== null} onClick={() => void saveFinanceThreshold()}>حفظ</Button>
      </section>
      <section className="settings-compact">
        <h2>خصوصية ترتيب القسم</h2>
        <label className="toggle-line">
          <input type="checkbox" checked={namesVisible} onChange={(event) => setNamesVisible(event.target.checked)} />
          إظهار أسماء الطلاب في ترتيب النجوم
        </label>
        <p>عند الإيقاف، تظهر المراتب والنجوم فقط دون أسماء الطلاب.</p>
        <Button loading={busy === "ranking"} disabled={busy !== null} onClick={() => void saveClassRankingPrivacy()}>حفظ إعداد الخصوصية</Button>
      </section>
    </div>
  );
}
