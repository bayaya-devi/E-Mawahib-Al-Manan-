import type { DatabaseAttendanceStatus, DatabaseRecitationAppreciation, DatabaseTeacherRequestKind, DatabaseTeacherSessionStatus, DatabaseWorkflowStatus } from "@/types/database";

export type TeacherClass = { id: string; name: string; level: string | null; studentCount: number };
export type TeacherCourse = { id: string; classId: string; className: string; title: string; startsAt: string; endsAt: string; location: string | null; status: string };
export type TeacherStudent = {
  id: string; name: string; classId: string; className: string;
  lastSurahNumber: number | null; lastProgressPercent: number;
  absenceCount: number; lateCount: number; pendingAssignments: number;
  suggestion: string;
  masteredSurahs: Array<{ surahNumber: number; masteredAt: string | null }>;
  attendanceHistory: Array<{ id: string; status: DatabaseAttendanceStatus; minutesLate: number; recordedAt: string }>;
  recitations: Array<{ id: string; surahNumber: number; verseFrom: number; verseTo: number; appreciation: DatabaseRecitationAppreciation; comment: string | null; recordedAt: string }>;
  notes: Array<{ id: string; content: string; teacherName: string; createdAt: string }>;
  assignments: Array<{ id: string; surahNumber: number | null; verseFrom: number | null; verseTo: number | null; dueAt: string | null; status: string }>;
};
export type TeacherAssignmentReminder = { id: string; studentId: string; studentName: string; surahNumber: number | null; verseFrom: number | null; verseTo: number | null; dueAt: string };
export type TeacherMessage = { id: string; subject: string; body: string; senderId: string; read: boolean; createdAt: string };
export type TeacherRequest = { id: string; kind: DatabaseTeacherRequestKind; title: string; details: string | null; status: DatabaseWorkflowStatus; startsOn: string | null; endsOn: string | null; adminResponse: string | null; submittedAt: string };
export type TeacherAlert = { id: string; title: string; body: string; read: boolean; createdAt: string };
export type TeacherOpenRun = { id: string; courseSessionId: string; classId: string; status: DatabaseTeacherSessionStatus; startedAt: string };

export type TeacherHomeData = {
  teacher: { id: string; name: string } | null;
  classes: TeacherClass[];
  students: TeacherStudent[];
  schedule: TeacherCourse[];
  nextCourse: TeacherCourse | null;
  openRun: TeacherOpenRun | null;
  messages: TeacherMessage[];
  requests: TeacherRequest[];
  alerts: TeacherAlert[];
  assignmentReminders: TeacherAssignmentReminder[];
  taskCount: number;
};

export type SessionAttendance = { studentId: string; status: DatabaseAttendanceStatus; minutesLate: number; processed: boolean };
export type TeacherSessionData = TeacherHomeData & { attendance: SessionAttendance[]; openReportId: string | null; elapsedSeconds: number; defaultDueDate: string };

export type TeacherProfessionalData = {
  teacher: { id: string; name: string } | null;
  schedule: TeacherCourse[];
  requests: TeacherRequest[];
  salaries: Array<{ id: string; month: string; gross: number; deductions: number; net: number; currency: string; status: string; paidAt: string | null }>;
  documents: Array<{ id: string; title: string; category: string; storagePath: string; visibleFrom: string }>;
  reports: Array<{ id: string; runId: string; status: string; submittedAt: string | null; present: number; absent: number; late: number }>;
};
