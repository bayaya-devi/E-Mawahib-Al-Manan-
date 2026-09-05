// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import type { TeacherSessionData } from "./models";
import { SessionWizard } from "./session-wizard";

const rpc = vi.fn(async () => ({ data: "run-1", error: null }));
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
});

const sessionData: TeacherSessionData = {
  teacher: { id: "teacher-1", name: "أحمد" },
  classes: [{ id: "class-1", name: "القسم الأول", level: null, studentCount: 1 }],
  students: [{ id: "student-1", name: "ياسين", classId: "class-1", className: "القسم الأول", lastSurahNumber: null, lastProgressPercent: 0, absenceCount: 0, lateCount: 0, pendingAssignments: 0, suggestion: "متابعة المسار المعتاد", masteredSurahs: [], attendanceHistory: [], recitations: [], notes: [], assignments: [] }],
  schedule: [], nextCourse: null, openRun: null, messages: [], requests: [], alerts: [], assignmentReminders: [], taskCount: 0,
  attendance: [], openReportId: null, elapsedSeconds: 0, defaultDueDate: "2026-09-12",
};
