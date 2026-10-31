import Link from "next/link";
import { BookOpenText, CalendarDays, UsersRound } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import type { TeacherHomeData } from "./models";

const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function TeacherClasses({ data }: { data: TeacherHomeData }) {
  return <div className="teacher-workspace teacher-classes">
    <header className="teacher-page-head"><span>التدريس</span><h1>الأقسام المسندة</h1></header>
    {data.classes.length ? <div className="teacher-class-grid">{data.classes.map((classroom) => {
      const slots = (data.recurringSchedule ?? []).filter((slot) => slot.classId === classroom.id);
      const schedule = classroom.scheduleText?.trim() || slots.map((slot) => `${days[slot.dayOfWeek]} ${slot.startsAt.slice(0, 5)}–${slot.endsAt.slice(0, 5)}${slot.room ? ` · ${slot.room}` : ""}`).join("، ");
      return <article key={classroom.id}>
        <header><div><span className="teacher-class-icon"><BookOpenText aria-hidden="true" size={22} /></span><div><h2>{classroom.name}</h2><p>{classroom.level || "المستوى غير محدد"}</p></div></div><Badge tone="brand">قسم مسند</Badge></header>
        <dl><div><dt><UsersRound size={17} />الطلاب</dt><dd>{classroom.studentCount}</dd></div><div><dt><CalendarDays size={17} />الجدول</dt><dd>{schedule || "لم تحدد الإدارة موعدا بعد"}</dd></div></dl>
        <div className="teacher-class-actions"><Link className="ui-button ui-button--secondary ui-button--sm" href={`/teacher/students?class=${encodeURIComponent(classroom.id)}`}>عرض الطلاب</Link><Link className="ui-button ui-button--primary ui-button--sm" href={`/teacher/session?class=${encodeURIComponent(classroom.id)}`}>بدء حصة</Link></div>
      </article>;
    })}</div> : <EmptyState title="لا توجد أقسام مسندة" description="ستظهر الأقسام هنا فور إسنادها من طرف الإدارة." icon={UsersRound} />}
  </div>;
}
