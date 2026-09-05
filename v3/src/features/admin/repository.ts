import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability/logger";
import type { AdminCommandData, CommandPerson, CommandTask, DirectionInsight } from "./models";

const empty: AdminCommandData = { school: null, metrics: [], tasks: [], insights: [], people: [], classes: [], timeline: [], reports: [], requests: [], incidents: [], inventory: [], finance: [], salaries: [], years: [], rooms: [], events: [], announcements: [], audit: [], parentFeedback: [] };

export async function getAdminCommandData(): Promise<AdminCommandData> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return empty;
  try {
    const client = await createClient(); const { data: auth } = await client.auth.getUser(); if (!auth.user) return empty;
    const memberships = await client.from("school_memberships").select("school_id").eq("user_id", auth.user.id).eq("status", "active").limit(1);
    const schoolId = memberships.data?.[0]?.school_id; if (!schoolId) return empty;
    const schoolResult = await client.from("schools").select("id,name").eq("id", schoolId).maybeSingle();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1).toISOString().slice(0, 10);
    const [profiles, roles, schoolMembers, studentProfiles, teacherProfiles, enrollments, assignments, classRows, sessions, attendance, runs, reports, requests, incidents, tasks, inventory, finance, salaries, years, rooms, events, announcements, progress, learningEvents, audit, parentFeedback] = await Promise.all([
      client.from("profiles").select("id,display_name,status").order("display_name"),
      client.from("user_roles").select("user_id,role"), client.from("school_memberships").select("user_id").eq("school_id", schoolId).eq("status", "active"),
      client.from("student_profiles").select("user_id,date_of_birth"), client.from("teacher_profiles").select("user_id"),
      client.from("class_enrollments").select("class_id,student_id,status").eq("status", "active"), client.from("class_teacher_assignments").select("class_id,teacher_id,status").eq("status", "active"),
      client.from("classes").select("id,name,level,capacity,status").eq("school_id", schoolId),
      client.from("course_sessions").select("id,class_id,teacher_id,starts_at,ends_at,status").gte("starts_at", dayStart.toISOString()).lt("starts_at", dayEnd.toISOString()),
      client.from("attendance_records").select("session_id,student_id,status,minutes_late,recorded_at").gte("recorded_at", dayStart.toISOString()).lt("recorded_at", dayEnd.toISOString()),
      client.from("teacher_session_runs").select("id,course_session_id,teacher_id,class_id,status,started_at").gte("started_at", dayStart.toISOString()).lt("started_at", dayEnd.toISOString()),
      client.from("teacher_session_reports").select("id,teacher_id,class_id,status,incident,submitted_at,created_at").order("created_at", { ascending: false }).limit(100),
      client.from("teacher_requests").select("id,teacher_id,kind,title,status,submitted_at").eq("school_id", schoolId).order("submitted_at", { ascending: false }).limit(100),
      client.from("school_incidents").select("id,category,severity,summary,status,occurred_at").eq("school_id", schoolId).order("occurred_at", { ascending: false }).limit(100),
      client.from("admin_tasks").select("id,kind,priority,title,reason,status,href,created_at").eq("school_id", schoolId).in("status", ["open", "in_progress"]).order("priority", { ascending: false }),
      client.from("inventory_items").select("id,name,category,quantity,minimum_quantity,status").eq("school_id", schoolId).order("name"),
      client.from("finance_transactions").select("id,direction,category,amount,currency,occurred_on").eq("school_id", schoolId).order("occurred_on", { ascending: false }).limit(100),
      client.from("teacher_salary_records").select("id,teacher_id,period_month,net_amount,status").eq("school_id", schoolId).order("period_month", { ascending: false }).limit(100),
      client.from("academic_years").select("id,name,starts_on,ends_on,active").eq("school_id", schoolId).order("starts_on", { ascending: false }),
      client.from("school_rooms").select("id,name,capacity,active").eq("school_id", schoolId).order("name"),
      client.from("school_events").select("id,title,starts_at").eq("school_id", schoolId).order("starts_at", { ascending: false }).limit(100),
      client.from("school_announcements").select("id,title,audience,published_at").eq("school_id", schoolId).order("published_at", { ascending: false }).limit(100),
      client.from("student_surah_progress").select("student_id,status,last_activity_at"), client.from("learning_events").select("id,student_id,event_kind,surah_number,occurred_at").order("occurred_at", { ascending: false }).limit(150),
      client.from("audit_logs").select("id,action,entity_type,occurred_at").eq("school_id", schoolId).order("occurred_at", { ascending: false }).limit(150),
      client.from("parent_feedback").select("id,student_id,scores,comment,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    const memberIds = new Set((schoolMembers.data ?? []).map(({ user_id }) => user_id)); const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
    const roleMap = new Map((roles.data ?? []).filter(({ user_id }) => memberIds.has(user_id)).map((row) => [row.user_id, row.role]));
    const classNames = new Map((classRows.data ?? []).map((row) => [row.id, row.name])); const enrollmentByStudent = new Map((enrollments.data ?? []).map((row) => [row.student_id, row.class_id]));
    const absences = countBy((attendance.data ?? []).filter(({ status }) => status === "absent").map(({ student_id }) => student_id)); const late = countBy((attendance.data ?? []).filter(({ status }) => status === "late").map(({ student_id }) => student_id));
    const mastered = countBy((progress.data ?? []).filter(({ status }) => status === "mastered").map(({ student_id }) => student_id)); const latest = new Map<string, string>(); for (const row of progress.data ?? []) if (row.last_activity_at && (!latest.get(row.student_id) || row.last_activity_at > latest.get(row.student_id)!)) latest.set(row.student_id, row.last_activity_at);
    const people: CommandPerson[] = (profiles.data ?? []).filter(({ id }) => memberIds.has(id) && roleMap.has(id)).map((row) => ({ id: row.id, name: row.display_name, role: roleMap.get(row.id)!, status: row.status, className: classNames.get(enrollmentByStudent.get(row.id) ?? "") ?? null, age: ageFrom((studentProfiles.data ?? []).find(({ user_id }) => user_id === row.id)?.date_of_birth ?? null), absences: absences.get(row.id) ?? 0, late: late.get(row.id) ?? 0, mastered: mastered.get(row.id) ?? 0, lastActivity: latest.get(row.id) ?? null }));
    const classStudentCounts = countBy((enrollments.data ?? []).map(({ class_id }) => class_id)); const classTeacherCounts = countBy((assignments.data ?? []).map(({ class_id }) => class_id));
    const classes = (classRows.data ?? []).map((row) => ({ id: row.id, name: row.name, level: row.level, capacity: row.capacity, students: classStudentCounts.get(row.id) ?? 0, teachers: classTeacherCounts.get(row.id) ?? 0 }));
    const attendanceRows = attendance.data ?? []; const sessionRows = sessions.data ?? []; const runRows = runs.data ?? []; const reportRows = reports.data ?? [];
    const todayReports = reportRows.filter(({ submitted_at }) => submitted_at && submitted_at >= dayStart.toISOString() && submitted_at < dayEnd.toISOString()); const expected = sessionRows.reduce((sum, row) => sum + (classStudentCounts.get(row.class_id) ?? 0), 0);
    const missingReports = sessionRows.filter((session) => new Date(session.ends_at) < new Date() && !reportRows.some(({ class_id, created_at }) => class_id === session.class_id && created_at >= dayStart.toISOString())).length;
    const teacherIds = (teacherProfiles.data ?? []).map(({ user_id }) => user_id).filter((id) => memberIds.has(id)); const presentTeachers = new Set(runRows.map(({ teacher_id }) => teacher_id));
    const pendingRequests = (requests.data ?? []).filter(({ status }) => ["submitted", "seen", "in_review"].includes(status)); const openIncidents = (incidents.data ?? []).filter(({ status }) => ["open", "in_review"].includes(status));
    const missingSalary = teacherIds.filter((id) => !(salaries.data ?? []).some((row) => row.teacher_id === id && row.period_month === monthStart));
    const taskQueue: CommandTask[] = [
      ...(tasks.data ?? []).map((row) => ({ id: row.id, source: "task" as const, title: row.title, reason: row.reason, priority: row.priority, status: row.status, href: row.href ?? "/admin" })),
      ...pendingRequests.map((row) => ({ id: row.id, source: "request" as const, title: row.title, reason: `طلب ${row.kind} ينتظر المعالجة منذ ${daysAgo(row.submitted_at)} يوم`, priority: daysAgo(row.submitted_at) > 7 ? 4 : 2, status: row.status, href: "/admin/workforce" })),
      ...openIncidents.map((row) => ({ id: row.id, source: "incident" as const, title: row.summary, reason: `حادث بدرجة ${row.severity} ما زال مفتوحا`, priority: row.severity, status: row.status, href: "/admin/operations" })),
      ...Array.from({ length: missingReports }, (_, index) => ({ id: `report-${index}`, source: "report" as const, title: "تقرير حصة مفقود", reason: "انتهت الحصة ولم يصل تقريرها", priority: 3, status: "open", href: "/admin/operations" })),
      ...(inventory.data ?? []).filter((row) => row.quantity <= row.minimum_quantity).map((row) => ({ id: row.id, source: "inventory" as const, title: `مخزون منخفض: ${row.name}`, reason: `${row.quantity} متوفر والحد الأدنى ${row.minimum_quantity}`, priority: 2, status: "open", href: "/admin/resources" })),
      ...missingSalary.map((id) => ({ id, source: "salary" as const, title: `راتب غير مسجل: ${names.get(id) ?? "أستاذ"}`, reason: "لا يوجد سجل راتب للشهر الجاري", priority: 3, status: "open", href: "/admin/resources" })),
    ].sort((a, b) => b.priority - a.priority);
    const insights: DirectionInsight[] = buildInsights(classes, people, pendingRequests, openIncidents, missingReports);
    return { school: schoolResult.data, metrics: [
      { key: "sessions", label: "الحصص", value: sessionRows.length }, { key: "expected", label: "الطلاب المتوقعون", value: expected },
      { key: "present", label: "الحاضرون", value: attendanceRows.filter(({ status }) => status === "present").length, tone: "good" }, { key: "absent", label: "الغائبون", value: attendanceRows.filter(({ status }) => status === "absent").length, tone: "danger" },
      { key: "late", label: "المتأخرون", value: attendanceRows.filter(({ status }) => status === "late").length, tone: "warning" }, { key: "teachers-present", label: "الأساتذة الحاضرون", value: presentTeachers.size, tone: "good" },
      { key: "teachers-absent", label: "الأساتذة غير المسجلين", value: Math.max(0, teacherIds.length - presentTeachers.size), tone: "warning" }, { key: "reports", label: "التقارير المستلمة", value: todayReports.length },
      { key: "missing", label: "التقارير المفقودة", value: missingReports, tone: missingReports ? "danger" : "good" }, { key: "incidents", label: "الحوادث المفتوحة", value: openIncidents.length, tone: openIncidents.length ? "danger" : "good" },
      { key: "requests", label: "الطلبات", value: pendingRequests.length }, { key: "events", label: "أحداث اليوم", value: (events.data ?? []).filter(({ starts_at }) => starts_at >= dayStart.toISOString() && starts_at < dayEnd.toISOString()).length },
    ], tasks: taskQueue, insights, people, classes,
      timeline: (learningEvents.data ?? []).map((row) => ({ id: String(row.id), kind: "learning", title: `${names.get(row.student_id) ?? "طالب"} · ${eventLabel(row.event_kind)}`, detail: row.surah_number ? `السورة ${row.surah_number}` : "نشاط تعلم", occurredAt: row.occurred_at })),
      reports: reportRows.map((row) => ({ id: row.id, teacherName: names.get(row.teacher_id) ?? "أستاذ", className: classNames.get(row.class_id) ?? "قسم", status: row.status, incident: row.incident, submittedAt: row.submitted_at })),
      requests: (requests.data ?? []).map((row) => ({ id: row.id, teacherName: names.get(row.teacher_id) ?? "أستاذ", kind: row.kind, title: row.title, status: row.status, submittedAt: row.submitted_at })),
      incidents: (incidents.data ?? []).map((row) => ({ id: row.id, category: row.category, severity: row.severity, summary: row.summary, status: row.status, occurredAt: row.occurred_at })),
      inventory: (inventory.data ?? []).map((row) => ({ id: row.id, name: row.name, category: row.category, quantity: row.quantity, minimum: row.minimum_quantity, status: row.status })),
      finance: (finance.data ?? []).map((row) => ({ id: row.id, direction: row.direction, category: row.category, amount: Number(row.amount), currency: row.currency, occurredOn: row.occurred_on })),
      salaries: (salaries.data ?? []).map((row) => ({ id: row.id, teacherName: names.get(row.teacher_id) ?? "أستاذ", month: row.period_month, net: Number(row.net_amount), status: row.status })),
      years: years.data?.map((row) => ({ id: row.id, name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, active: row.active })) ?? [], rooms: rooms.data ?? [], events: events.data?.map((row) => ({ id: row.id, title: row.title, startsAt: row.starts_at })) ?? [], announcements: announcements.data?.map((row) => ({ id: row.id, title: row.title, audience: row.audience, publishedAt: row.published_at })) ?? [], audit: audit.data?.map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, occurredAt: row.occurred_at })) ?? [], parentFeedback: parentFeedback.data?.map((row) => ({ id: row.id, studentName: names.get(row.student_id) ?? "طالب", scores: row.scores ?? [], comment: row.comment, createdAt: row.created_at })) ?? [] };
  } catch (error) { logServerError("ADMIN_COMMAND_LOAD_FAILED", error); return empty; }
}

function countBy(values: readonly string[]): Map<string, number> { const map = new Map<string, number>(); for (const value of values) map.set(value, (map.get(value) ?? 0) + 1); return map; }
function ageFrom(value: string | null): number | null { if (!value) return null; const born = new Date(value); const now = new Date(); let age = now.getFullYear() - born.getFullYear(); if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--; return age; }
function daysAgo(value: string): number { return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); }
function eventLabel(value: string): string { return ({ surah_started: "بدأ سورة", surah_completed: "أتم سورة", goal_completed: "أتم هدفا", assignment_updated: "حدّث واجبا", exam_completed: "أتم امتحانا" } as Record<string, string>)[value] ?? "نشاط جديد"; }
function buildInsights(classes: AdminCommandData["classes"], people: CommandPerson[], requests: Array<{ submitted_at: string }>, incidents: Array<{ severity: number }>, missingReports: number): DirectionInsight[] { const result: DirectionInsight[] = []; const lowAttendance = people.filter((person) => person.role === "student" && person.absences >= 2).length; if (lowAttendance) result.push({ id: "attendance", title: "انخفاض في المواظبة", explanation: "طلاب لديهم غيابان أو أكثر في السجلات المتاحة.", evidence: `${lowAttendance} طالب`, tone: "warning", href: "/admin/people" }); const blocked = people.filter((person) => person.role === "student" && person.lastActivity && daysAgo(person.lastActivity) >= 14).length; if (blocked) result.push({ id: "progress", title: "تقدم متوقف", explanation: "لم يسجل هؤلاء الطلاب نشاط تعلم منذ 14 يوما على الأقل.", evidence: `${blocked} طالب`, tone: "warning", href: "/admin/people" }); if (missingReports) result.push({ id: "reports", title: "تقارير مفقودة", explanation: "حصص منتهية اليوم لا يقابلها تقرير جلسة.", evidence: `${missingReports} تقرير`, tone: "danger", href: "/admin/operations" }); const old = requests.filter((row) => daysAgo(row.submitted_at) > 7).length; if (old) result.push({ id: "requests", title: "طلبات قديمة", explanation: "طلبات مفتوحة منذ أكثر من سبعة أيام.", evidence: `${old} طلب`, tone: "warning", href: "/admin/workforce" }); const full = classes.filter((row) => row.capacity && row.students / row.capacity >= .9).length; if (full) result.push({ id: "capacity", title: "أقسام قاربت الامتلاء", explanation: "بلغت نسبة الإشغال 90% على الأقل.", evidence: `${full} قسم`, tone: "info", href: "/admin/operations" }); if (incidents.filter(({ severity }) => severity >= 3).length) result.push({ id: "incidents", title: "حوادث ذات أولوية", explanation: "حوادث مفتوحة بدرجة خطورة 3 أو 4.", evidence: `${incidents.filter(({ severity }) => severity >= 3).length} حادث`, tone: "danger", href: "/admin/operations" }); return result; }
