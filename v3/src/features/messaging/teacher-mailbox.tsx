"use client";

import { Mail, MailOpen, PenLine, Reply, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, Input, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ConversationEntry, MessagingWorkspaceData } from "./models";

type MailTab = "received" | "sent" | "compose";

export function TeacherMailbox({ data }: { data: MessagingWorkspaceData }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<MailTab>("received");
  const [selected, setSelected] = useState<ConversationEntry | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const received = useMemo(() => newestFirst(data.messages.filter((item) => item.senderId !== data.currentUserId)), [data]);
  const sent = useMemo(() => newestFirst(data.messages.filter((item) => item.senderId === data.currentUserId)), [data]);
  const visible = tab === "received" ? received : sent;

  async function openMessage(message: ConversationEntry): Promise<void> {
    setSelected(message);
    if (message.senderId !== data.currentUserId) await createClient().rpc("mark_conversation_read", { target_conversation_id: message.conversationId });
  }

  function startReply(message: ConversationEntry): void {
    setReplyTo(message.conversationId);
    setSubject(subjectFor(data, message.conversationId));
    setBody("");
    setSelected(null);
    setTab("compose");
  }

  function startNew(): void {
    setReplyTo(null); setSubject(""); setBody(""); setSelected(null); setTab("compose");
  }

  async function send(): Promise<void> {
    const text = body.trim();
    if (!text || (!replyTo && !subject.trim())) return;
    setBusy(true);
    const client = createClient();
    let conversationId = replyTo;
    if (!conversationId) {
      const recipient = data.targets[0];
      if (!recipient) { setBusy(false); return showToast({ title: "لا يوجد حساب إدارة متاح", description: "تواصل(ي) مع الإدارة لإعداد الحساب.", tone: "info" }); }
      const created = await client.rpc("create_direct_conversation", { target_user_id: recipient.id, target_subject: subject.trim() });
      if (created.error || !created.data) { setBusy(false); return showToast({ title: "تعذر إنشاء الرسالة", tone: "info" }); }
      conversationId = created.data;
    }
    const result = await client.rpc("send_conversation_message", { target_conversation_id: conversationId, target_body: text, target_client_id: crypto.randomUUID() });
    setBusy(false);
    if (result.error) return showToast({ title: "تعذر إرسال الرسالة", description: "تحقق من الاتصال ثم حاول مجددًا.", tone: "info" });
    showToast({ title: "تم إرسال الرسالة إلى الإدارة", tone: "success" });
    window.location.reload();
  }

  return <div className="teacher-mailbox">
    <header className="teacher-page-head"><span>التواصل مع الإدارة</span><h1>المراسلات</h1></header>
    <nav className="teacher-mail-tabs" aria-label="أقسام المراسلات">
      <button type="button" className={tab === "received" ? "is-active" : undefined} onClick={() => { setTab("received"); setSelected(null); }}><MailOpen size={18} />الواردة</button>
      <button type="button" className={tab === "sent" ? "is-active" : undefined} onClick={() => { setTab("sent"); setSelected(null); }}><Mail size={18} />المرسلة</button>
      <button type="button" className={tab === "compose" ? "is-active" : undefined} onClick={startNew}><PenLine size={18} />رسالة جديدة</button>
    </nav>
    {tab === "compose" ? <section className="teacher-mail-compose"><h2>{replyTo ? "الرد على الإدارة" : "رسالة جديدة"}</h2><div className="teacher-mail-recipient"><span>المرسل إليه</span><strong>الإدارة</strong></div>{!replyTo ? <Input label="الموضوع" maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} /> : <p className="teacher-mail-subject">{subject}</p>}<label className="ui-field"><span className="ui-field__label">الرسالة</span><textarea autoFocus aria-label="الرسالة" maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} /></label><Button disabled={!body.trim() || (!replyTo && !subject.trim())} loading={busy} onClick={() => void send()}><Send size={18} />إرسال</Button></section>
      : selected ? <MailReader data={data} message={selected} onBack={() => setSelected(null)} onReply={() => startReply(selected)} />
      : <MailList data={data} items={visible} received={tab === "received"} onOpen={(message) => void openMessage(message)} />}
  </div>;
}

function MailList({ data, items, received, onOpen }: { data: MessagingWorkspaceData; items: ConversationEntry[]; received: boolean; onOpen: (message: ConversationEntry) => void }) {
  if (!items.length) return <EmptyState title={received ? "لا توجد رسائل واردة" : "لا توجد رسائل مرسلة"} description="ستظهر المراسلات الإدارية هنا." icon={Mail} />;
  return <section className="teacher-mail-list">{items.map((message) => { const conversation = data.conversations.find(({ id }) => id === message.conversationId); const unread = received && Boolean(conversation?.unread); return <button type="button" className={unread ? "is-unread" : undefined} key={message.id} onClick={() => onOpen(message)}><span className="teacher-mail-status" aria-label={unread ? "غير مقروء" : "مقروء"} /><div><strong>{received ? message.senderName : "الإدارة"}</strong><b>{conversation?.subject ?? "مراسلة إدارية"}</b><p>{excerpt(message.body)}</p></div><time>{formatDate(message.createdAt)}<small>{formatTime(message.createdAt)}</small></time></button>; })}</section>;
}

function MailReader({ data, message, onBack, onReply }: { data: MessagingWorkspaceData; message: ConversationEntry; onBack: () => void; onReply: () => void }) {
  const received = message.senderId !== data.currentUserId;
  return <article className="teacher-mail-reader"><button type="button" className="teacher-mail-back" onClick={onBack}>العودة إلى القائمة</button><header><span>{received ? `من: ${message.senderName}` : "إلى: الإدارة"}</span><h2>{subjectFor(data, message.conversationId)}</h2><time>{formatDate(message.createdAt)}، {formatTime(message.createdAt)}</time></header><p>{message.body}</p>{received ? <Button onClick={onReply}><Reply size={18} />رد</Button> : null}</article>;
}

function newestFirst(items: ConversationEntry[]): ConversationEntry[] { return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)); }
function subjectFor(data: MessagingWorkspaceData, conversationId: string): string { return data.conversations.find(({ id }) => id === conversationId)?.subject ?? "مراسلة إدارية"; }
function excerpt(value: string): string { return value.length > 95 ? `${value.slice(0, 95)}…` : value; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium" }).format(new Date(value)); }
function formatTime(value: string): string { return new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
