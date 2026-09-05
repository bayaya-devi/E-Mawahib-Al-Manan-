export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DatabaseAppRole = "student" | "parent" | "teacher" | "admin" | "direction";
export type DatabaseAccountStatus = "pending" | "active" | "suspended" | "archived";
export type DatabaseMembershipStatus = DatabaseAccountStatus;
export type DatabasePublicLocale = "ar" | "fr" | "en" | "amz";
export type DatabasePublicationStatus = "draft" | "published" | "archived";
export type DatabaseLearningProgressStatus = "not_started" | "in_progress" | "mastered" | "review";
export type DatabaseAssignmentStatus = "todo" | "in_progress" | "submitted" | "corrected";
export type DatabaseAttendanceStatus = "present" | "absent" | "late" | "excused";
export type DatabaseTeacherSessionStatus = "in_progress" | "report_pending" | "completed" | "cancelled";
export type DatabaseRecitationAppreciation = "excellent" | "very_good" | "good" | "acceptable" | "needs_review" | "weak" | "insufficient";
export type DatabaseWorkflowStatus = "draft" | "submitted" | "seen" | "in_review" | "approved" | "rejected" | "resolved" | "cancelled";
export type DatabaseTeacherRequestKind = "absence" | "late" | "leave" | "salary_problem" | "equipment" | "schedule" | "general";
export type DatabaseAdminTaskStatus = "open" | "in_progress" | "done" | "dismissed";
export type DatabaseConversationKind = "direct" | "group" | "support";
export type DatabaseServiceRequestKind = "leave" | "absence" | "equipment" | "incident" | "salary_problem" | "administrative_question" | "complaint" | "class_change" | "technical_problem" | "other";
export type DatabaseServiceRequestStatus = "submitted" | "acknowledged" | "in_progress" | "waiting_user" | "resolved" | "rejected" | "cancelled";
export type DatabaseRequestPriority = "low" | "normal" | "high" | "urgent";
export type DatabaseNotificationCategory = "message" | "request" | "assignment" | "learning" | "attendance" | "session" | "administration" | "system";
export type DatabaseContactKind = "email" | "phone";
export type DatabaseContactLabel = "personal" | "professional" | "parent" | "emergency" | "other";
export type DatabaseContactVerificationStatus = "unverified" | "pending" | "verified" | "disabled";
export type DatabaseNotificationPriority = "low" | "normal" | "important" | "urgent";
export type DatabaseNotificationChannel = "in_app" | "push" | "email" | "sms" | "whatsapp";
export type DatabaseNotificationDeliveryStatus = "pending" | "processing" | "sent" | "delivered" | "failed" | "dead_letter" | "cancelled";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  locale: string;
  status: DatabaseAccountStatus;
  suspension_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type UserRoleRow = {
  user_id: string;
  role: DatabaseAppRole;
  assigned_by: string | null;
  created_at: string;
};

type SchoolRow = {
  id: string;
  name: string;
  code: string;
  status: DatabaseMembershipStatus;
  created_at: string;
  updated_at: string;
};

type SchoolMembershipRow = {
  school_id: string;
  user_id: string;
  status: DatabaseMembershipStatus;
  joined_at: string;
  ended_at: string | null;
  created_by: string | null;
};

type PersonProfileRow = {
  user_id: string;
  created_at: string;
  updated_at: string;
};

type StudentProfileRow = PersonProfileRow & {
  student_number: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "unspecified" | null;
  accessibility_notes: string | null;
};

type ParentProfileRow = PersonProfileRow & { phone: string | null };
type TeacherProfileRow = PersonProfileRow & {
  employee_number: string | null;
  phone: string | null;
};
type AdminProfileRow = PersonProfileRow & { job_title: string | null };

type FamilyRelationshipRow = {
  parent_id: string;
  student_id: string;
  relationship: "mother" | "father" | "guardian" | "other";
  status: DatabaseMembershipStatus;
  is_primary: boolean;
  created_at: string;
  created_by: string | null;
};

type ClassRow = {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
  capacity: number | null;
  status: DatabaseMembershipStatus;
  created_at: string;
  updated_at: string;
  academic_year_id: string | null;
};

type ClassEnrollmentRow = {
  id: string;
  class_id: string;
  student_id: string;
  status: "active" | "completed" | "withdrawn" | "suspended";
  enrolled_at: string;
  ended_at: string | null;
  created_by: string | null;
};

type ClassTeacherAssignmentRow = {
  id: string;
  class_id: string;
  teacher_id: string;
  assignment_kind: "primary" | "assistant" | "substitute";
  status: DatabaseMembershipStatus;
  assigned_at: string;
  ended_at: string | null;
  created_by: string | null;
};

type AuditLogRow = {
  id: number;
  actor_id: string | null;
  school_id: string | null;
  request_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  occurred_at: string;
};

type SiteProfileRow = {
  id: string; school_id: string; phone: string | null; email: string | null;
  map_url: string | null; minimum_age: number | null; monthly_fee: number | null;
  registration_open: boolean; updated_by: string | null; created_at: string; updated_at: string;
};
type SiteProfileTranslationRow = {
  profile_id: string; locale: DatabasePublicLocale; name: string; tagline: string;
  description: string; address: string | null; registration_note: string | null;
};
type PublicCategoryRow = {
  id: string; school_id: string; slug: string; sort_order: number; active: boolean; created_at: string;
};
type PublicCategoryTranslationRow = { category_id: string; locale: DatabasePublicLocale; name: string };
type PublicProgramRow = {
  id: string; school_id: string; slug: string; status: DatabasePublicationStatus;
  image_url: string | null; sort_order: number; published_at: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
};
type PublicProgramTranslationRow = {
  program_id: string; locale: DatabasePublicLocale; title: string; summary: string; body: string | null;
};
type PublicScheduleRow = {
  id: string; school_id: string; program_id: string | null; audience: string;
  day_of_week: number; starts_at: string; ends_at: string; location: string | null;
  active: boolean; effective_from: string | null; effective_to: string | null;
  updated_by: string; created_at: string; updated_at: string;
};
type PublicScheduleTranslationRow = { schedule_id: string; locale: DatabasePublicLocale; title: string; notes: string | null };
type PublicNewsRow = {
  id: string; school_id: string; category_id: string | null; status: DatabasePublicationStatus;
  image_url: string | null; event_date: string | null; published_at: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
};
type PublicNewsTranslationRow = {
  news_id: string; locale: DatabasePublicLocale; slug: string; title: string; excerpt: string; body: string;
};
type PublicReplayRow = {
  id: string; school_id: string; status: DatabasePublicationStatus; video_url: string;
  thumbnail_url: string | null; speaker: string | null; event_date: string | null;
  featured: boolean; views_count: number; likes_count: number; published_at: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
};
type PublicReplayTranslationRow = {
  replay_id: string; locale: DatabasePublicLocale; slug: string; title: string; description: string;
};
type PublicReplayCategoryRow = { replay_id: string; category_id: string };

type QuranSurahRow = { number: number; slug: string; name_arabic: string; name_latin: string; verse_count: number; source_label: string; checksum: string; created_at: string };
type QuranVerseRow = { surah_number: number; verse_number: number; canonical_text: string; audio_code: string; checksum: string };
type QuranAudioTrackRow = { id: string; reciter_key: string; reciter_name: string; riwaya: string; url_template: string; fallback_url_template: string | null; active: boolean; created_at: string };
type CourseSessionRow = { id: string; class_id: string; teacher_id: string; room_id: string | null; starts_at: string; ends_at: string; title: string; location: string | null; status: "scheduled" | "completed" | "cancelled"; created_at: string };
type AttendanceRecordRow = { id: string; session_id: string; student_id: string; status: DatabaseAttendanceStatus; minutes_late: number; recorded_by: string; recorded_at: string };
type SchoolAnnouncementRow = { id: string; school_id: string; class_id: string | null; title: string; body: string; audience: "all" | "students" | "families" | "teachers"; published_at: string; expires_at: string | null; created_by: string };
type SchoolEventRow = { id: string; school_id: string; class_id: string | null; title: string; description: string | null; starts_at: string; ends_at: string | null; created_by: string };
type LearningGoalRow = { id: string; student_id: string; surah_number: number; verse_from: number; verse_to: number; target_date: string | null; completed_at: string | null; created_by: string | null; created_at: string };
type StudentSurahProgressRow = { student_id: string; surah_number: number; status: DatabaseLearningProgressStatus; completion_percent: number; highest_completed_step: number; stars: number; started_at: string | null; mastered_at: string | null; last_activity_at: string | null; updated_at: string };
type StudentVerseProgressRow = { student_id: string; surah_number: number; verse_number: number; status: DatabaseLearningProgressStatus; successful_attempts: number; error_count: number; last_practised_at: string | null };
type ReviewPassageRow = { id: string; student_id: string; surah_number: number; verse_from: number; verse_to: number; reason: string | null; due_at: string | null; resolved_at: string | null; created_at: string };
type LearningEventRow = { id: number; student_id: string; event_kind: string; surah_number: number | null; metadata: Json; occurred_at: string };
type AssignmentRow = { id: string; school_id: string; class_id: string | null; student_id: string | null; teacher_id: string; title: string; instructions: string | null; surah_number: number | null; verse_from: number | null; verse_to: number | null; due_at: string | null; created_at: string };
type AssignmentSubmissionRow = { assignment_id: string; student_id: string; status: DatabaseAssignmentStatus; response: string | null; submitted_at: string | null; corrected_at: string | null; teacher_feedback: string | null; updated_at: string };
type ExamRow = { id: string; class_id: string | null; title: string; juz_number: number | null; starts_at: string | null; created_by: string; created_at: string };
type ExamResultRow = { exam_id: string; student_id: string; score: number | null; appreciation: string | null; completed_at: string | null };
type GameAttemptRow = { id: string; student_id: string; kind: string; surah_number: number | null; score: number; duration_ms: number | null; completed: boolean; created_at: string };
type ValidatedLearningContentRow = { id: string; school_id: string | null; kind: string; prompt: string; answer: string; distractors: Json; source_reference: string; validated_by: string; active: boolean; created_at: string };
type RecitationAttemptRow = { id: string; student_id: string; surah_number: number; verse_from: number; verse_to: number; status: "recording" | "processing" | "completed" | "inconclusive" | "failed"; transcript: string | null; transcript_confidence: number | null; audio_storage_path: string | null; asr_engine: string | null; started_at: string; completed_at: string | null };
type RecitationResultRow = { attempt_id: string; memorization_score: number | null; matched_words: number; expected_words: number; is_conclusive: boolean; recommendation: string | null; acoustic_tajwid_status: "not_evaluated"; analysed_at: string };
type RecitationErrorRow = { id: number; attempt_id: string; verse_number: number | null; kind: string; expected_text: string | null; observed_text: string | null; word_position: number | null; confidence: number | null };
type UserNotificationRow = { id: string; user_id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string; category: DatabaseNotificationCategory; entity_type: string | null; entity_id: string | null; dedup_key: string | null; event_id: string | null; priority: DatabaseNotificationPriority; archived_at: string | null; expires_at: string | null };
type AuthorizedDocumentRow = { id: string; student_id: string; title: string; storage_path: string; visible_to_family: boolean; uploaded_by: string; created_at: string };
type TeacherSessionRunRow = { id: string; course_session_id: string; class_id: string; teacher_id: string; status: DatabaseTeacherSessionStatus; started_at: string; ended_at: string | null; created_at: string };
type TeacherSessionStudentRow = { run_id: string; student_id: string; attendance: DatabaseAttendanceStatus; minutes_late: number; processed_at: string | null; behavior: "excellent" | "good" | "mixed" | "difficult" | null; difficulty_flags: Json; teacher_note: string | null; updated_at: string };
type TeacherRecitationRow = { id: string; run_id: string; student_id: string; surah_number: number; verse_from: number; verse_to: number; appreciation: DatabaseRecitationAppreciation; comment: string | null; recorded_by: string; recorded_at: string };
type TeacherSessionReportRow = { id: string; run_id: string; teacher_id: string; class_id: string; status: DatabaseWorkflowStatus; program_status: "completed" | "partial" | "not_completed" | null; present_count: number; absent_count: number; late_count: number; behavior: "excellent" | "good" | "mixed" | "difficult" | null; difficulty_flags: Json; follow_up_students: Json; incident: boolean; incident_summary: string | null; equipment: "ready" | "missing" | "damaged" | null; equipment_details: string | null; optional_note: string | null; submitted_at: string | null; seen_at: string | null; created_at: string; updated_at: string };
type StaffMessageRow = { id: string; school_id: string; sender_id: string; recipient_id: string; subject: string; body: string; related_request_id: string | null; read_at: string | null; created_at: string };
type TeacherRequestRow = { id: string; school_id: string; teacher_id: string; kind: DatabaseTeacherRequestKind; status: DatabaseWorkflowStatus; title: string; details: string | null; starts_on: string | null; ends_on: string | null; admin_response: string | null; resolved_by: string | null; submitted_at: string; updated_at: string; resolved_at: string | null };
type TeacherSalaryRecordRow = { id: string; school_id: string; teacher_id: string; period_month: string; gross_amount: number; deductions: number; net_amount: number; currency: string; status: "pending" | "paid" | "issue_reported" | "resolved"; paid_at: string | null; note: string | null; created_at: string; updated_at: string };
type TeacherDocumentRow = { id: string; teacher_id: string; title: string; category: "contract" | "payslip" | "certificate" | "policy" | "other"; storage_path: string; visible_from: string; expires_at: string | null; uploaded_by: string; created_at: string };
type TeacherStudentNoteRow = { id: string; student_id: string; teacher_id: string; content: string; created_at: string };
type AcademicYearRow = { id: string; school_id: string; name: string; starts_on: string; ends_on: string; active: boolean; created_by: string; created_at: string };
type SchoolRoomRow = { id: string; school_id: string; name: string; capacity: number | null; location_note: string | null; active: boolean; created_at: string };
type StudentDigitalFileRow = { student_id: string; school_id: string; guardian_phone: string | null; payment_required: boolean; monthly_fee: number | null; identity_document_received: boolean; birth_certificate_received: boolean; guardian_identity_received: boolean; medical_or_accessibility_notes: string | null; administrative_notes: string | null; updated_by: string; updated_at: string };
type StaffProfileRow = { user_id: string; school_id: string; employee_number: string | null; job_title: string; phone: string | null; hired_on: string | null; employment_status: DatabaseMembershipStatus; updated_at: string };
type SchoolIncidentRow = { id: string; school_id: string; student_id: string | null; teacher_id: string | null; session_report_id: string | null; category: string; severity: number; summary: string; status: "open" | "in_review" | "resolved" | "dismissed"; occurred_at: string; created_by: string; resolved_by: string | null; resolved_at: string | null; created_at: string; updated_at: string };
type InventoryItemRow = { id: string; school_id: string; name: string; category: string; asset_code: string | null; quantity: number; minimum_quantity: number; status: "available" | "assigned" | "maintenance" | "retired"; room_id: string | null; purchase_date: string | null; purchase_amount: number | null; notes: string | null; updated_at: string };
type FinanceTransactionRow = { id: string; school_id: string; direction: "income" | "expense"; category: string; amount: number; currency: string; occurred_on: string; description: string | null; student_id: string | null; teacher_id: string | null; created_by: string; created_at: string };
type SchoolDocumentRow = { id: string; school_id: string; title: string; category: string; storage_path: string; related_user_id: string | null; visible_to_related_user: boolean; uploaded_by: string; created_at: string };
type AdminPermissionGrantRow = { user_id: string; permission: "people" | "academics" | "attendance" | "hr" | "finance" | "inventory" | "content" | "accounts" | "audit"; school_id: string; granted_by: string; granted_at: string };
type AdminTaskRow = { id: string; school_id: string; kind: string; priority: number; title: string; reason: string; href: string | null; entity_type: string | null; entity_id: string | null; status: DatabaseAdminTaskStatus; assigned_to: string | null; due_at: string | null; resolved_by: string | null; resolved_at: string | null; created_at: string; updated_at: string };
type ConversationRow = { id: string; school_id: string; kind: DatabaseConversationKind; subject: string; created_by: string; last_message_at: string | null; created_at: string };
type ConversationMemberRow = { conversation_id: string; user_id: string; joined_at: string; last_read_at: string | null; archived_at: string | null };
type ConversationMessageRow = { id: number; conversation_id: string; sender_id: string; body: string; client_id: string; edited_at: string | null; created_at: string };
type MessageAttachmentRow = { id: string; message_id: number; storage_path: string; file_name: string; mime_type: string; size_bytes: number; checksum: string; created_at: string };
type ServiceRequestRow = { id: string; reference: string; school_id: string; requester_id: string; client_id: string | null; kind: DatabaseServiceRequestKind; status: DatabaseServiceRequestStatus; priority: DatabaseRequestPriority; title: string; details: string | null; assigned_to: string | null; due_at: string | null; resolved_at: string | null; created_at: string; updated_at: string };
type ServiceRequestEventRow = { id: number; request_id: string; actor_id: string; event_kind: string; from_status: DatabaseServiceRequestStatus | null; to_status: DatabaseServiceRequestStatus | null; note: string | null; created_at: string };
type NotificationPreferenceRow = { user_id: string; category: DatabaseNotificationCategory; in_app: boolean; browser: boolean; realtime: boolean; push: boolean; email: boolean; sms: boolean; whatsapp: boolean; digest_frequency: "immediate" | "daily" | "weekly" | "never"; quiet_hours_start: string | null; quiet_hours_end: string | null; updated_at: string };
type PushSubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth_secret: string; user_agent: string | null; last_used_at: string; created_at: string };
type ContactPointRow = { id: string; kind: DatabaseContactKind; normalized_value: string; display_value: string; country_code: string | null; verification_status: DatabaseContactVerificationStatus; verified_at: string | null; status: DatabaseMembershipStatus; created_by: string | null; created_at: string; updated_at: string };
type UserContactLinkRow = { id: string; contact_point_id: string; user_id: string; label: DatabaseContactLabel; relationship: string | null; is_primary: boolean; notification_enabled: boolean; use_for_login: boolean; use_for_notifications: boolean; is_emergency: boolean; created_by: string | null; created_at: string; updated_at: string };
type UserDeviceRow = { id: string; user_id: string; device_key: string; name: string; platform: string | null; browser: string | null; push_subscription_id: string | null; enabled: boolean; last_seen_at: string; created_at: string; updated_at: string };
type NotificationPolicyRow = { id: string; school_id: string; event_type: string; minimum_priority: DatabaseNotificationPriority; mandatory_channels: DatabaseNotificationChannel[]; notify_student: boolean; notify_guardians: boolean; bypass_quiet_hours: boolean; escalation_after: string | null; cooldown: string; enabled: boolean; updated_by: string | null; created_at: string; updated_at: string };
type NotificationTemplateRow = { id: string; school_id: string | null; event_type: string; locale: DatabasePublicLocale; channel: DatabaseNotificationChannel; title_template: string; body_template: string; active: boolean; updated_by: string | null; created_at: string; updated_at: string };
type NotificationEventRow = { id: string; school_id: string | null; event_type: string; category: DatabaseNotificationCategory; priority: DatabaseNotificationPriority; subject_user_id: string | null; class_id: string | null; entity_type: string | null; entity_id: string | null; title: string; body: string; href: string | null; payload: Json; dedup_key: string; scheduled_at: string; expires_at: string | null; processed_at: string | null; created_by: string | null; created_at: string };
type NotificationCampaignRow = { id: string; school_id: string; title: string; body: string; href: string | null; audience: Json; channels: DatabaseNotificationChannel[]; priority: DatabaseNotificationPriority; locale: DatabasePublicLocale; status: "draft" | "scheduled" | "processing" | "sent" | "partially_failed" | "cancelled"; scheduled_at: string | null; expires_at: string | null; estimated_recipients: number; delivered_count: number; failed_count: number; created_by: string; created_at: string; updated_at: string };
type NotificationRecipientRow = { event_id: string; user_id: string; relationship: string; created_at: string };
type NotificationDeliveryRow = { id: string; event_id: string; user_id: string; channel: DatabaseNotificationChannel; contact_point_id: string | null; device_id: string | null; provider: string | null; status: DatabaseNotificationDeliveryStatus; masked_destination: string | null; idempotency_key: string; attempt_count: number; max_attempts: number; next_attempt_at: string; locked_at: string | null; sent_at: string | null; delivered_at: string | null; failed_at: string | null; provider_message_id: string | null; error_code: string | null; error_detail: string | null; created_at: string; updated_at: string };
type ContactVerificationChallengeRow = { id: string; contact_point_id: string; user_id: string; code_digest: string; attempt_count: number; max_attempts: number; expires_at: string; consumed_at: string | null; cancelled_at: string | null; created_at: string };

type ReadonlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

type MutableTable<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: ReadonlyTable<ProfileRow>;
      user_roles: ReadonlyTable<UserRoleRow>;
      schools: ReadonlyTable<SchoolRow>;
      school_memberships: ReadonlyTable<SchoolMembershipRow>;
      student_profiles: ReadonlyTable<StudentProfileRow>;
      parent_profiles: ReadonlyTable<ParentProfileRow>;
      teacher_profiles: ReadonlyTable<TeacherProfileRow>;
      admin_profiles: ReadonlyTable<AdminProfileRow>;
      family_relationships: ReadonlyTable<FamilyRelationshipRow>;
      classes: ReadonlyTable<ClassRow>;
      class_enrollments: ReadonlyTable<ClassEnrollmentRow>;
      class_teacher_assignments: ReadonlyTable<ClassTeacherAssignmentRow>;
      audit_logs: ReadonlyTable<AuditLogRow>;
      public_site_profiles: MutableTable<SiteProfileRow>;
      public_site_profile_translations: MutableTable<SiteProfileTranslationRow>;
      public_categories: MutableTable<PublicCategoryRow>;
      public_category_translations: MutableTable<PublicCategoryTranslationRow>;
      public_programs: MutableTable<PublicProgramRow>;
      public_program_translations: MutableTable<PublicProgramTranslationRow>;
      public_schedules: MutableTable<PublicScheduleRow>;
      public_schedule_translations: MutableTable<PublicScheduleTranslationRow>;
      public_news: MutableTable<PublicNewsRow>;
      public_news_translations: MutableTable<PublicNewsTranslationRow>;
      public_replays: MutableTable<PublicReplayRow>;
      public_replay_translations: MutableTable<PublicReplayTranslationRow>;
      public_replay_categories: MutableTable<PublicReplayCategoryRow>;
      quran_surahs: ReadonlyTable<QuranSurahRow>;
      quran_verses: ReadonlyTable<QuranVerseRow>;
      quran_audio_tracks: ReadonlyTable<QuranAudioTrackRow>;
      course_sessions: ReadonlyTable<CourseSessionRow>;
      attendance_records: ReadonlyTable<AttendanceRecordRow>;
      school_announcements: ReadonlyTable<SchoolAnnouncementRow>;
      school_events: ReadonlyTable<SchoolEventRow>;
      learning_goals: ReadonlyTable<LearningGoalRow>;
      student_surah_progress: ReadonlyTable<StudentSurahProgressRow>;
      student_verse_progress: ReadonlyTable<StudentVerseProgressRow>;
      review_passages: ReadonlyTable<ReviewPassageRow>;
      learning_events: ReadonlyTable<LearningEventRow>;
      assignments: ReadonlyTable<AssignmentRow>;
      assignment_submissions: ReadonlyTable<AssignmentSubmissionRow>;
      exams: ReadonlyTable<ExamRow>;
      exam_results: ReadonlyTable<ExamResultRow>;
      game_attempts: ReadonlyTable<GameAttemptRow>;
      validated_learning_content: ReadonlyTable<ValidatedLearningContentRow>;
      recitation_attempts: ReadonlyTable<RecitationAttemptRow>;
      recitation_results: ReadonlyTable<RecitationResultRow>;
      recitation_errors: ReadonlyTable<RecitationErrorRow>;
      user_notifications: ReadonlyTable<UserNotificationRow>;
      authorized_documents: ReadonlyTable<AuthorizedDocumentRow>;
      teacher_session_runs: ReadonlyTable<TeacherSessionRunRow>;
      teacher_session_students: ReadonlyTable<TeacherSessionStudentRow>;
      teacher_recitations: ReadonlyTable<TeacherRecitationRow>;
      teacher_session_reports: ReadonlyTable<TeacherSessionReportRow>;
      staff_messages: ReadonlyTable<StaffMessageRow>;
      teacher_requests: ReadonlyTable<TeacherRequestRow>;
      teacher_salary_records: ReadonlyTable<TeacherSalaryRecordRow>;
      teacher_documents: ReadonlyTable<TeacherDocumentRow>;
      teacher_student_notes: ReadonlyTable<TeacherStudentNoteRow>;
      academic_years: ReadonlyTable<AcademicYearRow>;
      school_rooms: ReadonlyTable<SchoolRoomRow>;
      student_digital_files: ReadonlyTable<StudentDigitalFileRow>;
      staff_profiles: ReadonlyTable<StaffProfileRow>;
      school_incidents: ReadonlyTable<SchoolIncidentRow>;
      inventory_items: ReadonlyTable<InventoryItemRow>;
      finance_transactions: ReadonlyTable<FinanceTransactionRow>;
      school_documents: ReadonlyTable<SchoolDocumentRow>;
      admin_permission_grants: ReadonlyTable<AdminPermissionGrantRow>;
      admin_tasks: ReadonlyTable<AdminTaskRow>;
      conversations: ReadonlyTable<ConversationRow>;
      conversation_members: ReadonlyTable<ConversationMemberRow>;
      conversation_messages: ReadonlyTable<ConversationMessageRow>;
      message_attachments: ReadonlyTable<MessageAttachmentRow>;
      service_requests: ReadonlyTable<ServiceRequestRow>;
      service_request_events: ReadonlyTable<ServiceRequestEventRow>;
      notification_preferences: ReadonlyTable<NotificationPreferenceRow>;
      push_subscriptions: ReadonlyTable<PushSubscriptionRow>;
      contact_points: ReadonlyTable<ContactPointRow>;
      user_contact_links: ReadonlyTable<UserContactLinkRow>;
      user_devices: ReadonlyTable<UserDeviceRow>;
      notification_policies: ReadonlyTable<NotificationPolicyRow>;
      notification_templates: ReadonlyTable<NotificationTemplateRow>;
      notification_events: ReadonlyTable<NotificationEventRow>;
      notification_campaigns: ReadonlyTable<NotificationCampaignRow>;
      notification_recipients: ReadonlyTable<NotificationRecipientRow>;
      notification_deliveries: ReadonlyTable<NotificationDeliveryRow>;
      contact_verification_challenges: ReadonlyTable<ContactVerificationChallengeRow>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { required_role: DatabaseAppRole };
        Returns: boolean;
      };
      is_administration: { Args: Record<never, never>; Returns: boolean };
      is_school_member: { Args: { target_school_id: string }; Returns: boolean };
      can_manage_school: { Args: { target_school_id: string }; Returns: boolean };
      can_manage_user: { Args: { target_user_id: string }; Returns: boolean };
      parent_has_student: { Args: { target_student_id: string }; Returns: boolean };
      teacher_has_student: { Args: { target_student_id: string }; Returns: boolean };
      can_access_student: { Args: { target_student_id: string }; Returns: boolean };
      can_manage_student: { Args: { target_student_id: string }; Returns: boolean };
      can_access_class: { Args: { target_class_id: string }; Returns: boolean };
      resolve_login_alias: {
        Args: { target_login_alias: string };
        Returns: string | null;
      };
      provision_account_data: {
        Args: {
          target_user_id: string;
          target_login_alias: string;
          target_first_name: string;
          target_last_name: string;
          target_roles: DatabaseAppRole[];
          target_school_id: string;
          actor_user_id: string;
          target_locale?: string;
        };
        Returns: undefined;
      };
      bootstrap_direction_data: {
        Args: {
          target_user_id: string;
          target_login_alias: string;
          target_first_name: string;
          target_last_name: string;
          target_school_name: string;
          target_school_code: string;
          target_locale?: string;
        };
        Returns: string;
      };
      import_v1_learning_progress: {
        Args: {
          target_student_id: string;
          target_source_key: string;
          target_source_fingerprint: string;
          target_raw_payload: Json;
          normalized_rows: Json;
        };
        Returns: boolean;
      };
      record_recitation_attempt: {
        Args: {
          target_surah_number: number;
          target_verse_from: number;
          target_verse_to: number;
          target_transcript: string;
          target_confidence: number | null;
          target_score: number | null;
          target_matched_words: number;
          target_expected_words: number;
          target_conclusive: boolean;
          target_recommendation: string;
          target_errors: Json;
        };
        Returns: string;
      };
      record_quran_practice: {
        Args: { target_surah_number: number; target_verse_number: number; target_success: boolean };
        Returns: undefined;
      };
      update_own_assignment: {
        Args: { target_assignment_id: string; target_status: DatabaseAssignmentStatus; target_response?: string | null };
        Returns: undefined;
      };
      teacher_owns_class: { Args: { target_class_id: string }; Returns: boolean };
      teacher_start_session: { Args: { target_course_session_id: string }; Returns: string };
      teacher_save_attendance: { Args: { target_run_id: string; attendance_rows: Json }; Returns: undefined };
      teacher_record_student_work: {
        Args: {
          target_run_id: string; target_student_id: string; target_surah_number: number;
          target_verse_from: number; target_verse_to: number; target_appreciation: DatabaseRecitationAppreciation;
          target_comment: string; target_behavior: "excellent" | "good" | "mixed" | "difficult";
          target_difficulties: Json; target_create_goal: boolean; target_goal_surah: number;
          target_goal_from: number; target_goal_to: number; target_create_assignment: boolean;
          target_assignment_due: string | null;
        };
        Returns: string;
      };
      teacher_open_session_report: { Args: { target_run_id: string }; Returns: string };
      teacher_submit_session_report: {
        Args: {
          target_report_id: string; target_program_status: "completed" | "partial" | "not_completed";
          target_behavior: "excellent" | "good" | "mixed" | "difficult"; target_difficulties: Json;
          target_follow_up_students: Json; target_incident: boolean; target_incident_summary: string;
          target_equipment: "ready" | "missing" | "damaged"; target_equipment_details: string;
          target_optional_note: string;
        };
        Returns: undefined;
      };
      teacher_create_request: {
        Args: { target_kind: DatabaseTeacherRequestKind; target_title: string; target_details: string; target_starts_on?: string | null; target_ends_on?: string | null };
        Returns: string;
      };
      teacher_cancel_request: { Args: { target_request_id: string }; Returns: undefined };
      teacher_add_student_note: { Args: { target_student_id: string; target_content: string }; Returns: string };
      teacher_assign_quran_work: { Args: { target_student_ids: string[]; target_surah_number: number; target_verse_from: number; target_verse_to: number; target_due_at: string; target_note?: string | null }; Returns: number };
      teacher_cancel_session: { Args: { target_run_id: string }; Returns: undefined };
      teacher_start_class_session: { Args: { target_class_id: string }; Returns: string };
      teacher_can_access_conversation: { Args: { target_conversation_id: string }; Returns: boolean };
      admin_review_teacher_request: { Args: { target_request_id: string; target_status: DatabaseWorkflowStatus; target_response?: string | null }; Returns: undefined };
      admin_resolve_task: { Args: { target_task_id: string; target_status: DatabaseAdminTaskStatus }; Returns: undefined };
      admin_create_incident: { Args: { target_student_id: string | null; target_teacher_id: string | null; target_category: string; target_severity: number; target_summary: string }; Returns: string };
      admin_create_command_record: { Args: { target_kind: string; payload: Json }; Returns: string };
      can_message_user: { Args: { target_user_id: string }; Returns: boolean };
      require_administration_aal2: { Args: Record<never, never>; Returns: undefined };
      is_conversation_member: { Args: { target_conversation_id: string }; Returns: boolean };
      create_direct_conversation: { Args: { target_user_id: string; target_subject: string }; Returns: string };
      send_conversation_message: { Args: { target_conversation_id: string; target_body: string; target_client_id: string }; Returns: number };
      mark_conversation_read: { Args: { target_conversation_id: string }; Returns: undefined };
      register_message_attachment: { Args: { target_message_id: number; target_storage_path: string; target_file_name: string; target_mime_type: string; target_size_bytes: number; target_checksum: string }; Returns: string };
      archive_conversation: { Args: { target_conversation_id: string; target_archived?: boolean }; Returns: undefined };
      create_service_request: { Args: { target_kind: DatabaseServiceRequestKind; target_title: string; target_details?: string | null; target_priority?: DatabaseRequestPriority; target_client_id?: string | null }; Returns: string };
      update_service_request: { Args: { target_request_id: string; target_status: DatabaseServiceRequestStatus; target_note?: string | null; target_assigned_to?: string | null }; Returns: undefined };
      mark_notification_read: { Args: { target_notification_id: string }; Returns: undefined };
      set_notification_preference: { Args: { target_category: DatabaseNotificationCategory; target_in_app: boolean; target_browser: boolean; target_realtime: boolean }; Returns: undefined };
      list_my_contacts: { Args: Record<never, never>; Returns: Array<{ link_id: string; kind: DatabaseContactKind; masked_value: string; label: DatabaseContactLabel; is_primary: boolean; notification_enabled: boolean; use_for_login: boolean; use_for_notifications: boolean; is_emergency: boolean; verification_status: DatabaseContactVerificationStatus }> };
      save_user_contact: { Args: { target_user_id: string; target_kind: DatabaseContactKind; target_normalized_value: string; target_display_value: string; target_country_code: string; target_label: DatabaseContactLabel; target_is_primary?: boolean; target_notification_enabled?: boolean; target_use_for_login?: boolean; target_use_for_notifications?: boolean; target_is_emergency?: boolean; target_relationship?: string | null }; Returns: string };
      remove_user_contact: { Args: { target_link_id: string }; Returns: undefined };
      set_notification_channels: { Args: { target_category: DatabaseNotificationCategory; target_in_app: boolean; target_push: boolean; target_email: boolean; target_sms: boolean; target_whatsapp: boolean; target_digest_frequency?: string; target_quiet_start?: string | null; target_quiet_end?: string | null }; Returns: undefined };
      register_user_device: { Args: { target_device_key: string; target_name: string; target_platform: string; target_browser: string; target_push_subscription_id?: string | null }; Returns: string };
      remove_user_device: { Args: { target_device_id: string }; Returns: undefined };
      mark_all_notifications_read: { Args: Record<never, never>; Returns: undefined };
      archive_notification: { Args: { target_notification_id: string; target_archived?: boolean }; Returns: undefined };
      estimate_notification_audience: { Args: { target_school_id: string; target_audience: Json }; Returns: number };
      create_notification_campaign: { Args: { target_school_id: string; target_title: string; target_body: string; target_href: string; target_audience: Json; target_channels: DatabaseNotificationChannel[]; target_priority: DatabaseNotificationPriority; target_locale?: DatabasePublicLocale; target_scheduled_at?: string; target_expires_at?: string | null }; Returns: string };
      process_due_notification_events: { Args: { target_limit?: number }; Returns: number };
      claim_notification_deliveries: { Args: { target_limit?: number }; Returns: Array<{ delivery_id: string; channel: DatabaseNotificationChannel; destination: string; title: string; body: string; href: string | null; attempt_count: number; provider_payload: Json }> };
      finish_notification_delivery: { Args: { target_delivery_id: string; target_success: boolean; target_provider?: string | null; target_provider_message_id?: string | null; target_error_code?: string | null; target_error_detail?: string | null; target_permanent?: boolean }; Returns: undefined };
      create_contact_verification_challenge: { Args: { target_user_id: string; target_link_id: string; target_code_digest: string }; Returns: Array<{ challenge_id: string; contact_kind: DatabaseContactKind; destination: string }> };
      cancel_contact_verification_challenge: { Args: { target_challenge_id: string; target_user_id: string; target_reason: string }; Returns: undefined };
      verify_contact_verification_challenge: { Args: { target_user_id: string; target_link_id: string; target_code_digest: string }; Returns: boolean };
      save_push_subscription: { Args: { target_device_key: string; target_name: string; target_platform: string; target_browser: string; target_endpoint: string; target_p256dh: string; target_auth_secret: string }; Returns: string };
      disable_push_subscription: { Args: { target_endpoint: string }; Returns: undefined };
      auth_rate_limit_allowed: { Args: { target_keys: string[] }; Returns: boolean };
      record_auth_rate_limit: { Args: { target_keys: string[]; target_success: boolean }; Returns: undefined };
      has_permission: { Args: { required_permission: string }; Returns: boolean };
      is_feature_enabled: { Args: { target_key: string }; Returns: boolean };
      claim_offline_mutation: { Args: { target_id: string; target_kind: string }; Returns: "claimed" | "completed" | "busy" };
      finish_offline_mutation: { Args: { target_id: string; target_success: boolean; target_error_code?: string | null }; Returns: undefined };
      system_diagnostics: { Args: Record<never, never>; Returns: Json };
      set_account_status: {
        Args: {
          target_user_id: string;
          target_status: DatabaseAccountStatus;
          target_suspension_reason: string | null;
          actor_user_id: string;
          target_school_id: string;
        };
        Returns: undefined;
      };
      toggle_public_replay_like: {
        Args: { target_replay_id: string; target_visitor_hash: string; target_network_hash: string };
        Returns: { liked: boolean; likes_count: number }[];
      };
      register_public_replay_view: {
        Args: { target_replay_id: string; target_visitor_hash: string };
        Returns: number;
      };
    };
    Enums: {
      account_status: DatabaseAccountStatus;
      app_role: DatabaseAppRole;
      membership_status: DatabaseMembershipStatus;
      enrollment_status: ClassEnrollmentRow["status"];
      teacher_assignment_kind: ClassTeacherAssignmentRow["assignment_kind"];
      guardian_relationship: FamilyRelationshipRow["relationship"];
      public_locale: DatabasePublicLocale;
      publication_status: DatabasePublicationStatus;
      public_content_kind: "news" | "replay";
      learning_progress_status: DatabaseLearningProgressStatus;
      assignment_status: DatabaseAssignmentStatus;
      attendance_status: DatabaseAttendanceStatus;
      teacher_session_status: DatabaseTeacherSessionStatus;
      recitation_appreciation: DatabaseRecitationAppreciation;
      workflow_status: DatabaseWorkflowStatus;
      teacher_request_kind: DatabaseTeacherRequestKind;
      conversation_kind: DatabaseConversationKind;
      service_request_kind: DatabaseServiceRequestKind;
      service_request_status: DatabaseServiceRequestStatus;
      request_priority: DatabaseRequestPriority;
      notification_category: DatabaseNotificationCategory;
      contact_kind: DatabaseContactKind;
      contact_label: DatabaseContactLabel;
      contact_verification_status: DatabaseContactVerificationStatus;
      notification_priority: DatabaseNotificationPriority;
      notification_channel: DatabaseNotificationChannel;
      notification_delivery_status: DatabaseNotificationDeliveryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// Replace this bootstrap type with `supabase gen types typescript` after linking V3.
