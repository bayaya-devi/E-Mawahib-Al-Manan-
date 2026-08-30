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
    };
    CompositeTypes: Record<string, never>;
  };
};

// Replace this bootstrap type with `supabase gen types typescript` after linking V3.
