"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button, Dialog, useToast } from "@/components/ui";
import { buildCanonicalLoginAlias } from "@/features/identity/domain/legacy-login";
import type { DatabaseAppRole } from "@/types/database";
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
    classIds: string;
    classId: string;
    teacherId: string;
  } & Record<string, string>;
  const [role, setRole] = useState<DatabaseAppRole>(defaultRole ?? "student");
  const [form, setForm] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    login: "",
    temporaryPassword: "",
    gender: "unspecified",
    monthlyAmount: "0",
    classIds: "",
    classId: "",
    teacherId: "",
  });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();
  const set = (key: string, value: string) =>
    setForm((row) => ({ ...row, [key]: value }));
  const availableClasses = data?.classes.filter((item) => item.status === "active") ?? [];
  const availableTeachers = data?.people.filter(
    (item) => item.role === "teacher" && item.status === "active",
  ) ?? [];
  const setName = (key: "firstName" | "lastName", value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (role === "student" && next.firstName.trim() && next.lastName.trim()) {
        next.login = buildCanonicalLoginAlias("student", next.firstName, next.lastName);
      }
      return next;
    });
  };
  const missing = accountMissingFields({ role, schoolId, form });
  async function submit() {
    if (!schoolId) return;
    setBusy(true);
    const prefix = role === "parent"
          ? "f"
          : role === "teacher"
            ? "t"
            : "a";
    const login = role === "student"
      ? buildCanonicalLoginAlias("student", form.firstName, form.lastName)
      : form.login.startsWith(`${prefix}_`)
      ? form.login
      : `${prefix}_${form.login}`;
    try {
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
        dossier: {
          firstName: form.firstName,
          lastName: form.lastName,
          gender: form.gender,
          phone: form.phone ?? "",
          email: form.email ?? "",
          monthlyAmount: form.monthlyAmount || "0",
          guardianName: form.guardianName ?? "",
          guardianFirstName: form.guardianFirstName ?? "",
          guardianLastName: form.guardianLastName ?? "",
          guardianPhone: form.guardianPhone ?? "",
          guardianSecondaryPhone: form.guardianSecondaryPhone ?? "",
          canLeaveAlone: form.canLeaveAlone === "true",
          dateOfBirth: form.dateOfBirth ?? "",
          identityDocumentReceived: form.identity === "true",
          birthCertificateReceived: form.birth === "true",
          guardianIdentityReceived: form.guardianIdentity === "true",
          accessibilityNotes: form.notes ?? "",
          classId: form.classId || undefined,
          classIds: form.classIds ? form.classIds.split(",") : [],
          teacherIds: form.teacherId ? [form.teacherId] : [],
        },
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        userId?: string;
        message?: string;
      } | null;
      if (!response.ok || !result?.userId) {
        showToast({ title: result?.message ?? "تعذر إنشاء الحساب", tone: "info" });
        return;
      }
      showToast({ title: "تم إنشاء الحساب والملف", tone: "success" });
      setOpen(false);
      setForm({ firstName: "", lastName: "", login: "", temporaryPassword: "", gender: "unspecified", monthlyAmount: "0", classIds: "", classId: "", teacherId: "" });
      router.refresh();
    } catch {
      showToast({ title: "تعذر الاتصال بالخدمة. حاول مرة أخرى.", tone: "info" });
    } finally {
      setBusy(false);
    }
  }
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
      open={open}
      onOpenChange={setOpen}
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
              onChange={(e) => setName("firstName", e.target.value)}
            />
          </label>
          <label>
            النسب
            <input
              value={form.lastName}
              onChange={(e) => setName("lastName", e.target.value)}
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
                  onChange={(e) => {
                    const classId = e.target.value;
                    const selectedClass = availableClasses.find((item) => item.id === classId);
                    setForm((current) => ({
                      ...current,
                      classId,
                      teacherId: selectedClass?.teacherId ?? "",
                    }));
                  }}
                >
                  <option value="">اختر القسم</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              الأستاذ المسؤول
              <select
                value={form.teacherId ?? ""}
                onChange={(e) => set("teacherId", e.target.value)}
              >
                <option value="">اختر الأستاذ</option>
                {availableTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-pair">
              <label>
                اسم الولي
                <input value={form.guardianFirstName ?? ""} onChange={(e) => set("guardianFirstName", e.target.value)} />
              </label>
              <label>
                نسب الولي
                <input value={form.guardianLastName ?? ""} onChange={(e) => set("guardianLastName", e.target.value)} />
              </label>
            </div>
            <div className="form-pair">
              <label>
                هاتف الولي
                <input dir="ltr" value={form.guardianPhone ?? ""} onChange={(e) => set("guardianPhone", e.target.value)} />
              </label>
              <label>
                هاتف ثانٍ
                <input dir="ltr" value={form.guardianSecondaryPhone ?? ""} onChange={(e) => set("guardianSecondaryPhone", e.target.value)} />
              </label>
            </div>
            <label className="toggle-line">
              <input type="checkbox" checked={form.canLeaveAlone === "true"} onChange={(e) => set("canLeaveAlone", String(e.target.checked))} />
              يسمح له بالعودة وحده بعد الحصة
            </label>
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
            {role === "student" ? "اسم الدخول (الاسم والنسب)" : "اسم الدخول"}
            <input
              dir="ltr"
              autoCapitalize="none"
              value={form.login}
              readOnly={role === "student"}
              onChange={(e) => set("login", e.target.value)}
            />
          </label>
          <label>
            كلمة مرور مؤقتة
            <input
              dir="ltr"
              type="password"
              minLength={6}
              value={form.temporaryPassword}
              onChange={(e) => set("temporaryPassword", e.target.value)}
            />
          </label>
        </div>
        {missing.length ? <p className="command-form__hint" role="status">{missing.join(" · ")}</p> : <p className="command-form__hint">يُربط الطالب تلقائيا بأستاذ القسم المختار.</p>}
        <Button
          loading={busy}
          disabled={busy || missing.length > 0}
          onClick={() => void submit()}
        >
          إنشاء الحساب والملف
        </Button>
      </div>
    </Dialog>
  );
}

function accountMissingFields({
  role,
  schoolId,
  form,
}: {
  role: DatabaseAppRole;
  schoolId: string | null;
  form: { firstName: string; lastName: string; login: string; temporaryPassword: string; classId: string; teacherId: string };
}) {
  const missing: string[] = [];
  if (!schoolId) missing.push("تعذر تحديد المؤسسة");
  if (!form.firstName.trim()) missing.push("أدخل الاسم");
  if (!form.lastName.trim()) missing.push("أدخل النسب");
  if (role !== "student" && form.login.trim().length < 2) missing.push("أدخل اسم الدخول");
  if (form.temporaryPassword.length < 6) missing.push("كلمة المرور 6 أحرف على الأقل");
  if (role === "student" && !form.classId) missing.push("اختر القسم");
  if (role === "student" && !form.teacherId) missing.push("اختر الأستاذ");
  return missing;
}
