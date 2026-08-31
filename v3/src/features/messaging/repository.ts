import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MessagingWorkspaceData } from "./models";

const emptyData: MessagingWorkspaceData = { currentUserId: null, canManageRequests: false, conversations: [], messages: [], targets: [], requests: [] };

export async function getMessagingWorkspace(): Promise<MessagingWorkspaceData> {
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return emptyData;
  try {
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return emptyData;
    const [membershipResult, requestResult, roleResult] = await Promise.all([
      client.from("conversation_members").select("conversation_id,last_read_at,archived_at").eq("user_id", userId),
      client.from("service_requests").select("id,reference,requester_id,assigned_to,kind,status,priority,title,details,created_at").order("created_at", { ascending: false }).limit(50),
      client.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const memberships = membershipResult.data ?? [];
    const conversationIds = memberships.map((item) => item.conversation_id);
    const requestIds = (requestResult.data ?? []).map((item) => item.id);
    const [conversationResult, memberResult, messageResult, ownSchools, requestEventResult] = await Promise.all([
      conversationIds.length ? client.from("conversations").select("id,subject,last_message_at,created_at").in("id", conversationIds).order("last_message_at", { ascending: false, nullsFirst: false }) : Promise.resolve({ data: [] }),
      conversationIds.length ? client.from("conversation_members").select("conversation_id,user_id").in("conversation_id", conversationIds) : Promise.resolve({ data: [] }),
      conversationIds.length ? client.from("conversation_messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id", conversationIds).order("created_at").limit(500) : Promise.resolve({ data: [] }),
      client.from("school_memberships").select("school_id").eq("user_id", userId).eq("status", "active"),
      requestIds.length ? client.from("service_request_events").select("id,request_id,event_kind,from_status,to_status,note,created_at").in("request_id", requestIds).order("created_at") : Promise.resolve({ data: [] }),
    ]);
    const memberRows = memberResult.data ?? [];
    const relatedIds = [...new Set(memberRows.map((item) => item.user_id))];
    const schoolIds = (ownSchools.data ?? []).map((item) => item.school_id);
    const candidateMemberships = schoolIds.length ? await client.from("school_memberships").select("user_id").in("school_id", schoolIds).eq("status", "active") : { data: [] };
    const candidateIds = [...new Set((candidateMemberships.data ?? []).map((item) => item.user_id).filter((id) => id !== userId))];
    const requestPersonIds = (requestResult.data ?? []).flatMap((item) => [item.requester_id, item.assigned_to]).filter((id): id is string => Boolean(id));
    const profileIds = [...new Set([...relatedIds, ...candidateIds, ...requestPersonIds])];
    const profiles = profileIds.length ? await client.from("profiles").select("id,display_name,status").in("id", profileIds) : { data: [] };
    const names = new Map((profiles.data ?? []).map((item) => [item.id, item.display_name]));
    const allowed = await Promise.all(candidateIds.slice(0, 250).map(async (id) => (await client.rpc("can_message_user", { target_user_id: id })).data ? id : null));
    const messageRows = messageResult.data ?? [];
    const attachmentResult = messageRows.length ? await client.from("message_attachments").select("id,message_id,file_name,mime_type,size_bytes").in("message_id", messageRows.map((item) => item.id)) : { data: [] };
    const messages = messageRows.map((item) => ({ id: item.id, conversationId: item.conversation_id, senderId: item.sender_id, senderName: names.get(item.sender_id) ?? "مستخدم", body: item.body, createdAt: item.created_at, attachments: (attachmentResult.data ?? []).filter((file) => file.message_id === item.id).map((file) => ({ id: file.id, messageId: file.message_id, fileName: file.file_name, mimeType: file.mime_type, sizeBytes: file.size_bytes })) }));
    const membershipByConversation = new Map(memberships.map((item) => [item.conversation_id, item]));
    return {
      currentUserId: userId,
      canManageRequests: (roleResult.data ?? []).some((item) => item.role === "admin" || item.role === "direction"),
      conversations: (conversationResult.data ?? []).map((item) => {
        const membership = membershipByConversation.get(item.id);
        const participants = memberRows.filter((member) => member.conversation_id === item.id && member.user_id !== userId);
        const latestOtherMessage = [...messages].reverse().find((message) => message.conversationId === item.id && message.senderId !== userId);
        return { id: item.id, subject: item.subject, participantNames: participants.map((member) => names.get(member.user_id) ?? "مستخدم"), unread: Boolean(latestOtherMessage && (!membership?.last_read_at || latestOtherMessage.createdAt > membership.last_read_at)), archived: Boolean(membership?.archived_at), lastMessageAt: item.last_message_at ?? item.created_at };
      }),
      messages,
      targets: allowed.filter((id): id is string => Boolean(id)).map((id) => ({ id, name: names.get(id) ?? "مستخدم" })),
      requests: (requestResult.data ?? []).map((item) => ({ id: item.id, reference: item.reference, requesterName: names.get(item.requester_id) ?? "مستخدم", assignedName: item.assigned_to ? names.get(item.assigned_to) ?? "مستخدم" : null, kind: item.kind, status: item.status, priority: item.priority, title: item.title, details: item.details, createdAt: item.created_at, events: (requestEventResult.data ?? []).filter((event) => event.request_id === item.id).map((event) => ({ id: event.id, requestId: event.request_id, eventKind: event.event_kind, fromStatus: event.from_status, toStatus: event.to_status, note: event.note, createdAt: event.created_at })) })),
    };
  } catch { return emptyData; }
}
