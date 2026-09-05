import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/observability/logger";
import type {
  AdminCommandData,
  CommandPerson,
  CommandTask,
  DirectionInsight,
} from "./models";

const empty: AdminCommandData = {
  school: null,
  metrics: [
    { key: "students", label: "الطلاب النشطون", value: 0 },
    { key: "teachers", label: "الأساتذة النشطون", value: 0 },
    { key: "classes", label: "الأقسام", value: 0 },
    { key: "reports", label: "تقارير اليوم", value: 0 },
  ],
  tasks: [],
  insights: [],
  people: [],
  classes: [],
  timeline: [],
  reports: [],
  requests: [],
  incidents: [],
  inventory: [],
  finance: [],
  payments: [],
  financeThreshold: 0,
  salaries: [],
  years: [],
  rooms: [],
  events: [],
  announcements: [],
  audit: [],
  parentFeedback: [],
};

export async function getAdminCommandData(): Promise<AdminCommandData> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return empty;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return empty;
    const memberships = await client
      .from("school_memberships")
      .select("school_id")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .limit(1);
    const schoolId = memberships.data?.[0]?.school_id;
    if (!schoolId) return empty;
    const schoolResult = await client
      .from("schools")
      .select("id,name")
      .eq("id", schoolId)
      .maybeSingle();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const [
      profiles,
      roles,
      schoolMembers,
      studentProfiles,
      teacherProfiles,
      studentFiles,
      enrollments,
      assignments,
      classRows,
      sessions,
      attendance,
      reports,
      requests,
      incidents,
      tasks,
      inventory,
      finance,
      payments,
      settings,
      salaries,
      years,
      rooms,
      events,
      announcements,
      progress,
      learningEvents,
      audit,
      parentFeedback,
    ] = await Promise.all([
      client
        .from("profiles")
        .select("id,first_name,last_name,display_name,status")
        .order("display_name"),
      client.from("user_roles").select("user_id,role"),
      client
        .from("school_memberships")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("status", "active"),
      client.from("student_profiles").select("user_id,date_of_birth,gender"),
      client
        .from("teacher_profiles")
        .select("user_id,gender,phone,email,monthly_salary"),
      client
        .from("student_digital_files")
        .select("student_id,guardian_name,guardian_phone,monthly_fee"),
      client
        .from("class_enrollments")
        .select("class_id,student_id,status")
        .eq("status", "active"),
      client
        .from("class_teacher_assignments")
        .select("class_id,teacher_id,status")
        .eq("status", "active"),
      client
        .from("classes")
        .select("id,name,level,capacity,status")
        .eq("school_id", schoolId),
      client
        .from("course_sessions")
        .select("id,class_id,teacher_id,starts_at,ends_at,status")
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString()),
      client
        .from("attendance_records")
        .select("session_id,student_id,status,minutes_late,recorded_at")
        .gte("recorded_at", dayStart.toISOString())
        .lt("recorded_at", dayEnd.toISOString()),
      client
        .from("teacher_session_reports")
        .select(
          "id,teacher_id,class_id,status,incident,submitted_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("teacher_requests")
        .select("id,teacher_id,kind,title,status,submitted_at")
        .eq("school_id", schoolId)
        .order("submitted_at", { ascending: false })
        .limit(100),
      client
        .from("school_incidents")
        .select("id,category,severity,summary,status,occurred_at")
        .eq("school_id", schoolId)
        .order("occurred_at", { ascending: false })
        .limit(100),
      client
        .from("admin_tasks")
        .select("id,kind,priority,title,reason,status,href,created_at")
        .eq("school_id", schoolId)
        .in("status", ["open", "in_progress"])
        .order("priority", { ascending: false }),
      client
        .from("inventory_items")
        .select("id,name,category,quantity,minimum_quantity,status")
        .eq("school_id", schoolId)
        .order("name"),
      client
        .from("finance_transactions")
        .select("id,direction,category,amount,currency,occurred_on,source_type")
        .eq("school_id", schoolId)
        .order("occurred_on", { ascending: false })
        .limit(100),
      client
        .from("student_payments")
        .select(
          "id,student_id,period_month,expected_amount,received_amount,status,paid_on",
        )
        .eq("school_id", schoolId)
        .order("period_month", { ascending: false })
        .limit(200),
      client
        .from("admin_school_settings")
        .select("finance_alert_threshold")
        .eq("school_id", schoolId)
        .maybeSingle(),
      client
        .from("teacher_salary_records")
        .select("id,teacher_id,period_month,net_amount,status")
        .eq("school_id", schoolId)
        .order("period_month", { ascending: false })
        .limit(100),
      client
        .from("academic_years")
        .select("id,name,starts_on,ends_on,active")
        .eq("school_id", schoolId)
        .order("starts_on", { ascending: false }),
      client
        .from("school_rooms")
        .select("id,name,capacity,active")
        .eq("school_id", schoolId)
        .order("name"),
      client
        .from("school_events")
        .select("id,title,starts_at")
        .eq("school_id", schoolId)
        .order("starts_at", { ascending: false })
        .limit(100),
      client
        .from("school_announcements")
        .select("id,title,audience,published_at")
        .eq("school_id", schoolId)
        .order("published_at", { ascending: false })
        .limit(100),
      client
        .from("student_surah_progress")
        .select("student_id,status,last_activity_at"),
      client
        .from("learning_events")
        .select("id,student_id,event_kind,surah_number,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(150),
      client
        .from("audit_logs")
        .select("id,action,entity_type,occurred_at")
        .eq("school_id", schoolId)
        .order("occurred_at", { ascending: false })
        .limit(150),
      client
        .from("parent_feedback")
        .select("id,student_id,scores,comment,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const memberIds = new Set(
      (schoolMembers.data ?? []).map(({ user_id }) => user_id),
    );
    const names = new Map(
      (profiles.data ?? []).map((row) => [row.id, row.display_name]),
    );
    const roleMap = new Map(
      (roles.data ?? [])
        .filter(({ user_id }) => memberIds.has(user_id))
        .map((row) => [row.user_id, row.role]),
    );
    const classNames = new Map(
      (classRows.data ?? []).map((row) => [row.id, row.name]),
    );
    const enrollmentByStudent = new Map(
      (enrollments.data ?? []).map((row) => [row.student_id, row.class_id]),
    );
    const absences = countBy(
      (attendance.data ?? [])
        .filter(({ status }) => status === "absent")
        .map(({ student_id }) => student_id),
    );
    const late = countBy(
      (attendance.data ?? [])
        .filter(({ status }) => status === "late")
        .map(({ student_id }) => student_id),
    );
    const mastered = countBy(
      (progress.data ?? [])
        .filter(({ status }) => status === "mastered")
        .map(({ student_id }) => student_id),
    );
    const latest = new Map<string, string>();
    for (const row of progress.data ?? [])
      if (
        row.last_activity_at &&
        (!latest.get(row.student_id) ||
          row.last_activity_at > latest.get(row.student_id)!)
      )
        latest.set(row.student_id, row.last_activity_at);
    const teacherIdsByClass = new Map<string, string[]>();
    const classIdsByTeacher = new Map<string, string[]>();
    for (const row of assignments.data ?? []) {
      teacherIdsByClass.set(row.class_id, [
        ...(teacherIdsByClass.get(row.class_id) ?? []),
        row.teacher_id,
      ]);
      classIdsByTeacher.set(row.teacher_id, [
        ...(classIdsByTeacher.get(row.teacher_id) ?? []),
        row.class_id,
      ]);
    }
    const studentMap = new Map(
      (studentProfiles.data ?? []).map((row) => [row.user_id, row]),
    );
    const teacherMap = new Map(
      (teacherProfiles.data ?? []).map((row) => [row.user_id, row]),
    );
    const fileMap = new Map(
      (studentFiles.data ?? []).map((row) => [row.student_id, row]),
    );
    const people: CommandPerson[] = (profiles.data ?? [])
      .filter(({ id }) => memberIds.has(id) && roleMap.has(id))
      .map((row) => {
        const role = roleMap.get(row.id)!;
        const classIds =
          role === "teacher" ? (classIdsByTeacher.get(row.id) ?? []) : [];
        const classId =
          role === "student"
            ? (enrollmentByStudent.get(row.id) ?? null)
            : (classIds[0] ?? null);
        const student = studentMap.get(row.id);
        const teacher = teacherMap.get(row.id);
        const file = fileMap.get(row.id);
        return {
          id: row.id,
          name: row.display_name,
          firstName: row.first_name,
          lastName: row.last_name,
          role,
          status: row.status,
          classId,
          className:
            role === "teacher"
              ? classIds
                  .map((id) => classNames.get(id))
                  .filter(Boolean)
                  .join("، ") || null
              : (classNames.get(classId ?? "") ?? null),
          classIds,
          age: ageFrom(student?.date_of_birth ?? null),
          gender: student?.gender ?? teacher?.gender ?? null,
          phone: teacher?.phone ?? file?.guardian_phone ?? null,
          email: teacher?.email ?? null,
          monthlyAmount:
            role === "teacher"
              ? Number(teacher?.monthly_salary ?? 0)
              : role === "student"
                ? Number(file?.monthly_fee ?? 0)
                : null,
          guardianName: file?.guardian_name ?? null,
          guardianPhone: file?.guardian_phone ?? null,
          teacherIds: classId ? (teacherIdsByClass.get(classId) ?? []) : [],
          absences: absences.get(row.id) ?? 0,
          late: late.get(row.id) ?? 0,
          mastered: mastered.get(row.id) ?? 0,
          lastActivity: latest.get(row.id) ?? null,
        };
      });
    const classStudentCounts = countBy(
      (enrollments.data ?? []).map(({ class_id }) => class_id),
    );
    const classTeacherCounts = countBy(
      (assignments.data ?? []).map(({ class_id }) => class_id),
    );
    const classes = (classRows.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      capacity: row.capacity,
      students: classStudentCounts.get(row.id) ?? 0,
      teachers: classTeacherCounts.get(row.id) ?? 0,
    }));
    const sessionRows = sessions.data ?? [];
    const reportRows = reports.data ?? [];
    const todayReports = reportRows.filter(
      ({ submitted_at }) =>
        submitted_at &&
        submitted_at >= dayStart.toISOString() &&
        submitted_at < dayEnd.toISOString(),
    );
    const missingReports = sessionRows.filter(
      (session) =>
        new Date(session.ends_at) < new Date() &&
        !reportRows.some(
          ({ class_id, created_at }) =>
            class_id === session.class_id &&
            created_at >= dayStart.toISOString(),
        ),
    ).length;
    const teacherIds = (teacherProfiles.data ?? [])
      .map(({ user_id }) => user_id)
      .filter((id) => memberIds.has(id));
    const pendingRequests = (requests.data ?? []).filter(({ status }) =>
      ["submitted", "seen", "in_review"].includes(status),
    );
    const openIncidents = (incidents.data ?? []).filter(({ status }) =>
      ["open", "in_review"].includes(status),
    );
    const missingSalary = teacherIds.filter(
      (id) =>
        !(salaries.data ?? []).some(
          (row) => row.teacher_id === id && row.period_month === monthStart,
        ),
    );
    const taskQueue: CommandTask[] = [
      ...(tasks.data ?? []).map((row) => ({
        id: row.id,
        source: "task" as const,
        title: row.title,
        reason: row.reason,
        priority: row.priority,
        status: row.status,
        href: row.href ?? "/admin",
      })),
      ...pendingRequests.map((row) => ({
        id: row.id,
        source: "request" as const,
        title: row.title,
        reason: `طلب ${row.kind} ينتظر المعالجة منذ ${daysAgo(row.submitted_at)} يوم`,
        priority: daysAgo(row.submitted_at) > 7 ? 4 : 2,
        status: row.status,
        href: "/admin/workforce",
      })),
      ...openIncidents.map((row) => ({
        id: row.id,
        source: "incident" as const,
        title: row.summary,
        reason: `حادث بدرجة ${row.severity} ما زال مفتوحا`,
        priority: row.severity,
        status: row.status,
        href: "/admin/operations",
      })),
      ...Array.from({ length: missingReports }, (_, index) => ({
        id: `report-${index}`,
        source: "report" as const,
        title: "تقرير حصة مفقود",
        reason: "انتهت الحصة ولم يصل تقريرها",
        priority: 3,
        status: "open",
        href: "/admin/operations",
      })),
      ...(inventory.data ?? [])
        .filter((row) => row.quantity <= row.minimum_quantity)
        .map((row) => ({
          id: row.id,
          source: "inventory" as const,
          title: `مخزون منخفض: ${row.name}`,
          reason: `${row.quantity} متوفر والحد الأدنى ${row.minimum_quantity}`,
          priority: 2,
          status: "open",
          href: "/admin/resources",
        })),
      ...missingSalary.map((id) => ({
        id,
        source: "salary" as const,
        title: `راتب غير مسجل: ${names.get(id) ?? "أستاذ"}`,
        reason: "لا يوجد سجل راتب للشهر الجاري",
        priority: 3,
        status: "open",
        href: "/admin/resources",
      })),
    ].sort((a, b) => b.priority - a.priority);
    const insights: DirectionInsight[] = buildInsights(
      classes,
      people,
      pendingRequests,
      openIncidents,
      missingReports,
    );
    const timelineRows = [
      ...(learningEvents.data ?? []).map((row) => ({
        id: `learning-${row.id}`,
        kind: "learning",
        title: `${names.get(row.student_id) ?? "طالب"} · ${eventLabel(row.event_kind)}`,
        detail: row.surah_number ? `السورة ${row.surah_number}` : "نشاط تعلم",
        occurredAt: row.occurred_at,
      })),
      ...(parentFeedback.data ?? []).map((row) => ({
        id: `feedback-${row.id}`,
        kind: "parent_feedback",
        title: `${names.get(row.student_id) ?? "أسرة"} · استبيان جديد`,
        detail: "رأي أسرة",
        occurredAt: row.created_at,
      })),
      ...reportRows
        .filter((row) => row.submitted_at)
        .map((row) => ({
          id: `report-${row.id}`,
          kind: "report",
          title: `${names.get(row.teacher_id) ?? "أستاذ"} · تقرير حصة`,
          detail: classNames.get(row.class_id) ?? "قسم",
          occurredAt: row.submitted_at!,
        })),
      ...(audit.data ?? [])
        .filter((row) =>
          [
            "finance.student_payment_recorded",
            "finance.teacher_salary_recorded",
            "account.provisioned",
          ].includes(row.action),
        )
        .map((row) => ({
          id: `audit-${row.id}`,
          kind: "administration",
          title: auditLabel(row.action),
          detail: row.entity_type,
          occurredAt: row.occurred_at,
        })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return {
      school: schoolResult.data,
      metrics: [
        {
          key: "students",
          label: "الطلاب النشطون",
          value: people.filter(
            (row) => row.role === "student" && row.status === "active",
          ).length,
        },
        {
          key: "teachers",
          label: "الأساتذة النشطون",
          value: people.filter(
            (row) => row.role === "teacher" && row.status === "active",
          ).length,
        },
        {
          key: "classes",
          label: "الأقسام",
          value: classes.filter((row) => row.students > 0 || row.teachers > 0)
            .length,
        },
        { key: "reports", label: "تقارير اليوم", value: todayReports.length },
      ],
      tasks: taskQueue,
      insights,
      people,
      classes,
      timeline: timelineRows,
      reports: reportRows.map((row) => ({
        id: row.id,
        teacherName: names.get(row.teacher_id) ?? "أستاذ",
        className: classNames.get(row.class_id) ?? "قسم",
        status: row.status,
        incident: row.incident,
        submittedAt: row.submitted_at,
      })),
      requests: (requests.data ?? []).map((row) => ({
        id: row.id,
        teacherName: names.get(row.teacher_id) ?? "أستاذ",
        kind: row.kind,
        title: row.title,
        status: row.status,
        submittedAt: row.submitted_at,
      })),
      incidents: (incidents.data ?? []).map((row) => ({
        id: row.id,
        category: row.category,
        severity: row.severity,
        summary: row.summary,
        status: row.status,
        occurredAt: row.occurred_at,
      })),
      inventory: (inventory.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        minimum: row.minimum_quantity,
        status: row.status,
      })),
      finance: (finance.data ?? []).map((row) => ({
        id: row.id,
        direction: row.direction,
        category: row.category,
        amount: Number(row.amount),
        currency: row.currency,
        occurredOn: row.occurred_on,
        sourceType: row.source_type,
      })),
      payments: (payments.data ?? []).map((row) => ({
        id: row.id,
        studentId: row.student_id,
        month: row.period_month,
        expected: Number(row.expected_amount),
        received: Number(row.received_amount),
        status: row.status,
        paidOn: row.paid_on,
      })),
      financeThreshold: Number(settings.data?.finance_alert_threshold ?? 0),
      salaries: (salaries.data ?? []).map((row) => ({
        id: row.id,
        teacherName: names.get(row.teacher_id) ?? "أستاذ",
        month: row.period_month,
        net: Number(row.net_amount),
        status: row.status,
      })),
      years:
        years.data?.map((row) => ({
          id: row.id,
          name: row.name,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
          active: row.active,
        })) ?? [],
      rooms: rooms.data ?? [],
      events:
        events.data?.map((row) => ({
          id: row.id,
          title: row.title,
          startsAt: row.starts_at,
        })) ?? [],
      announcements:
        announcements.data?.map((row) => ({
          id: row.id,
          title: row.title,
          audience: row.audience,
          publishedAt: row.published_at,
        })) ?? [],
      audit:
        audit.data?.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entity_type,
          occurredAt: row.occurred_at,
        })) ?? [],
      parentFeedback:
        parentFeedback.data?.map((row) => {
          const scores = row.scores ?? [];
          return {
            id: row.id,
            studentId: row.student_id,
            studentName: names.get(row.student_id) ?? "طالب",
            className:
              classNames.get(enrollmentByStudent.get(row.student_id) ?? "") ??
              null,
            scores,
            average: scores.length
              ? scores.reduce((sum, value) => sum + value, 0) / scores.length
              : 0,
            comment: row.comment,
            createdAt: row.created_at,
          };
        }) ?? [],
    };
  } catch (error) {
    logServerError("ADMIN_COMMAND_LOAD_FAILED", error);
    return empty;
  }
}

function countBy(values: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}
function ageFrom(value: string | null): number | null {
  if (!value) return null;
  const born = new Date(value);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    age--;
  return age;
}
function daysAgo(value: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );
}
function eventLabel(value: string): string {
  return (
    (
      {
        surah_started: "بدأ سورة",
        surah_completed: "أتم سورة",
        goal_completed: "أتم هدفا",
        assignment_updated: "حدّث واجبا",
        exam_completed: "أتم امتحانا",
      } as Record<string, string>
    )[value] ?? "نشاط جديد"
  );
}
function auditLabel(value: string): string {
  return (
    (
      {
        "finance.student_payment_recorded": "تم تسجيل أداء طالب",
        "finance.teacher_salary_recorded": "تم تسجيل أجر أستاذ",
        "account.provisioned": "تم إنشاء حساب",
      } as Record<string, string>
    )[value] ?? "نشاط إداري"
  );
}
function buildInsights(
  classes: AdminCommandData["classes"],
  people: CommandPerson[],
  requests: Array<{ submitted_at: string }>,
  incidents: Array<{ severity: number }>,
  missingReports: number,
): DirectionInsight[] {
  const result: DirectionInsight[] = [];
  const lowAttendance = people.filter(
    (person) => person.role === "student" && person.absences >= 2,
  ).length;
  if (lowAttendance)
    result.push({
      id: "attendance",
      title: "انخفاض في المواظبة",
      explanation: "طلاب لديهم غيابان أو أكثر في السجلات المتاحة.",
      evidence: `${lowAttendance} طالب`,
      tone: "warning",
      href: "/admin/people",
    });
  const blocked = people.filter(
    (person) =>
      person.role === "student" &&
      person.lastActivity &&
      daysAgo(person.lastActivity) >= 14,
  ).length;
  if (blocked)
    result.push({
      id: "progress",
      title: "تقدم متوقف",
      explanation: "لم يسجل هؤلاء الطلاب نشاط تعلم منذ 14 يوما على الأقل.",
      evidence: `${blocked} طالب`,
      tone: "warning",
      href: "/admin/people",
    });
  if (missingReports)
    result.push({
      id: "reports",
      title: "تقارير مفقودة",
      explanation: "حصص منتهية اليوم لا يقابلها تقرير جلسة.",
      evidence: `${missingReports} تقرير`,
      tone: "danger",
      href: "/admin/operations",
    });
  const old = requests.filter((row) => daysAgo(row.submitted_at) > 7).length;
  if (old)
    result.push({
      id: "requests",
      title: "طلبات قديمة",
      explanation: "طلبات مفتوحة منذ أكثر من سبعة أيام.",
      evidence: `${old} طلب`,
      tone: "warning",
      href: "/admin/workforce",
    });
  const full = classes.filter(
    (row) => row.capacity && row.students / row.capacity >= 0.9,
  ).length;
  if (full)
    result.push({
      id: "capacity",
      title: "أقسام قاربت الامتلاء",
      explanation: "بلغت نسبة الإشغال 90% على الأقل.",
      evidence: `${full} قسم`,
      tone: "info",
      href: "/admin/operations",
    });
  if (incidents.filter(({ severity }) => severity >= 3).length)
    result.push({
      id: "incidents",
      title: "حوادث ذات أولوية",
      explanation: "حوادث مفتوحة بدرجة خطورة 3 أو 4.",
      evidence: `${incidents.filter(({ severity }) => severity >= 3).length} حادث`,
      tone: "danger",
      href: "/admin/operations",
    });
  return result;
}
