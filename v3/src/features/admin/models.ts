import type {
  DatabaseAccountStatus,
  DatabaseAdminTaskStatus,
  DatabaseAppRole,
} from "@/types/database";

export type CommandMetric = {
  key: string;
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warning" | "danger";
};
export type CommandTask = {
  id: string;
  source: "task" | "request" | "incident" | "report" | "inventory" | "salary";
  title: string;
  reason: string;
  priority: number;
  status: DatabaseAdminTaskStatus | string;
  href: string;
};
export type DirectionInsight = {
  id: string;
  title: string;
  explanation: string;
  evidence: string;
  tone: "warning" | "danger" | "info";
  href: string;
};
export type CommandPerson = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: DatabaseAppRole;
  status: DatabaseAccountStatus;
  classId: string | null;
  className: string | null;
  classIds: string[];
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  monthlyAmount: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  teacherIds: string[];
  absences: number;
  late: number;
  mastered: number;
  lastActivity: string | null;
};
export type CommandClass = {
  id: string;
  name: string;
  level: string | null;
  capacity: number | null;
  students: number;
  teachers: number;
};
export type CommandTimelineItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  occurredAt: string;
};

export type AdminCommandData = {
  school: { id: string; name: string } | null;
  metrics: CommandMetric[];
  tasks: CommandTask[];
  insights: DirectionInsight[];
  people: CommandPerson[];
  classes: CommandClass[];
  timeline: CommandTimelineItem[];
  reports: Array<{
    id: string;
    teacherName: string;
    className: string;
    status: string;
    incident: boolean;
    submittedAt: string | null;
  }>;
  requests: Array<{
    id: string;
    teacherName: string;
    kind: string;
    title: string;
    status: string;
    submittedAt: string;
  }>;
  incidents: Array<{
    id: string;
    category: string;
    severity: number;
    summary: string;
    status: string;
    occurredAt: string;
  }>;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    minimum: number;
    status: string;
  }>;
  finance: Array<{
    id: string;
    direction: string;
    category: string;
    amount: number;
    currency: string;
    occurredOn: string;
    sourceType: string;
  }>;
  payments: Array<{
    id: string;
    studentId: string;
    month: string;
    expected: number;
    received: number;
    status: string;
    paidOn: string;
  }>;
  financeThreshold: number;
  salaries: Array<{
    id: string;
    teacherName: string;
    month: string;
    net: number;
    status: string;
  }>;
  years: Array<{
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
    active: boolean;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    capacity: number | null;
    active: boolean;
  }>;
  events: Array<{ id: string; title: string; startsAt: string }>;
  announcements: Array<{
    id: string;
    title: string;
    audience: string;
    publishedAt: string;
  }>;
  audit: Array<{
    id: number;
    action: string;
    entityType: string;
    occurredAt: string;
  }>;
  parentFeedback: Array<{
    id: string;
    studentId: string;
    studentName: string;
    className: string | null;
    scores: number[];
    average: number;
    comment: string | null;
    createdAt: string;
  }>;
};
