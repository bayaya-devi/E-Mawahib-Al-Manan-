import type { DatabaseRequestPriority, DatabaseServiceRequestKind, DatabaseServiceRequestStatus } from "@/types/database";

export type ConversationSummary = { id: string; subject: string; participantNames: string[]; unread: boolean; archived: boolean; lastMessageAt: string | null };
export type ConversationAttachment = { id: string; messageId: number; fileName: string; mimeType: string; sizeBytes: number };
export type ConversationEntry = { id: number; conversationId: string; senderId: string; senderName: string; body: string; createdAt: string; attachments: ConversationAttachment[] };
export type MessagingTarget = { id: string; name: string };
export type ServiceRequestEventItem = { id: number; requestId: string; eventKind: string; fromStatus: DatabaseServiceRequestStatus | null; toStatus: DatabaseServiceRequestStatus | null; note: string | null; createdAt: string };
export type ServiceRequestItem = { id: string; reference: string; requesterName: string; assignedName: string | null; kind: DatabaseServiceRequestKind; status: DatabaseServiceRequestStatus; priority: DatabaseRequestPriority; title: string; details: string | null; createdAt: string; events: ServiceRequestEventItem[] };
export type MessagingWorkspaceData = { currentUserId: string | null; canManageRequests: boolean; conversations: ConversationSummary[]; messages: ConversationEntry[]; targets: MessagingTarget[]; requests: ServiceRequestItem[] };
