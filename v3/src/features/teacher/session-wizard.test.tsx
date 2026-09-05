// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import type { TeacherSessionData } from "./models";
import { SessionWizard } from "./session-wizard";

const rpc = vi.fn(async (...args: [string, Record<string, unknown>]) => { void args; return { data: "run-1", error: null }; });
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => { cleanup(); rpc.mockClear(); });

describe("teacher session start", () => {
  it("starts an assigned class without requiring a pre-scheduled course", async () => {
    render(<ToastProvider><SessionWizard data={sessionData} /></ToastProvider>);
    const start = screen.getByRole("button", { name: /بدء الحصة/ });
    expect(start).not.toBeDisabled();
    fireEvent.click(start);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("teacher_start_class_session", { target_class_id: "class-1" }));
    expect(await screen.findByRole("heading", { name: "اختر الطلاب الحاضرين" })).toBeTruthy();
  });

  it("keeps every class student freely selectable after attendance and after recording", async () => {
    render(<ToastProvider><SessionWizard data={multiStudentSessionData} /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: /تأكيد الحضور/ }));
    const studentSelect = await screen.findByLabelText("الطالب") as HTMLSelectElement;
    const options = [...studentSelect.options];
    expect(options.map(({ value }) => value)).toEqual(["present", "absent", "late", "worked", "new"]);
    expect(options.every(({ disabled }) => !disabled)).toBe(true);

    fireEvent.change(studentSelect, { target: { value: "absent" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعلم" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("teacher_record_student_work", expect.objectContaining({ target_student_id: "absent" })));
    expect((screen.getByLabelText("الطالب") as HTMLSelectElement).value).toBe("absent");
    expect(screen.queryByRole("button", { name: /الطالب التالي/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "حفظ التعلم" }));
    await waitFor(() => expect(rpc.mock.calls.filter(([name, payload]) => name === "teacher_record_student_work" && payload.target_student_id === "absent")).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("الطالب"), { target: { value: "worked" } });
    expect((screen.getByLabelText("الطالب") as HTMLSelectElement).value).toBe("worked");
  });
});

const sessionData: TeacherSessionData = {
  teacher: { id: "teacher-1", name: "أحمد" },
  classes: [{ id: "class-1", name: "القسم الأول", level: null, studentCount: 1 }],
  students: [{ id: "student-1", name: "ياسين", classId: "class-1", className: "القسم الأول", lastSurahNumber: null, lastProgressPercent: 0, absenceCount: 0, lateCount: 0, pendingAssignments: 0, suggestion: "متابعة المسار المعتاد", masteredSurahs: [], attendanceHistory: [], recitations: [], notes: [], assignments: [] }],
  schedule: [], nextCourse: null, openRun: null, messages: [], requests: [], alerts: [], assignmentReminders: [], taskCount: 0,
  attendance: [], openReportId: null, elapsedSeconds: 0, defaultDueDate: "2026-09-12",
};

const multiStudentSessionData: TeacherSessionData = {
  ...sessionData,
  students: [student("present"), student("absent"), student("late"), student("worked"), student("new")],
  openRun: { id: "run-1", courseSessionId: "course-1", classId: "class-1", status: "in_progress", startedAt: "2026-09-05T10:00:00.000Z" },
  attendance: [
    { studentId: "present", status: "present", minutesLate: 0, processed: false },
    { studentId: "absent", status: "absent", minutesLate: 0, processed: false },
    { studentId: "late", status: "late", minutesLate: 8, processed: false },
    { studentId: "worked", status: "present", minutesLate: 0, processed: true },
    { studentId: "new", status: "absent", minutesLate: 0, processed: false },
  ],
};

function student(id: string): TeacherSessionData["students"][number] {
  return { ...sessionData.students[0]!, id, name: id };
}
