"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Pencil, Plus, Send, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Drawer, EmptyState, useToast } from "@/components/ui";
import type { Json } from "@/types/database";
import type { AdminCommandData, CommandClass } from "./models";

type ScheduleRow = { dayOfWeek: number; startsAt: string; endsAt: string; room: string };
type ClassForm = { id: string; name: string; level: string; capacity: string; teacherId: string; studentIds: string[]; schedule: ScheduleRow[]; status: "active" | "archived" };
const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function AdminClassWorkspace({ data }: { data: AdminCommandData }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(blankForm());
  const teachers = useMemo(() => data.people.filter((row) => row.role === "teacher" && row.status === "active"), [data.people]);
  const students = useMemo(() => data.people.filter((row) => row.role === "student" && row.status === "active"), [data.people]);
  const classes = data.classes.filter((row) => row.status !== "archived");

  function edit(row?: CommandClass) {
    setForm(row ? {
      id: row.id,
      name: row.name,
      level: row.level ?? "",
      capacity: row.capacity ? String(row.capacity) : "",
      teacherId: row.teacherId ?? "",
      studentIds: row.studentIds,
      schedule: row.schedule.map((slot) => ({ dayOfWeek: slot.dayOfWeek, startsAt: slot.startsAt.slice(0, 5), endsAt: slot.endsAt.slice(0, 5), room: slot.room ?? "" })),
      status: "active",
    } : blankForm());
    setOpen(true);
  }

  async function save(nextStatus: "active" | "archived" = form.status) {
    if (busy || !form.name.trim()) return;
    setBusy(true);
    const payload: Json = {
      id: form.id || null,
      name: form.name.trim(),
      level: form.level.trim(),
      capacity: form.capacity || null,
      teacher_id: form.teacherId || null,
      student_ids: form.studentIds,
      status: nextStatus,
      schedule: form.schedule.map((row) => ({ day_of_week: row.dayOfWeek, starts_at: row.startsAt, ends_at: row.endsAt, room: row.room.trim() || null })),
    };
    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", payload }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) {
      showToast({ title: "تعذر حفظ القسم", description: result?.message ?? "تحقق من البيانات ثم أعد المحاولة.", tone: "info" });
      return;
    }
    setOpen(false);
    showToast({ title: nextStatus === "archived" ? "تمت أرشفة القسم" : "تم حفظ القسم", tone: "success" });
    router.refresh();
  }

  async function sendSchedule(classId: string) {
    if (sendingId) return;
    setSendingId(classId);
    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send_schedule", classId }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    setSendingId(null);
    if (!response.ok) {
      showToast({ title: "تعذر إرسال جدول الحصص", description: result?.message ?? "حاول مرة أخرى.", tone: "info" });
      return;
    }
    showToast({ title: "تم إرسال جدول الحصص", tone: "success" });
  }

  return <div className="command-page">
    <header className="admin-page-head"><div><h1>الأقسام</h1><p>الأستاذ والطلاب ومواعيد الحصص من مصدر واحد.</p></div><Button onClick={() => edit()}><Plus size={18}/>إضافة قسم</Button></header>
    {classes.length ? <div className="admin-class-grid">{classes.map((row) => <article key={row.id}>
      <div className="admin-class-title"><span><UsersRound size={20}/></span><div><strong>{row.name}</strong><small>{row.level || "دون مستوى محدد"}</small></div></div>
      <dl><div><dt>الأستاذ</dt><dd>{data.people.find((person) => person.id === row.teacherId)?.name ?? "غير محدد"}</dd></div><div><dt>الطلاب</dt><dd>{row.students}</dd></div></dl>
      <div className="admin-class-schedule">{row.schedule.length ? row.schedule.map((slot) => <p key={slot.id}><CalendarClock size={16}/><span>{dayNames[slot.dayOfWeek]} · {slot.startsAt.slice(0,5)}–{slot.endsAt.slice(0,5)}</span></p>) : <small>لم تسجل مواعيد بعد.</small>}</div>
      <div className="admin-class-actions"><Button size="sm" variant="secondary" onClick={() => edit(row)}><Pencil size={16}/>تعديل</Button><Button size="sm" variant="quiet" loading={sendingId === row.id} disabled={!row.schedule.length || Boolean(sendingId)} onClick={() => void sendSchedule(row.id)}><Send size={16}/>إرسال الجدول</Button></div>
    </article>)}</div> : <EmptyState title="لا توجد أقسام" description="أنشئ أول قسم واربط به الأستاذ والطلاب والمواعيد."/>}
    <Drawer open={open} onOpenChange={setOpen} title={form.id ? "تعديل القسم" : "إضافة قسم"}>
      <div className="command-form admin-class-form">
        <div className="form-pair"><label>اسم القسم<input value={form.name} onChange={(event) => setForm({...form,name:event.target.value})}/></label><label>المستوى<input value={form.level} onChange={(event) => setForm({...form,level:event.target.value})}/></label></div>
        <div className="form-pair"><label>الأستاذ<select value={form.teacherId} onChange={(event) => setForm({...form,teacherId:event.target.value})}><option value="">اختر الأستاذ</option>{teachers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>السعة<input type="number" min="1" value={form.capacity} onChange={(event) => setForm({...form,capacity:event.target.value})}/></label></div>
        <fieldset className="admin-checks"><legend>طلاب القسم</legend>{students.map((student) => <label key={student.id}><input type="checkbox" checked={form.studentIds.includes(student.id)} onChange={(event) => setForm({...form,studentIds:event.target.checked?[...form.studentIds,student.id]:form.studentIds.filter((id)=>id!==student.id)})}/>{student.name}</label>)}</fieldset>
        <div className="admin-schedule-editor"><div className="command-heading"><h2>مواعيد الحصص</h2><Button size="sm" variant="secondary" onClick={() => setForm({...form,schedule:[...form.schedule,{dayOfWeek:2,startsAt:"18:00",endsAt:"20:00",room:""}]})}><Plus size={16}/>موعد</Button></div>{form.schedule.map((slot,index) => <div className="admin-schedule-row" key={`${index}-${slot.dayOfWeek}`}><select aria-label="اليوم" value={slot.dayOfWeek} onChange={(event) => replaceSchedule(index,{...slot,dayOfWeek:Number(event.target.value)})}>{dayNames.map((name,day) => <option key={name} value={day}>{name}</option>)}</select><input aria-label="البداية" type="time" value={slot.startsAt} onChange={(event)=>replaceSchedule(index,{...slot,startsAt:event.target.value})}/><input aria-label="النهاية" type="time" value={slot.endsAt} onChange={(event)=>replaceSchedule(index,{...slot,endsAt:event.target.value})}/><input aria-label="القاعة" placeholder="القاعة" value={slot.room} onChange={(event)=>replaceSchedule(index,{...slot,room:event.target.value})}/><Button size="sm" variant="quiet" onClick={()=>setForm({...form,schedule:form.schedule.filter((_,position)=>position!==index)})}>حذف</Button></div>)}</div>
        <div className="admin-class-save"><Button loading={busy} disabled={!form.name.trim() || !form.teacherId || busy} onClick={() => void save()}>حفظ</Button>{form.id ? <Button variant="danger" loading={busy} disabled={busy} onClick={() => { if (window.confirm("هل تريد أرشفة هذا القسم مع حفظ تاريخه؟")) void save("archived"); }}>أرشفة</Button> : null}</div>
      </div>
    </Drawer>
  </div>;

  function replaceSchedule(index: number, value: ScheduleRow) {
    setForm((current) => ({ ...current, schedule: current.schedule.map((row, position) => position === index ? value : row) }));
  }
}

function blankForm(): ClassForm { return { id: "", name: "", level: "", capacity: "30", teacherId: "", studentIds: [], schedule: [], status: "active" }; }
