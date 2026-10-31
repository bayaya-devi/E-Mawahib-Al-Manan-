// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { TeacherStudentsWorkspace } from "./students-workspace";

const refresh = vi.fn();
const rpc = vi.fn(async (name: string) => {
  if (name === "teacher_search_enrollment_candidates") return { data: [{ student_id: "student-2", display_name: "أمين العلوي", student_number: "S-2", active_class_id: null, active_class_name: null }], error: null };
  return { data: "record-1", error: null };
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }) }));

afterEach(() => { cleanup(); rpc.mockClear(); refresh.mockClear(); });

describe("teacher student enrollment", () => {
  it("searches and enrolls an existing same-school student", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "إضافة طالب" }));
    fireEvent.change(screen.getByLabelText("البحث عن طالب موجود"), { target: { value: "أمين" } });
    fireEvent.click(screen.getByRole("button", { name: "بحث" }));
    expect(await screen.findByText("أمين العلوي")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "إضافة" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("teacher_enroll_existing_student", { target_class_id: "class-1", target_student_id: "student-2" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("submits a dossier without collecting login credentials", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "إضافة طالب" }));
    fireEvent.click(screen.getByRole("button", { name: "ملف جديد" }));
    fireEvent.change(screen.getByLabelText("اسم الطالب"), { target: { value: "مريم" } });
    fireEvent.change(screen.getByLabelText("نسب الطالب"), { target: { value: "الإدريسي" } });
    fireEvent.change(screen.getByLabelText("اسم المسؤول القانوني"), { target: { value: "فاطمة الإدريسي" } });
    fireEvent.change(screen.getByLabelText("هاتف المسؤول القانوني"), { target: { value: "0612345678" } });
    expect(screen.queryByLabelText(/كلمة المرور/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إرسال ملف التسجيل" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("teacher_submit_student_enrollment_dossier", expect.objectContaining({ target_class_id: "class-1", target_first_name: "مريم", target_last_name: "الإدريسي", target_guardian_phone: "0612345678" })));
    expect(refresh).toHaveBeenCalled();
  });
});

function renderWorkspace() {
  render(<ToastProvider><TeacherStudentsWorkspace students={[]} classes={[{ id: "class-1", name: "القسم الأول", level: "مبتدئ", studentCount: 1 }]} enrollmentDossiers={[]} /></ToastProvider>);
}
