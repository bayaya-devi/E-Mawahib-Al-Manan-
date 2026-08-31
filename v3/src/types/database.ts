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
export type DatabaseRecitationAppreciation = "excellent" | "very_good" | "good" | "needs_review" | "insufficient";
export type DatabaseWorkflowStatus = "draft" | "submitted" | "seen" | "in_review" | "approved" | "rejected" | "resolved" | "cancelled";
export type DatabaseTeacherRequestKind = "absence" | "leave" | "salary_problem" | "equipment" | "schedule" | "general";

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
type CourseSessionRow = { id: string; class_id: string; teacher_id: string; starts_at: string; ends_at: string; title: string; location: string | null; status: "scheduled" | "completed" | "cancelled"; created_at: string };
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
type UserNotificationRow = { id: string; user_id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };
type AuthorizedDocumentRow = { id: string; student_id: string; title: string; storage_path: string; visible_to_family: boolean; uploaded_by: string; created_at: string };
type TeacherSessionRunRow = { id: string; course_session_id: string; class_id: string; teacher_id: string; status: DatabaseTeacherSessionStatus; started_at: string; ended_at: string | null; created_at: string };
type TeacherSessionStudentRow = { run_id: string; student_id: string; attendance: DatabaseAttendanceStatus; minutes_late: number; processed_at: string | null; behavior: "excellent" | "good" | "mixed" | "difficult" | null; difficulty_flags: Json; teacher_note: string | null; updated_at: string };
type TeacherRecitationRow = { id: string; run_id: string; student_id: string; surah_number: number; verse_from: number; verse_to: number; appreciation: DatabaseRecitationAppreciation; comment: string | null; recorded_by: string; recorded_at: string };
type TeacherSessionReportRow = { id: string; run_id: string; teacher_id: string; class_id: string; status: DatabaseWorkflowStatus; program_status: "completed" | "partial" | "not_completed" | null; present_count: number; absent_count: number; late_count: number; behavior: "excellent" | "good" | "mixed" | "difficult" | null; difficulty_flags: Json; follow_up_students: Json; incident: boolean; incident_summary: string | null; equipment: "ready" | "missing" | "damaged" | null; equipment_details: string | null; optional_note: string | null; submitted_at: string | null; seen_at: string | null; created_at: string; updated_at: string };
type StaffMessageRow = { id: string; school_id: string; sender_id: string; recipient_id: string; subject: string; body: string; related_request_id: string | null; read_at: string | null; created_at: string };
type TeacherRequestRow = { id: string; school_id: string; teacher_id: string; kind: DatabaseTeacherRequestKind; status: DatabaseWorkflowStatus; title: string; details: string | null; starts_on: string | null; ends_on: string | null; admin_response: string | null; resolved_by: string | null; submitted_at: string; updated_at: string; resolved_at: string | null };
type TeacherSalaryRecordRow = { id: string; school_id: string; teacher_id: string; period_month: string; gross_amount: number; deductions: number; net_amount: number; currency: string; status: "pending" | "paid" | "issue_reported" | "resolved"; paid_at: string | null; note: string | null; created_at: string; updated_at: string };
type TeacherDocumentRow = { id: string; teacher_id: string; title: string; category: "contract" | "payslip" | "certificate" | "policy" | "other"; storage_path: string; visible_from: string; expires_at: string | null; uploaded_by: string; created_at: string };

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
      admin_review_teacher_request: { Args: { target_request_id: string; target_status: DatabaseWorkflowStatus; target_response?: string | null }; Returns: undefined };
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
    };
    CompositeTypes: Record<string, never>;
  };
};

// Replace this bootstrap type with `supabase gen types typescript` after linking V3.
