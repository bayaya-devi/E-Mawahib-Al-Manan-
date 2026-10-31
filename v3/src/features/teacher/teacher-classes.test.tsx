// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeacherClasses } from "./teacher-classes";
import type { TeacherHomeData } from "./models";

afterEach(cleanup);

describe("teacher classes", () => {
  it("shows only assigned class data with roster and session links", () => {
    render(<TeacherClasses data={{ ...emptyHome, classes: [{ id: "class-1", name: "قسم النور", level: "المستوى الأول", studentCount: 18 }], recurringSchedule: [{ id: "slot-1", classId: "class-1", className: "قسم النور", dayOfWeek: 1, startsAt: "09:00:00", endsAt: "10:00:00", room: "قاعة 2" }] }} />);
    expect(screen.getByRole("heading", { name: "قسم النور" })).toBeVisible();
    expect(screen.getByText(/الإثنين 09:00–10:00/)).toBeVisible();
    expect(screen.getByRole("link", { name: "عرض الطلاب" })).toHaveAttribute("href", "/teacher/students?class=class-1");
    expect(screen.getByRole("link", { name: "بدء حصة" })).toHaveAttribute("href", "/teacher/session?class=class-1");
  });
});

const emptyHome: TeacherHomeData = { teacher: { id: "teacher-1", name: "سميرة", gender: "female" }, classes: [], students: [], schedule: [], nextCourse: null, openRun: null, messages: [], requests: [], alerts: [], enrollmentDossiers: [], assignmentReminders: [], taskCount: 0 };
