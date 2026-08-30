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

type ReadonlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
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
    };
    Enums: {
      account_status: DatabaseAccountStatus;
      app_role: DatabaseAppRole;
      membership_status: DatabaseMembershipStatus;
      enrollment_status: ClassEnrollmentRow["status"];
      teacher_assignment_kind: ClassTeacherAssignmentRow["assignment_kind"];
      guardian_relationship: FamilyRelationshipRow["relationship"];
    };
    CompositeTypes: Record<string, never>;
  };
};

// Replace this bootstrap type with `supabase gen types typescript` after linking V3.
