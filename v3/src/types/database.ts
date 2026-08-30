export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  display_name: string;
  locale: string;
  status: "invited" | "active" | "suspended" | "archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type UserRoleRow = {
  user_id: string;
  role: "student" | "parent" | "teacher" | "admin" | "super_admin";
  assigned_by: string | null;
  created_at: string;
};

type AuditLogRow = {
  id: number;
  actor_id: string | null;
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
      audit_logs: ReadonlyTable<AuditLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { required_role: UserRoleRow["role"] };
        Returns: boolean;
      };
    };
    Enums: {
      account_status: ProfileRow["status"];
      app_role: UserRoleRow["role"];
    };
    CompositeTypes: Record<string, never>;
  };
};

// Replace this bootstrap type with `supabase gen types typescript` after linking V3.
