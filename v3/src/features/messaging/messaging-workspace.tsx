"use client";

import { Archive, Inbox, MessageSquareText, Paperclip, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Input, Select, useToast } from "@/components/ui";
import { enqueueOfflineMutation } from "@/features/offline";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseRequestPriority, DatabaseServiceRequestKind, DatabaseServiceRequestStatus } from "@/types/database";
import type { MessagingWorkspaceData } from "./models";

type WorkspaceTab = "messages" | "requests";
const requestKinds: Array<[DatabaseServiceRequestKind, string]> = [
  ["leave", "إجازة"], ["absence", "غياب"], ["equipment", "معدات"], ["incident", "حادث"], ["salary_problem", "مشكلة راتب"],
  ["administrative_question", "سؤال إداري"], ["complaint", "شكوى"], ["class_change", "تغيير قسم"], ["technical_problem", "مشكلة تقنية"], ["other", "أخرى"],
];

export function MessagingWorkspace({ data, teacherMode = false }: { data: MessagingWorkspaceData; teacherMode?: boolean }) {
  const [tab, setTab] = useState<WorkspaceTab>("messages");
  if (teacherMode) return <div className="communication-workspace teacher-text-messages"><header className="teacher-page-head"><span>التواصل</span><h1>الرسائل</h1></header><Messages data={data} /></div>;
  return <div className="communication-workspace"><header className="communication-hero"><span>التواصل الموحّد</span><h1>الرسائل والطلبات</h1><p>المحادثات للتواصل اليومي، والطلبات لمسار إداري موثّق.</p></header><nav className="communication-tabs" aria-label="أقسام التواصل"><button className={tab === "messages" ? "is-active" : undefined} type="button" onClick={() => setTab("messages")}><MessageSquareText size={18} />الرسائل</button><button className={tab === "requests" ? "is-active" : undefined} type="button" onClick={() => setTab("requests")}><Inbox size={18} />الطلبات</button></nav>{tab === "messages" ? <Messages data={data} /> : <Requests data={data} />}</div>;
}

function Messages({ data }: { data: MessagingWorkspaceData }) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(data.conversations.find((item) => !item.archived)?.id ?? null);
  const [search, setSearch] = useState(""); const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState(data.targets[0]?.id ?? ""); const [subject, setSubject] = useState(""); const [busy, setBusy] = useState(false);
  const conversations = data.conversations.filter((item) => !item.archived && `${item.subject} ${item.participantNames.join(" ")}`.includes(search.trim()));
  const messages = useMemo(() => data.messages.filter((item) => item.conversationId === selectedId), [data.messages, selectedId]);

  async function openConversation(id: string): Promise<void> { setSelectedId(id); await createClient().rpc("mark_conversation_read", { target_conversation_id: id }); }
  async function createConversation(): Promise<void> {
    if (!target || !subject.trim()) return; setBusy(true);
    const { data: id, error } = await createClient().rpc("create_direct_conversation", { target_user_id: target, target_subject: subject }); setBusy(false);
    if (error || !id) return showToast({ title: "تعذر إنشاء المحادثة", description: "تحقق من صلاحية التواصل ثم حاول مجددًا.", tone: "info" });
    setSelectedId(id); setSubject(""); window.location.reload();
  }
  async function sendMessage(): Promise<void> {
    const text = body.trim(); if (!selectedId || (!text && !file)) return;
    if (file && !navigator.onLine) return showToast({ title: "يلزم الاتصال لإرسال المرفق", description: "يمكنك إرسال الرسالة النصية الآن أو المحاولة لاحقًا.", tone: "info" });
    const clientId = crypto.randomUUID(); setBusy(true);
    const { data: messageId, error } = await createClient().rpc("send_conversation_message", { target_conversation_id: selectedId, target_body: text || file?.name || "مرفق", target_client_id: clientId });
    if (error && !navigator.onLine) {
      await enqueueOfflineMutation({ id: clientId, kind: "message.send", payload: { conversationId: selectedId, body: text, clientId } });
      showToast({ title: "حُفظت الرسالة للإرسال", description: "ستُرسل تلقائيًا عند عودة الاتصال.", tone: "info" }); setBody(""); setBusy(false); return;
    }
    if (!error && file && messageId) { const form = new FormData(); form.set("file", file); form.set("messageId", String(messageId)); form.set("conversationId", selectedId); const response = await fetch("/api/messages/attachments", { method: "POST", body: form }); if (!response.ok) showToast({ title: "أُرسلت الرسالة دون المرفق", description: "صيغة الملف أو حجمه غير مقبول.", tone: "info" }); }
    setBusy(false); if (error) return showToast({ title: "تعذر إرسال الرسالة", tone: "info" }); setBody(""); setFile(null); window.location.reload();
  }
  async function archive(): Promise<void> { if (!selectedId) return; await createClient().rpc("archive_conversation", { target_conversation_id: selectedId, target_archived: true }); window.location.reload(); }

  return <section className="message-layout"><aside className="conversation-list"><Input label="البحث في المحادثات" value={search} onChange={(event) => setSearch(event.target.value)} /><details className="communication-compose"><summary><Plus size={17} />محادثة جديدة</summary><Select label="المستلم" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">اختر المستلم</option>{data.targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Input label="الموضوع" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} /><Button loading={busy} onClick={() => void createConversation()}>إنشاء</Button></details>{conversations.map((item) => <button className={item.id === selectedId ? "is-active" : undefined} type="button" key={item.id} onClick={() => void openConversation(item.id)}><span><strong>{item.subject}</strong><small>{item.participantNames.join("، ")}</small></span>{item.unread ? <i aria-label="غير مقروء" /> : null}</button>)}</aside><div className="message-thread">{selectedId ? <><header><div><strong>{data.conversations.find((item) => item.id === selectedId)?.subject}</strong><small>سجل المحادثة محفوظ</small></div><Button size="icon" variant="quiet" aria-label="أرشفة المحادثة" onClick={() => void archive()}><Archive size={18} /></Button></header><div className="message-thread__history" aria-live="polite">{messages.map((item) => <article className={item.senderId === data.currentUserId ? "is-own" : undefined} key={item.id}><strong>{item.senderName}</strong><p>{item.body}</p>{item.attachments.map((attachment) => <a className="message-attachment" href={`/api/messages/attachments/${attachment.id}`} target="_blank" rel="noreferrer" key={attachment.id}><Paperclip size={14} />{attachment.fileName}</a>)}<time>{formatDate(item.createdAt)}</time></article>)}</div><footer><label className="message-file" title="إرفاق ملف"><Paperclip size={19} /><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/ogg,audio/webm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file?.name ?? "مرفق"}</span></label><textarea aria-label="نص الرسالة" value={body} maxLength={4000} placeholder="اكتب رسالتك" onChange={(event) => setBody(event.target.value)} /><Button size="icon" loading={busy} aria-label="إرسال" onClick={() => void sendMessage()}><Send size={19} /></Button></footer></> : <EmptyState title="اختر محادثة" description="اختر محادثة أو ابدأ واحدة جديدة." icon={MessageSquareText} />}</div></section>;
}

function Requests({ data }: { data: MessagingWorkspaceData }) {
  const { showToast } = useToast();
  const [kind, setKind] = useState<DatabaseServiceRequestKind>("administrative_question"); const [priority, setPriority] = useState<DatabaseRequestPriority>("normal");
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(): Promise<void> {
    if (title.trim().length < 3) return; const clientId = crypto.randomUUID(); setBusy(true);
    const payload = { kind, priority, title: title.trim(), details: details.trim(), clientId };
    if (!navigator.onLine) { await enqueueOfflineMutation({ id: clientId, kind: "request.create", payload }); showToast({ title: "حُفظ الطلب", description: "سيُرسل تلقائيًا عند عودة الاتصال.", tone: "info" }); setTitle(""); setDetails(""); setBusy(false); return; }
    const { error } = await createClient().rpc("create_service_request", { target_kind: kind, target_title: payload.title, target_details: payload.details || null, target_priority: priority, target_client_id: clientId });
    if (error && !navigator.onLine) { await enqueueOfflineMutation({ id: clientId, kind: "request.create", payload }); showToast({ title: "حُفظ الطلب", description: "سيُرسل تلقائيًا عند عودة الاتصال.", tone: "info" }); setTitle(""); setDetails(""); setBusy(false); return; }
    setBusy(false); if (error) return showToast({ title: "تعذر إرسال الطلب", tone: "info" }); window.location.reload();
  }
  async function changeStatus(requestId: string, status: DatabaseServiceRequestStatus): Promise<void> {
    setBusy(true); const { error } = await createClient().rpc("update_service_request", { target_request_id: requestId, target_status: status, target_note: null, target_assigned_to: data.currentUserId }); setBusy(false);
    if (error) return showToast({ title: "تعذر تحديث الطلب", tone: "info" }); window.location.reload();
  }
  return <div className="request-layout"><section className="request-form"><h2>طلب جديد</h2><Select label="نوع الطلب" value={kind} onChange={(event) => setKind(event.target.value as DatabaseServiceRequestKind)}>{requestKinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select><Select label="الأولوية" value={priority} onChange={(event) => setPriority(event.target.value as DatabaseRequestPriority)}><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></Select><Input label="العنوان" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /><label className="ui-field"><span className="ui-field__label">التفاصيل</span><textarea className="request-details" value={details} maxLength={4000} onChange={(event) => setDetails(event.target.value)} /></label><Button loading={busy} aria-disabled={title.trim().length < 3} onClick={() => void submit()}><Send size={18} />إرسال الطلب</Button></section><section className="request-history"><h2>سجل الطلبات</h2>{data.requests.length ? data.requests.map((item) => <article key={item.id}><header><strong>{item.title}</strong><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></header><p>{item.reference} · {kindLabel(item.kind)} · {item.requesterName}</p>{item.assignedName ? <small>المكلّف: {item.assignedName}</small> : null}{item.details ? <p>{item.details}</p> : null}<details><summary>سجل المعالجة ({item.events.length})</summary>{item.events.map((event) => <div className="request-event" key={event.id}><strong>{statusLabel(event.toStatus ?? item.status)}</strong><small>{event.note ?? formatDate(event.createdAt)}</small></div>)}</details>{data.canManageRequests && !["resolved", "rejected", "cancelled"].includes(item.status) ? <footer><Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeStatus(item.id, "acknowledged")}>استلام</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeStatus(item.id, "in_progress")}>معالجة</Button><Button size="sm" disabled={busy} onClick={() => void changeStatus(item.id, "resolved")}>حلّ الطلب</Button></footer> : null}<small>{formatDate(item.createdAt)}</small></article>) : <EmptyState title="لا توجد طلبات" description="ستظهر الطلبات المرسلة هنا مع حالتها." />}</section></div>;
}

function kindLabel(value: DatabaseServiceRequestKind): string { return requestKinds.find(([key]) => key === value)?.[1] ?? value; }
function statusLabel(value: string): string { return ({ submitted: "مرسل", acknowledged: "تم الاستلام", in_progress: "قيد المعالجة", waiting_user: "بانتظار ردك", resolved: "تمت المعالجة", rejected: "مرفوض", cancelled: "ملغى" } as Record<string, string>)[value] ?? value; }
function statusTone(value: string): "neutral" | "success" | "warning" | "danger" | "brand" { if (value === "resolved") return "success"; if (value === "rejected") return "danger"; if (value === "in_progress") return "brand"; return "warning"; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
