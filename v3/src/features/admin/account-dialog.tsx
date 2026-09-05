"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button, Dialog, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseAppRole, Json } from "@/types/database";
import type { AdminCommandData } from "./models";

export function AccountDialog({
  schoolId,
  defaultRole,
  data,
}: {
  schoolId: string | null;
  defaultRole?: "student" | "teacher";
  data?: AdminCommandData;
}) {
  type AccountForm = {
    firstName: string;
    lastName: string;
    login: string;
    temporaryPassword: string;
    gender: string;
    monthlyAmount: string;
    teacherIds: string;
    classIds: string;
  } & Record<string, string>;
  const [role, setRole] = useState<DatabaseAppRole>(defaultRole ?? "student");
  const [form, setForm] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    login: "",
    temporaryPassword: "",
    gender: "unspecified",
    monthlyAmount: "0",
    teacherIds: "",
    classIds: "",
  });
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const set = (key: string, value: string) =>
    setForm((row) => ({ ...row, [key]: value }));
  async function submit() {
    if (!schoolId) return;
    setBusy(true);
    const prefix =
      role === "student"
        ? "s"
        : role === "parent"
          ? "f"
          : role === "teacher"
            ? "t"
            : "a";
    const login = form.login.startsWith(`${prefix}_`)
      ? form.login
      : `${prefix}_${form.login}`;
    const response = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login,
        temporaryPassword: form.temporaryPassword,
        firstName: form.firstName,
        lastName: form.lastName,
        roles: [role],
        schoolId,
        locale: "ar",
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      userId?: string;
    } | null;
    if (!response.ok || !result?.userId) {
      setBusy(false);
      showToast({ title: "تعذر إنشاء الحساب", tone: "info" });
      return;
    }
    const payload: Json = {
      first_name: form.firstName,
      last_name: form.lastName,
      gender: form.gender,
      phone: form.phone ?? "",
      email: form.email ?? "",
      monthly_salary: form.monthlyAmount || "0",
      monthly_fee: form.monthlyAmount || "0",
      guardian_name: form.guardianName ?? "",
      guardian_phone: form.guardianPhone ?? "",
      date_of_birth: form.dateOfBirth ?? "",
      identity_document_received: form.identity === "true",
      birth_certificate_received: form.birth === "true",
      guardian_identity_received: form.guardianIdentity === "true",
      accessibility_notes: form.notes ?? "",
    };
    const profile = await createClient().rpc("admin_update_person", {
      target_user_id: result.userId,
      payload,
    });
    if (!profile.error && role === "student" && form.classId)
      await createClient().rpc("admin_set_student_relations", {
        target_student_id: result.userId,
        target_class_id: form.classId,
        target_teacher_ids: form.teacherIds ? form.teacherIds.split(",") : [],
      });
    if (!profile.error && role === "teacher")
      await createClient().rpc("admin_set_teacher_classes", {
        target_teacher_id: result.userId,
        target_class_ids: form.classIds ? form.classIds.split(",") : [],
      });
    setBusy(false);
    if (profile.error) {
      showToast({ title: "أُنشئ الحساب وتعذر إكمال الملف", tone: "info" });
      return;
    }
    showToast({ title: "تم إنشاء الحساب والملف", tone: "success" });
    window.location.reload();
  }
  const teachers =
    data?.people.filter((p) => p.role === "teacher" && p.status === "active") ??
    [];
  return (
    <Dialog
      trigger={
        <Button>
          <UserPlus size={18} />
          {role === "teacher" ? "إضافة أستاذ" : "إضافة طالب"}
        </Button>
      }
      title={role === "teacher" ? "إضافة أستاذ" : "إضافة طالب"}
      description="الهوية والملف وحساب الدخول في مسار واحد."
    >
      <div className="command-form">
        {!defaultRole ? (
          <label>
            نوع الحساب
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as DatabaseAppRole)}
            >
              <option value="student">طالب</option>
              <option value="parent">ولي أمر</option>
              <option value="teacher">أستاذ</option>
              <option value="admin">موظف إداري</option>
            </select>
          </label>
        ) : null}
        <div className="form-pair">
          <label>
            الاسم
            <input
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </label>
          <label>
            النسب
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </label>
        </div>
        {role === "student" || role === "teacher" ? (
          <>
            <label>
              الجنس
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="unspecified">غير محدد</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </label>
            <label>
              {role === "teacher"
                ? "الأجر الشهري المتفق عليه"
                : "الواجب الشهري المتفق عليه"}
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyAmount}
                onChange={(e) => set("monthlyAmount", e.target.value)}
              />
            </label>
          </>
        ) : null}
        {role === "teacher" ? (
          <>
            <div className="form-pair">
              <label>
                الهاتف
                <input
                  dir="ltr"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </label>
              <label>
                البريد الإلكتروني
                <input
                  dir="ltr"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </label>
            </div>
            <fieldset className="admin-checks">
              <legend>الأقسام المكلف بها</legend>
              {data?.classes.map((classRow) => {
                const ids = form.classIds.split(",").filter(Boolean);
                return (
                  <label key={classRow.id}>
                    <input
                      type="checkbox"
                      checked={ids.includes(classRow.id)}
                      onChange={(e) =>
                        set(
                          "classIds",
                          (e.target.checked
                            ? [...ids, classRow.id]
                            : ids.filter((id) => id !== classRow.id)
                          ).join(","),
                        )
                      }
                    />
                    {classRow.name}
                  </label>
                );
              })}
            </fieldset>
          </>
        ) : null}
        {role === "student" ? (
          <>
            <div className="form-pair">
              <label>
                تاريخ الميلاد
                <input
                  type="date"
                  value={form.dateOfBirth ?? ""}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </label>
              <label>
                القسم
                <select
                  value={form.classId ?? ""}
                  onChange={(e) => set("classId", e.target.value)}
                >
                  <option value="">اختر القسم</option>
                  {data?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              المسؤول أو الولي
              <input
                value={form.guardianName ?? ""}
                onChange={(e) => set("guardianName", e.target.value)}
              />
            </label>
            <label>
              هاتف المسؤول
              <input
                dir="ltr"
                value={form.guardianPhone ?? ""}
                onChange={(e) => set("guardianPhone", e.target.value)}
              />
            </label>
            <fieldset className="admin-checks">
              <legend>الأساتذة المكلفون</legend>
              {teachers.map((teacher) => (
                <label key={teacher.id}>
                  <input
                    type="checkbox"
                    checked={(form.teacherIds ?? "")
                      .split(",")
                      .includes(teacher.id)}
                    onChange={(e) => {
                      const ids = (form.teacherIds ?? "")
                        .split(",")
                        .filter(Boolean);
                      set(
                        "teacherIds",
                        (e.target.checked
                          ? [...ids, teacher.id]
                          : ids.filter((id) => id !== teacher.id)
                        ).join(","),
                      );
                    }}
                  />
                  {teacher.name}
                </label>
              ))}
            </fieldset>
            <fieldset className="admin-checks">
              <legend>وثائق التسجيل</legend>
              {(
                [
                  ["birth", "عقد الازدياد"],
                  ["guardianIdentity", "بطاقة هوية الولي"],
                  ["identity", "وثيقة الهوية"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={form[key] === "true"}
                    onChange={(e) => set(key, String(e.target.checked))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              خصوصية أو تيسير مطلوب
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
          </>
        ) : null}
        <div className="form-pair">
          <label>
            اسم الدخول
            <input
              dir="ltr"
              autoCapitalize="none"
              value={form.login}
              onChange={(e) => set("login", e.target.value)}
            />
          </label>
          <label>
            كلمة مرور مؤقتة
            <input
              dir="ltr"
              type="password"
              value={form.temporaryPassword}
              onChange={(e) => set("temporaryPassword", e.target.value)}
            />
          </label>
        </div>
        <Button
          loading={busy}
          disabled={
            !schoolId ||
            form.firstName.trim().length < 1 ||
            form.lastName.trim().length < 1 ||
            form.login.trim().length < 2 ||
            form.temporaryPassword.length < 10
          }
          onClick={() => void submit()}
        >
          إنشاء الحساب والملف
        </Button>
      </div>
    </Dialog>
  );
}
