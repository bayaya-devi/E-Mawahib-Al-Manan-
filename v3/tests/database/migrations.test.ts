import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const users = {
  studentA: "00000000-0000-4000-8000-000000000001",
  studentB: "00000000-0000-4000-8000-000000000002",
  parentA: "00000000-0000-4000-8000-000000000003",
  teacherA: "00000000-0000-4000-8000-000000000004",
  teacherB: "00000000-0000-4000-8000-000000000005",
  adminA: "00000000-0000-4000-8000-000000000006",
  direction: "00000000-0000-4000-8000-000000000007",
} as const;

const schools = {
  first: "10000000-0000-4000-8000-000000000001",
  second: "10000000-0000-4000-8000-000000000002",
} as const;

const classes = {
  first: "20000000-0000-4000-8000-000000000001",
  second: "20000000-0000-4000-8000-000000000002",
} as const;

const provisionedUsers = {
  student: "30000000-0000-4000-8000-000000000001",
  forbiddenAdmin: "30000000-0000-4000-8000-000000000002",
} as const;

const supabasePrelude = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text unique,
    created_at timestamptz not null default now()
  );
  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
`;

let database: PGlite;

async function applyMigrations() {
  const migrationsDirectory = path.resolve(
    import.meta.dirname,
    "../../supabase/migrations",
  );
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(path.join(migrationsDirectory, migrationFile), "utf8");
    await database.exec(sql);
  }
}

async function runSqlContractTests() {
  const testsDirectory = path.resolve(import.meta.dirname, "../../supabase/tests");
  const testFiles = (await readdir(testsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const testFile of testFiles) {
    const sql = await readFile(path.join(testsDirectory, testFile), "utf8");
    await database.exec(sql);
  }
}

async function seedSecurityScenarios() {
  const userIds = Object.values(users)
    .map((id, index) => `('${id}', 'user${index}@example.test')`)
    .join(",");

  await database.exec(`
    insert into auth.users (id, email) values ${userIds};

    insert into public.profiles (id, display_name, first_name, last_name, status)
    values
      ('${users.studentA}', 'Student A', 'Student', 'A', 'active'),
      ('${users.studentB}', 'Student B', 'Student', 'B', 'active'),
      ('${users.parentA}', 'Parent A', 'Parent', 'A', 'active'),
      ('${users.teacherA}', 'Teacher A', 'Teacher', 'A', 'active'),
      ('${users.teacherB}', 'Teacher B', 'Teacher', 'B', 'active'),
      ('${users.adminA}', 'Admin A', 'Admin', 'A', 'active'),
      ('${users.direction}', 'Direction', 'School', 'Direction', 'active');

    insert into public.user_roles (user_id, role) values
      ('${users.studentA}', 'student'),
      ('${users.studentB}', 'student'),
      ('${users.parentA}', 'parent'),
      ('${users.teacherA}', 'teacher'),
      ('${users.teacherB}', 'teacher'),
      ('${users.adminA}', 'admin'),
      ('${users.direction}', 'direction');

    insert into public.schools (id, name, code) values
      ('${schools.first}', 'First School', 'FIRST'),
      ('${schools.second}', 'Second School', 'SECOND');

    insert into public.school_memberships (school_id, user_id, status) values
      ('${schools.first}', '${users.studentA}', 'active'),
      ('${schools.first}', '${users.parentA}', 'active'),
      ('${schools.first}', '${users.teacherA}', 'active'),
      ('${schools.first}', '${users.adminA}', 'active'),
      ('${schools.first}', '${users.direction}', 'active'),
      ('${schools.second}', '${users.studentB}', 'active'),
      ('${schools.second}', '${users.teacherB}', 'active');

    insert into public.student_profiles (user_id) values
      ('${users.studentA}'), ('${users.studentB}');
    insert into public.parent_profiles (user_id) values ('${users.parentA}');
    insert into public.teacher_profiles (user_id) values
      ('${users.teacherA}'), ('${users.teacherB}');
    insert into public.admin_profiles (user_id) values
      ('${users.adminA}'), ('${users.direction}');

    insert into public.family_relationships (parent_id, student_id, relationship)
    values ('${users.parentA}', '${users.studentA}', 'guardian');

    insert into public.classes (id, school_id, name) values
      ('${classes.first}', '${schools.first}', 'Class A'),
      ('${classes.second}', '${schools.second}', 'Class B');

    insert into public.class_enrollments (class_id, student_id) values
      ('${classes.first}', '${users.studentA}'),
      ('${classes.second}', '${users.studentB}');

    insert into public.class_teacher_assignments (class_id, teacher_id) values
      ('${classes.first}', '${users.teacherA}'),
      ('${classes.second}', '${users.teacherB}');

    insert into public.audit_logs (actor_id, school_id, action, entity_type, entity_id)
    values
      ('${users.adminA}', '${schools.first}', 'test.first', 'profile', '${users.studentA}'),
      ('${users.direction}', '${schools.second}', 'test.second', 'profile', '${users.studentB}');
  `);
}

async function asUser<Row extends Record<string, unknown>>(
  userId: string,
  sql: string,
): Promise<Row[]> {
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await database.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, aal: "aal2" })]);
  await database.exec("set role authenticated");
  try {
    const result = await database.query<Row>(sql);
    return result.rows;
  } finally {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub', '', false)");
    await database.query("select set_config('request.jwt.claims', '', false)");
  }
}

async function runAsUser(userId: string, sql: string): Promise<void> {
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await database.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, aal: "aal2" })]);
  await database.exec("set role authenticated");
  try {
    await database.exec(sql);
  } finally {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub', '', false)");
    await database.query("select set_config('request.jwt.claims', '', false)");
  }
}

async function runAsUserAtAal1(userId: string, sql: string): Promise<void> {
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await database.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, aal: "aal1" })]);
  await database.exec("set role authenticated");
  try { await database.exec(sql); }
  finally { await database.exec("reset role"); await database.query("select set_config('request.jwt.claim.sub', '', false)"); await database.query("select set_config('request.jwt.claims', '', false)"); }
}

async function runAsDatabaseRole(role: "anon" | "service_role", sql: string) {
  await database.exec(`set role ${role}`);
  try {
    return await database.query(sql);
  } finally {
    await database.exec("reset role");
  }
}

describe("V3 migrations and RLS", () => {
  it("persists a complete parent survey and exposes it only to the scoped administration", async () => {
    await runAsUser(users.studentA, "select public.submit_parent_feedback(array[9,8,10,7,9]::smallint[], 'متابعة جيدة')");
    const own = await asUser<{ scores: number[]; comment: string }>(users.studentA, "select scores,comment from public.parent_feedback order by created_at desc limit 1");
    expect(own[0]).toMatchObject({ scores: [9, 8, 10, 7, 9], comment: "متابعة جيدة" });
    expect(await asUser(users.studentB, `select * from public.parent_feedback where student_id='${users.studentA}'`)).toEqual([]);
    const admin = await asUser<{ scores: number[] }>(users.adminA, `select scores from public.parent_feedback where student_id='${users.studentA}'`);
    expect(admin.at(-1)?.scores).toEqual([9, 8, 10, 7, 9]);
    await database.exec(`delete from public.parent_feedback where student_id='${users.studentA}'`);
  });

  it('persists learning per student, rejects direct completion, and awards only once', async () => {
    const state = JSON.stringify({cursor:4,errors:0,attempt:0,failed:false,passed:false});
    const saved = await runAsDatabaseRole('service_role', `select public.save_student_learning('${users.studentA}','surah-96',0,'${state}')`);
    expect(saved.rows).toHaveLength(1);
    const own = await asUser(users.studentA, "select version,state from public.student_learning_sessions where learning_key='surah-96'");
    expect(own[0]?.version).toBe(1);
    expect(await asUser(users.studentB, "select * from public.student_learning_sessions where learning_key='surah-96'")).toEqual([]);
    await expect(asUser(users.studentA,"select public.complete_quran_surah(96::smallint)")).rejects.toThrow(/required_learning_incomplete/);
    await expect(asUser(users.studentA,`select public.save_student_learning('${users.studentA}','surah-96',1,'${state}')`)).rejects.toThrow(/permission denied/);
    await expect(runAsDatabaseRole('service_role',`select public.save_student_learning('${users.studentA}','surah-96',0,'${state}')`)).rejects.toThrow(/learning_version_conflict/);
    const complete = JSON.stringify({cursor:15,errors:1,attempt:0,failed:false,passed:true});
    await runAsDatabaseRole('service_role',`select public.save_student_learning('${users.studentA}','surah-96',1,'${complete}')`);
    await runAsDatabaseRole('service_role',`select public.save_student_learning('${users.studentA}','surah-96',2,'${complete}')`);
    const reward = await database.query<{stars:number;status:string}>(`select stars,status from public.student_surah_progress where student_id='${users.studentA}' and surah_number=96`);
    expect(reward.rows[0]).toEqual({stars:5,status:'mastered'});
    const events = await database.query(`select id from public.learning_events where student_id='${users.studentA}' and surah_number=96 and event_kind='surah_completed'`);
    expect(events.rows).toHaveLength(1);
    await runAsDatabaseRole('service_role',`select public.save_student_learning('${users.studentA}','review-0',0,'${complete}')`);
    expect((await asUser(users.studentA,"select state from public.student_learning_sessions where learning_key='review-0'"))[0]?.state).toMatchObject({passed:true});
    await database.exec(`delete from public.student_learning_sessions where student_id='${users.studentA}'; delete from public.learning_events where student_id='${users.studentA}' and surah_number=96; delete from public.student_surah_progress where student_id='${users.studentA}' and surah_number=96;`);
  });
  beforeAll(async () => {
    database = new PGlite();
    await database.exec(supabasePrelude);
    await applyMigrations();
    await runSqlContractTests();
    await seedSecurityScenarios();
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("creates the exact account statuses and roles", async () => {
    const statuses = await database.query<{ enumlabel: string }>(`
      select enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'account_status'
      order by enumsortorder
    `);
    const roles = await database.query<{ enumlabel: string }>(`
      select enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'app_role'
      order by enumsortorder
    `);

    expect(statuses.rows.map(({ enumlabel }) => enumlabel)).toEqual([
      "pending",
      "active",
      "suspended",
      "archived",
    ]);
    expect(roles.rows.map(({ enumlabel }) => enumlabel)).toEqual([
      "student",
      "parent",
      "teacher",
      "admin",
      "direction",
    ]);
  });

  it("contains no business-table password column", async () => {
    const result = await database.query<{ table_name: string; column_name: string }>(`
      select table_name, column_name
      from information_schema.columns
      where table_schema in ('public', 'private')
        and column_name in (
          'password',
          'mot_de_passe',
          'encrypted_password',
          'password_hash',
          'password_ciphertext',
          'password_value'
        )
    `);
    expect(result.rows).toEqual([]);
  });

  it("enables RLS and removes client writes on every public business table", async () => {
    const expectedTables = [
      "academic_years",
      "admin_permission_grants",
      "admin_profiles",
      "admin_tasks",
      "app_schema_versions",
      "assignment_submissions",
      "assignments",
      "attendance_records",
      "audit_logs",
      "authorized_documents",
      "class_enrollments",
      "class_teacher_assignments",
      "classes",
      "contact_points",
      "contact_verification_challenges",
      "conversation_members",
      "conversation_messages",
      "conversations",
      "course_sessions",
      "exam_results",
      "exams",
      "family_relationships",
      "feature_flags",
      "finance_transactions",
      "game_attempts",
      "inventory_items",
      "learning_events",
      "learning_goals",
      "message_attachments",
      "notification_campaigns",
      "notification_deliveries",
      "notification_events",
      "notification_policies",
      "notification_preferences",
      "notification_recipients",
      "notification_templates",
      "offline_mutation_receipts",
      "parent_feedback",
      "parent_profiles",
      "permissions",
      "profiles",
      "public_categories",
      "public_category_translations",
      "public_news",
      "public_news_translations",
      "public_program_translations",
      "public_programs",
      "public_replay_categories",
      "public_replay_translations",
      "public_replays",
      "public_schedule_translations",
      "public_schedules",
      "public_site_profile_translations",
      "public_site_profiles",
      "push_subscriptions",
      "quran_audio_tracks",
      "quran_surahs",
      "quran_verses",
      "recitation_attempts",
      "recitation_errors",
      "recitation_results",
      "review_passages",
      "role_permissions",
      "school_announcements",
      "school_documents",
      "school_events",
      "school_incidents",
      "school_memberships",
      "school_rooms",
      "schools",
      "service_request_events",
      "service_requests",
      "staff_messages",
      "staff_profiles",
      "student_digital_files",
      "student_learning_sessions",
      "student_profiles",
      "student_surah_progress",
      "student_verse_progress",
      "teacher_documents",
      "teacher_profiles",
      "teacher_recitations",
      "teacher_requests",
      "teacher_salary_records",
      "teacher_session_reports",
      "teacher_session_runs",
      "teacher_session_students",
      "teacher_student_notes",
      "user_contact_links",
      "user_devices",
      "user_notifications",
      "user_roles",
      "validated_learning_content",
    ];
    const result = await database.query<{
      relname: string;
      relrowsecurity: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      select
        c.relname,
        c.relrowsecurity,
        has_table_privilege('authenticated', c.oid, 'INSERT') as can_insert,
        has_table_privilege('authenticated', c.oid, 'UPDATE') as can_update,
        has_table_privilege('authenticated', c.oid, 'DELETE') as can_delete
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
      order by c.relname
    `);

    expect(result.rows.map(({ relname }) => relname)).toEqual(expectedTables);
    expect(
      result.rows.every(
        ({ relrowsecurity, can_insert, can_update, can_delete }) =>
          relrowsecurity && !can_insert && !can_update && !can_delete,
      ),
    ).toBe(true);
  });

  it("installs the reviewed RLS policy set", async () => {
    const result = await database.query<{ policyname: string }>(`
      select policyname from pg_policies
      where schemaname = 'public'
      order by policyname
    `);
    expect(result.rows.map(({ policyname }) => policyname)).toEqual([
      "academic_years_admin_read",
      "admin_permission_grants_read",
      "admin_profiles_select_self_or_direction",
      "admin_tasks_admin_read",
      "announcements_read_scoped",
      "assignment_submissions_read_scoped",
      "assignments_read_scoped",
      "attendance_records_read_scoped",
      "audit_logs_select_administration",
      "class_enrollments_select_scoped",
      "class_teacher_assignments_select_scoped",
      "classes_select_scoped",
      "contact_points_admin_read",
      "conversation_members_member_read",
      "conversation_messages_member_read",
      "conversations_member_read",
      "course_sessions_read_scoped",
      "documents_read_scoped",
      "events_read_scoped",
      "exam_results_read_scoped",
      "exams_read_scoped",
      "family_relationships_select_scoped",
      "feature_flags_active_read",
      "finance_transactions_admin_read",
      "finance_transactions_student_read",
      "game_attempts_read_scoped",
      "inventory_items_admin_read",
      "learning_events_read_scoped",
      "learning_goals_read_scoped",
      "message_attachments_member_read",
      "notification_campaigns_admin_read",
      "notification_deliveries_scoped_read",
      "notification_events_scoped_read",
      "notification_policies_admin_read",
      "notification_preferences_own_read",
      "notification_recipients_scoped_read",
      "notification_templates_admin_read",
      "notifications_read_own",
      "offline_mutation_receipts_own_read",
      "parent_feedback_student_insert",
      "parent_feedback_student_select",
      "parent_profiles_select_self_or_admin",
      "permissions_active_read",
      "profiles_select_own",
      "profiles_select_scoped",
      "public_category_read",
      "public_category_translation_read",
      "public_news_read",
      "public_news_translation_read",
      "public_program_read",
      "public_program_translation_read",
      "public_replay_category_read",
      "public_replay_read",
      "public_replay_translation_read",
      "public_schedule_read",
      "public_schedule_translation_read",
      "public_site_profile_read",
      "public_site_profile_translation_read",
      "push_subscriptions_own_read",
      "quran_audio_tracks_read",
      "quran_surahs_read",
      "quran_verses_read",
      "recitation_attempts_read_scoped",
      "recitation_errors_read_scoped",
      "recitation_results_read_scoped",
      "review_passages_read_scoped",
      "role_permissions_active_read",
      "schema_versions_direction_read",
      "school_documents_admin_read",
      "school_documents_related_user_read",
      "school_incidents_admin_read",
      "school_memberships_select_scoped",
      "school_rooms_admin_read",
      "schools_select_member",
      "service_request_events_scoped_read",
      "service_requests_scoped_read",
      "staff_messages_read",
      "staff_profiles_admin_read",
      "student_digital_files_admin_read",
      "student_digital_files_student_read",
      "student_learning_sessions_own_read",
      "student_profiles_select_scoped",
      "surah_progress_read_scoped",
      "teacher_documents_read",
      "teacher_profiles_select_self_or_admin",
      "teacher_recitations_read",
      "teacher_requests_read",
      "teacher_salary_records_read",
      "teacher_session_reports_read",
      "teacher_session_runs_read",
      "teacher_session_students_read",
      "teacher_student_notes_read",
      "user_contact_links_scoped_read",
      "user_devices_own_read",
      "user_roles_select_administration",
      "user_roles_select_own",
      "validated_content_read",
      "verse_progress_read_scoped",
    ]);
  });

  it("publishes only approved public content while administrators retain draft access", async () => {
    const publishedNews = "40000000-0000-4000-8000-000000000001";
    const draftNews = "40000000-0000-4000-8000-000000000002";
    await database.exec(`
      insert into public.public_news
        (id, school_id, status, published_at, created_by, updated_by)
      values
        ('${publishedNews}', '${schools.first}', 'published', now(), '${users.adminA}', '${users.adminA}'),
        ('${draftNews}', '${schools.first}', 'draft', null, '${users.adminA}', '${users.adminA}');
      insert into public.public_news_translations
        (news_id, locale, slug, title, excerpt, body)
      values
        ('${publishedNews}', 'ar', 'published-news', 'Published', 'Excerpt', 'Body'),
        ('${draftNews}', 'ar', 'draft-news', 'Draft', 'Excerpt', 'Body');
    `);

    const anonymous = await runAsDatabaseRole(
      "anon",
      "select id from public.public_news order by id",
    );
    expect(anonymous.rows).toEqual([{ id: publishedNews }]);
    const administrative = await asUser<{ id: string }>(
      users.adminA,
      "select id from public.public_news order by id",
    );
    expect(administrative).toEqual([{ id: publishedNews }, { id: draftNews }]);
  });

  it("deduplicates replay views and resists repeated artificial likes", async () => {
    const replayId = "50000000-0000-4000-8000-000000000001";
    const visitorA = "a".repeat(64);
    const visitorB = "b".repeat(64);
    const network = "c".repeat(64);
    await database.exec(`
      insert into public.public_replays
        (id, school_id, status, video_url, published_at, created_by, updated_by)
      values
        ('${replayId}', '${schools.first}', 'published', 'https://video.example.test/1', now(), '${users.adminA}', '${users.adminA}');
    `);

    const firstLike = await runAsDatabaseRole(
      "service_role",
      `select * from public.toggle_public_replay_like('${replayId}', '${visitorA}', '${network}')`,
    );
    expect(firstLike.rows).toEqual([{ liked: true, likes_count: 1 }]);
    await expect(
      runAsDatabaseRole(
        "service_role",
        `select * from public.toggle_public_replay_like('${replayId}', '${visitorB}', '${network}')`,
      ),
    ).rejects.toThrow(/like_rate_limited/);
    const unlike = await runAsDatabaseRole(
      "service_role",
      `select * from public.toggle_public_replay_like('${replayId}', '${visitorA}', '${network}')`,
    );
    expect(unlike.rows).toEqual([{ liked: false, likes_count: 0 }]);

    await runAsDatabaseRole(
      "service_role",
      `select public.register_public_replay_view('${replayId}', '${visitorA}')`,
    );
    await runAsDatabaseRole(
      "service_role",
      `select public.register_public_replay_view('${replayId}', '${visitorA}')`,
    );
    const replay = await database.query<{ views_count: number; likes_count: number }>(
      `select views_count, likes_count from public.public_replays where id = '${replayId}'`,
    );
    expect(replay.rows).toEqual([{ views_count: 1, likes_count: 0 }]);
  });

  it("isolates one student from every other student", async () => {
    const visibleStudents = await asUser<{ user_id: string }>(
      users.studentA,
      "select user_id from public.student_profiles order by user_id",
    );
    expect(visibleStudents.map(({ user_id }) => user_id)).toEqual([users.studentA]);
  });

  it("lets a parent read only linked children", async () => {
    const visibleStudents = await asUser<{ user_id: string }>(
      users.parentA,
      "select user_id from public.student_profiles order by user_id",
    );
    expect(visibleStudents.map(({ user_id }) => user_id)).toEqual([users.studentA]);
  });

  it("limits a teacher to students in actively assigned classes", async () => {
    const visibleStudents = await asUser<{ user_id: string }>(
      users.teacherA,
      "select user_id from public.student_profiles order by user_id",
    );
    const visibleClasses = await asUser<{ id: string }>(
      users.teacherA,
      "select id from public.classes order by id",
    );

    expect(visibleStudents.map(({ user_id }) => user_id)).toEqual([users.studentA]);
    expect(visibleClasses.map(({ id }) => id)).toEqual([classes.first]);
  });

  it("limits an admin to memberships and audit logs from their school", async () => {
    const visibleStudents = await asUser<{ user_id: string }>(
      users.adminA,
      "select user_id from public.student_profiles order by user_id",
    );
    const visibleAuditLogs = await asUser<{ action: string }>(
      users.adminA,
      "select action from public.audit_logs order by action",
    );

    expect(visibleStudents.map(({ user_id }) => user_id)).toEqual([users.studentA]);
    expect(visibleAuditLogs.map(({ action }) => action)).toEqual(["test.first"]);
  });

  it("allows direction to read across schools", async () => {
    const visibleStudents = await asUser<{ user_id: string }>(
      users.direction,
      "select user_id from public.student_profiles order by user_id",
    );
    expect(visibleStudents.map(({ user_id }) => user_id)).toEqual([
      users.studentA,
      users.studentB,
    ]);
  });

  it("removes teacher scope immediately when the account is suspended", async () => {
    await database.exec(`
      update public.profiles
      set status = 'suspended', suspension_reason = 'Security test suspension'
      where id = '${users.teacherA}'
    `);
    const visibleStudents = await asUser<{ user_id: string }>(
      users.teacherA,
      "select user_id from public.student_profiles order by user_id",
    );
    const visibleClasses = await asUser<{ id: string }>(
      users.teacherA,
      "select id from public.classes order by id",
    );
    expect(visibleStudents).toEqual([]);
    expect(visibleClasses).toEqual([]);
    await database.exec(`
      update public.profiles
      set status = 'active', suspension_reason = null
      where id = '${users.teacherA}'
    `);
  });

  it("denies client writes and trusted account provisioning RPCs", async () => {
    await expect(
      runAsUser(
        users.studentA,
        `update public.profiles set display_name = 'Changed' where id = '${users.studentA}'`,
      ),
    ).rejects.toThrow();

    await expect(
      runAsUser(
        users.adminA,
        `select public.provision_account_data(
          '${users.studentB}', 'new-user', 'New', 'User', array['student']::public.app_role[],
          '${schools.first}', '${users.adminA}', 'ar'
        )`,
      ),
    ).rejects.toThrow();
  });

  it("denies anonymous reads", async () => {
    await expect(
      runAsDatabaseRole("anon", "select id from public.profiles"),
    ).rejects.toThrow();
  });

  it("provisions account data transactionally through service_role", async () => {
    await database.exec(`
      insert into auth.users (id, email) values
        ('${provisionedUsers.student}', 'provisioned-student@example.test'),
        ('${provisionedUsers.forbiddenAdmin}', 'forbidden-admin@example.test')
    `);

    await runAsDatabaseRole(
      "service_role",
      `select public.provision_account_data(
        '${provisionedUsers.student}', 'student-new', 'New', 'Student',
        array['student']::public.app_role[], '${schools.first}', '${users.adminA}', 'ar'
      )`,
    );

    const profile = await database.query<{ status: string }>(`
      select status from public.profiles where id = '${provisionedUsers.student}'
    `);
    const alias = await database.query<{ normalized_alias: string }>(`
      select normalized_alias from private.login_aliases
      where user_id = '${provisionedUsers.student}'
    `);
    expect(profile.rows).toEqual([{ status: "pending" }]);
    expect(alias.rows).toEqual([{ normalized_alias: "student-new" }]);

    await expect(
      runAsDatabaseRole(
        "service_role",
        `select public.provision_account_data(
          '${provisionedUsers.forbiddenAdmin}', 'admin-new', 'New', 'Admin',
          array['admin']::public.app_role[], '${schools.first}', '${users.adminA}', 'ar'
        )`,
      ),
    ).rejects.toThrow(/privileged_role_forbidden/);
  });

  it("prevents school admins from changing out-of-scope or privileged accounts", async () => {
    await expect(
      runAsDatabaseRole(
        "service_role",
        `select public.set_account_status(
          '${users.studentB}', 'suspended', 'Out of scope test',
          '${users.adminA}', '${schools.first}'
        )`,
      ),
    ).rejects.toThrow(/target_outside_admin_school/);

    await expect(
      runAsDatabaseRole(
        "service_role",
        `select public.set_account_status(
          '${users.direction}', 'suspended', 'Privilege test',
          '${users.adminA}', '${schools.first}'
        )`,
      ),
    ).rejects.toThrow(/privileged_status_change_forbidden/);

    await runAsDatabaseRole(
      "service_role",
      `select public.set_account_status(
        '${users.studentB}', 'suspended', 'Direction security test',
        '${users.direction}', '${schools.second}'
      )`,
    );
    const suspended = await database.query<{
      status: string;
      suspension_reason: string | null;
    }>(`
      select status, suspension_reason from public.profiles
      where id = '${users.studentB}'
    `);
    expect(suspended.rows).toEqual([
      { status: "suspended", suspension_reason: "Direction security test" },
    ]);
  });

  it("keeps V1 migration mappings private from authenticated users", async () => {
    await expect(
      asUser(
        users.direction,
        "select source_name from private.legacy_account_links",
      ),
    ).rejects.toThrow();
  });

  it("lets one parent follow multiple linked children but no unrelated child", async () => {
    const studentC = "00000000-0000-4000-8000-000000000008";
    await database.exec(`
      insert into auth.users (id, email) values ('${studentC}', 'student-c@example.test');
      insert into public.profiles (id, display_name, first_name, last_name, status)
      values ('${studentC}', 'Student C', 'Student', 'C', 'active');
      insert into public.user_roles (user_id, role) values ('${studentC}', 'student');
      insert into public.school_memberships (school_id, user_id, status)
      values ('${schools.first}', '${studentC}', 'active');
      insert into public.student_profiles (user_id) values ('${studentC}');
      insert into public.family_relationships (parent_id, student_id, relationship)
      values ('${users.parentA}', '${studentC}', 'guardian');
      insert into public.student_surah_progress (student_id, surah_number, status, completion_percent)
      values
        ('${users.studentA}', 114, 'mastered', 100),
        ('${studentC}', 113, 'in_progress', 40),
        ('${users.studentB}', 112, 'mastered', 100);
    `);
    const familyRows = await asUser<{ student_id: string }>(users.parentA, "select student_id from public.student_surah_progress order by student_id");
    expect(familyRows.map(({ student_id }) => student_id)).toEqual([users.studentA, studentC]);
    const childRows = await asUser<{ student_id: string }>(users.studentA, "select student_id from public.student_surah_progress order by student_id");
    expect(childRows.map(({ student_id }) => student_id)).toEqual([users.studentA]);
    const teacherRows = await asUser<{ student_id: string }>(users.teacherA, "select student_id from public.student_surah_progress order by student_id");
    expect(teacherRows.map(({ student_id }) => student_id)).toEqual([users.studentA]);
  });

  it("imports V1 learning progress once while retaining the raw payload", async () => {
    const call = `select public.import_v1_learning_progress(
      '${users.studentA}', 'v1.progressions', 'fingerprint-a',
      '{"legacy":"kept"}'::jsonb,
      '[{"surah_number":111,"completed":true,"completion_percent":100,"highest_completed_step":4,"stars":12}]'::jsonb
    ) as imported`;
    const first = await runAsDatabaseRole("service_role", call);
    const second = await runAsDatabaseRole("service_role", call);
    expect(first.rows).toEqual([{ imported: true }]);
    expect(second.rows).toEqual([{ imported: false }]);
    const stored = await database.query<{ status: string; completion_percent: number }>(`select status, completion_percent from public.student_surah_progress where student_id = '${users.studentA}' and surah_number = 111`);
    expect(stored.rows).toEqual([{ status: "mastered", completion_percent: 100 }]);
  });

  it("records student practice and permits only own assignment workflow", async () => {
    const assignment = "50000000-0000-4000-8000-000000000001";
    await database.exec(`insert into public.assignments (id, school_id, student_id, teacher_id, title) values ('${assignment}', '${schools.first}', '${users.studentA}', '${users.teacherA}', 'Review')`);
    await runAsUser(users.studentA, "select public.record_quran_practice(114::smallint, 1::smallint, true)");
    await runAsUser(users.studentA, `select public.update_own_assignment('${assignment}', 'in_progress', null)`);
    await runAsUser(users.studentA, `select public.update_own_assignment('${assignment}', 'submitted', 'Done')`);
    const submission = await database.query<{ status: string; response: string }>(`select status, response from public.assignment_submissions where assignment_id = '${assignment}' and student_id = '${users.studentA}'`);
    expect(submission.rows).toEqual([{ status: "submitted", response: "Done" }]);
    await expect(runAsUser(users.studentA, `select public.update_own_assignment('${assignment}', 'in_progress', null)`)).rejects.toThrow(/assignment_status_cannot_regress/);
    await expect(runAsUser(users.studentA, `select public.update_own_assignment('${assignment}', 'corrected', null)`)).rejects.toThrow(/student_cannot_correct_assignment/);
    await expect(runAsUser(users.studentB, `select public.update_own_assignment('${assignment}', 'submitted', null)`)).rejects.toThrow();
  });

  it("runs the complete teacher session workflow without crossing class boundaries", async () => {
    const course = "60000000-0000-4000-8000-000000000001";
    await database.exec(`
      insert into public.course_sessions (id, class_id, teacher_id, starts_at, ends_at, title)
      values ('${course}', '${classes.first}', '${users.teacherA}', now(), now() + interval '90 minutes', 'Quran session');
    `);

    await expect(
      asUser(users.teacherB, `select public.teacher_start_session('${course}')`),
    ).rejects.toThrow(/course_session_not_accessible/);

    const started = await asUser<{ run_id: string }>(
      users.teacherA,
      `select public.teacher_start_session('${course}') as run_id`,
    );
    const runId = started[0]?.run_id;
    expect(runId).toBeTruthy();

    await runAsUser(
      users.teacherA,
      `select public.teacher_save_attendance(
        '${runId}',
        '[{"student_id":"${users.studentA}","status":"late","minutes_late":7}]'::jsonb
      )`,
    );
    await expect(
      runAsUser(
        users.teacherA,
        `select public.teacher_record_student_work(
          '${runId}', '${users.studentB}', 114::smallint, 1::smallint, 6::smallint,
          'good'::public.recitation_appreciation, '', 'good'::public.session_behavior_status,
          '[]'::jsonb, false, 114::smallint, 1::smallint, 6::smallint, false, null
        )`,
      ),
    ).rejects.toThrow(/student_not_in_session_class/);

    await runAsUser(
      users.teacherA,
      `select public.teacher_record_student_work(
        '${runId}', '${users.studentA}', 114::smallint, 1::smallint, 6::smallint,
        'very_good'::public.recitation_appreciation, 'Stable work', 'good'::public.session_behavior_status,
        '["review"]'::jsonb, true, 113::smallint, 1::smallint, 5::smallint,
        true, now() + interval '7 days'
      )`,
    );

    const report = await asUser<{ report_id: string }>(
      users.teacherA,
      `select public.teacher_open_session_report('${runId}') as report_id`,
    );
    const reportId = report[0]?.report_id;
    await runAsUser(
      users.teacherA,
      `select public.teacher_submit_session_report(
        '${reportId}', 'completed'::public.session_program_status,
        'good'::public.session_behavior_status, '["review"]'::jsonb,
        '["${users.studentA}"]'::jsonb, false, '', 'ready'::public.equipment_status, '', 'Completed'
      )`,
    );

    const attendance = await asUser<{ status: string; minutes_late: number }>(
      users.studentA,
      `select status, minutes_late from public.attendance_records where session_id = '${course}'`,
    );
    expect(attendance).toEqual([{ status: "late", minutes_late: 7 }]);
    const ownRecitations = await asUser<{ surah_number: number }>(
      users.studentA,
      "select surah_number from public.teacher_recitations",
    );
    expect(ownRecitations).toEqual([{ surah_number: 114 }]);
    const foreignReports = await asUser<{ id: string }>(users.teacherB, "select id from public.teacher_session_reports");
    expect(foreignReports).toEqual([]);
    const adminReports = await asUser<{ status: string }>(users.adminA, `select status from public.teacher_session_reports where id = '${reportId}'`);
    expect(adminReports).toEqual([{ status: "submitted" }]);

    const createdRequest = await asUser<{ request_id: string }>(
      users.teacherA,
      "select public.teacher_create_request('equipment'::public.teacher_request_kind, 'Need material', 'A replacement is needed', null, null) as request_id",
    );
    const visibleRequests = await asUser<{ title: string }>(users.adminA, "select title from public.teacher_requests");
    expect(visibleRequests).toEqual([{ title: "Need material" }]);
    await runAsUser(
      users.adminA,
      `select public.admin_review_teacher_request('${createdRequest[0]?.request_id}', 'approved'::public.workflow_status, 'Approved')`,
    );
    const reviewed = await asUser<{ status: string; admin_response: string }>(users.teacherA, "select status, admin_response from public.teacher_requests");
    expect(reviewed).toEqual([{ status: "approved", admin_response: "Approved" }]);

    const cancellable = await asUser<{ request_id: string }>(
      users.teacherA,
      "select public.teacher_create_request('general'::public.teacher_request_kind, 'Second request', '', null, null) as request_id",
    );
    await runAsUser(users.teacherA, `select public.teacher_cancel_request('${cancellable[0]?.request_id}')`);
    const cancelled = await asUser<{ status: string }>(users.teacherA, `select status from public.teacher_requests where id = '${cancellable[0]?.request_id}'`);
    expect(cancelled).toEqual([{ status: "cancelled" }]);
  });

  it("isolates Command records by school and audits administrative actions", async () => {
    const taskA = "70000000-0000-4000-8000-000000000001";
    const taskB = "70000000-0000-4000-8000-000000000002";
    await database.exec(`
      insert into public.admin_tasks (id, school_id, kind, title, reason)
      values
        ('${taskA}', '${schools.first}', 'report', 'First task', 'First school'),
        ('${taskB}', '${schools.second}', 'report', 'Second task', 'Second school');
    `);
    const adminTasks = await asUser<{ id: string }>(users.adminA, "select id from public.admin_tasks order by id");
    expect(adminTasks).toEqual([{ id: taskA }]);
    await runAsUser(users.adminA, `select public.admin_resolve_task('${taskA}', 'done'::public.admin_task_status)`);
    await expect(runAsUser(users.adminA, `select public.admin_resolve_task('${taskB}', 'done'::public.admin_task_status)`)).rejects.toThrow(/task_not_accessible/);
    const taskAudit = await asUser<{ action: string }>(users.adminA, "select action from public.audit_logs where action = 'admin.task_status_changed'");
    expect(taskAudit).toEqual([{ action: "admin.task_status_changed" }]);

    await runAsUser(users.adminA, `select public.admin_create_incident('${users.studentA}', null, 'attendance', 2::smallint, 'Repeated absence')`);
    await expect(runAsUser(users.adminA, `select public.admin_create_incident('${users.studentB}', null, 'attendance', 2::smallint, 'Out of scope')`)).rejects.toThrow(/incident_scope_denied/);
    await runAsUser(users.adminA, `select public.admin_create_command_record('room', '{"name":"Room A","capacity":"20"}'::jsonb)`);
    const rooms = await asUser<{ name: string }>(users.adminA, "select name from public.school_rooms");
    expect(rooms).toEqual([{ name: "Room A" }]);
    await expect(runAsUser(users.adminA, `select public.admin_create_command_record('salary', '{"teacher_id":"${users.teacherB}","period_month":"2026-08-01","gross":"1000","deductions":"0"}'::jsonb)`)).rejects.toThrow(/teacher_scope_denied/);
  });

  it("allows privileged administration mutations after role-based authentication", async () => {
    const task = "70000000-0000-4000-8000-000000000009";
    await database.exec(`insert into public.admin_tasks (id, school_id, kind, title, reason) values ('${task}', '${schools.first}', 'security', 'MFA test', 'Test')`);
    await runAsUserAtAal1(users.adminA, `select public.admin_resolve_task('${task}', 'done')`);
    const state = await database.query<{ status: string }>(`select status from public.admin_tasks where id = '${task}'`);
    expect(state.rows).toEqual([{ status: "done" }]);
  });

  it("enforces permissions, feature flags, and diagnostics without exposing them to suspended users", async () => {
    const teacherPermission = await asUser<{ allowed: boolean }>(users.teacherA, "select public.has_permission('teacher.write.attendance') as allowed");
    expect(teacherPermission).toEqual([{ allowed: true }]);
    const studentPermission = await asUser<{ allowed: boolean }>(users.studentA, "select public.has_permission('admin.manage.payroll') as allowed");
    expect(studentPermission).toEqual([{ allowed: false }]);
    const feature = await asUser<{ enabled: boolean }>(users.studentA, "select public.is_feature_enabled('offline_mutations_v3') as enabled");
    expect(feature).toEqual([{ enabled: true }]);
    await expect(asUser(users.adminA, "select public.system_diagnostics()" )).rejects.toThrow(/diagnostics_forbidden/);
    const diagnostics = await asUser<{ value: { schema_version: string } }>(users.direction, "select public.system_diagnostics() as value");
    expect(diagnostics[0]?.value.schema_version).toBe("202608310006");
    const mutationId = "91000000-0000-4000-8000-000000000001";
    const claimed = await asUser<{ state: string }>(users.studentA, `select public.claim_offline_mutation('${mutationId}', 'quran.practice') as state`);
    expect(claimed).toEqual([{ state: "claimed" }]);
    await runAsUser(users.studentA, `select public.finish_offline_mutation('${mutationId}', true, null)`);
    const repeated = await asUser<{ state: string }>(users.studentA, `select public.claim_offline_mutation('${mutationId}', 'quran.practice') as state`);
    expect(repeated).toEqual([{ state: "completed" }]);
    await database.exec(`update public.profiles set status = 'suspended', suspension_reason = 'test' where id = '${users.teacherA}'`);
    const suspended = await asUser<{ allowed: boolean }>(users.teacherA, "select public.has_permission('teacher.write.attendance') as allowed");
    expect(suspended).toEqual([{ allowed: false }]);
    await database.exec(`update public.profiles set status = 'active', suspension_reason = null where id = '${users.teacherA}'`);
  });

  it("limits messaging to real school relationships and keeps conversations private", async () => {
    const allowed = await asUser<{ allowed: boolean }>(users.studentA, `select public.can_message_user('${users.teacherA}') as allowed`);
    expect(allowed).toEqual([{ allowed: true }]);
    const denied = await asUser<{ allowed: boolean }>(users.studentA, `select public.can_message_user('${users.teacherB}') as allowed`);
    expect(denied).toEqual([{ allowed: false }]);
    const administrationAllowed = await asUser<{ allowed: boolean }>(users.studentA, `select public.can_message_user('${users.direction}') as allowed`);
    expect(administrationAllowed).toEqual([{ allowed: true }]);
    const parentAllowed = await asUser<{ allowed: boolean }>(users.parentA, `select public.can_message_user('${users.teacherA}') as allowed`);
    expect(parentAllowed).toEqual([{ allowed: true }]);

    const created = await asUser<{ id: string }>(users.studentA, `select public.create_direct_conversation('${users.teacherA}', 'Follow-up') as id`);
    const conversationId = created[0]?.id;
    const clientId = "80000000-0000-4000-8000-000000000001";
    const first = await asUser<{ id: number }>(users.studentA, `select public.send_conversation_message('${conversationId}', 'Hello teacher', '${clientId}') as id`);
    const repeated = await asUser<{ id: number }>(users.studentA, `select public.send_conversation_message('${conversationId}', 'Hello teacher', '${clientId}') as id`);
    expect(repeated).toEqual(first);
    const teacherMessages = await asUser<{ body: string }>(users.teacherA, "select body from public.conversation_messages");
    expect(teacherMessages).toEqual([]);
    const parentMessages = await asUser<{ body: string }>(users.parentA, "select body from public.conversation_messages");
    expect(parentMessages).toEqual([]);
    const otherSchoolMessages = await asUser<{ body: string }>(users.teacherB, "select body from public.conversation_messages");
    expect(otherSchoolMessages).toEqual([]);
    const teacherCanContactDirection = await asUser<{ allowed: boolean }>(users.teacherA, `select public.can_message_user('${users.direction}') as allowed`);
    expect(teacherCanContactDirection).toEqual([{ allowed: true }]);
    const teacherCannotContactStudent = await asUser<{ allowed: boolean }>(users.teacherA, `select public.can_message_user('${users.studentA}') as allowed`);
    expect(teacherCannotContactStudent).toEqual([{ allowed: false }]);
    const adminConversation = await asUser<{ id: string }>(users.teacherA, `select public.create_direct_conversation('${users.direction}', 'Administration') as id`);
    await asUser(users.teacherA, `select public.send_conversation_message('${adminConversation[0]?.id}', 'Administrative message', '80000000-0000-4000-8000-000000000002')`);
    const directionMessages = await asUser<{ body: string }>(users.direction, `select body from public.conversation_messages where conversation_id = '${adminConversation[0]?.id}'`);
    expect(directionMessages).toEqual([{ body: "Administrative message" }]);
    await expect(asUser(users.studentA, `select public.create_direct_conversation('${users.teacherB}', 'Denied')`)).rejects.toThrow(/messaging_relationship_denied/);
  });

  it("creates idempotent requests with scoped workflow history and notifications", async () => {
    const clientId = "90000000-0000-4000-8000-000000000001";
    const sql = `select public.create_service_request('technical_problem', 'Audio problem', 'No sound', 'high', '${clientId}') as id`;
    const first = await asUser<{ id: string }>(users.studentA, sql);
    const second = await asUser<{ id: string }>(users.studentA, sql);
    expect(second).toEqual(first);
    const requestId = first[0]?.id;
    const adminRows = await asUser<{ reference: string }>(users.adminA, `select reference from public.service_requests where id = '${requestId}'`);
    expect(adminRows[0]?.reference).toMatch(/^REQ-\d{4}-\d{6}$/u);
    const foreignRows = await asUser<{ id: string }>(users.teacherB, "select id from public.service_requests");
    expect(foreignRows).toEqual([]);
    await runAsUser(users.adminA, `select public.update_service_request('${requestId}', 'in_progress', 'Checking', '${users.adminA}')`);
    const events = await asUser<{ event_kind: string }>(users.studentA, `select event_kind from public.service_request_events where request_id = '${requestId}' order by id`);
    expect(events).toEqual([{ event_kind: "created" }, { event_kind: "status_changed" }]);
    const notifications = await asUser<{ category: string }>(users.studentA, "select category from public.user_notifications where category = 'request'");
    expect(notifications).toEqual([{ category: "request" }]);
    const audit = await asUser<{ action: string }>(users.adminA, `select action from public.audit_logs where entity_id = '${requestId}' order by id`);
    expect(audit).toEqual([{ action: "service_request.created" }, { action: "service_request.status_changed" }]);
  });

  it("shares one normalized contact safely across legitimate linked accounts", async () => {
    const saveParent = `select public.save_user_contact('${users.parentA}', 'phone', '+212612345678', '06 12 34 56 78', 'MA', 'parent', true, true, false, true, false, 'father')`;
    const saveStudent = `select public.save_user_contact('${users.studentA}', 'phone', '+212612345678', '06 12 34 56 78', 'MA', 'parent', true, true, false, true, false, 'father')`;
    await runAsUser(users.parentA, saveParent);
    await runAsUser(users.studentA, saveStudent);
    const points = await database.query<{ count: number }>("select count(*)::integer as count from public.contact_points where normalized_value = '+212612345678'");
    expect(points.rows).toEqual([{ count: 1 }]);
    const studentContacts = await asUser<{ masked_value: string }>(users.studentA, "select masked_value from public.list_my_contacts()");
    expect(studentContacts).toEqual([{ masked_value: "+21261****678" }]);
    const teacherLinks = await asUser<{ id: string }>(users.teacherA, "select id from public.user_contact_links");
    expect(teacherLinks).toEqual([]);
    const rawStudentPoints = await asUser<{ normalized_value: string }>(users.studentA, "select normalized_value from public.contact_points");
    expect(rawStudentPoints).toEqual([]);
    await expect(runAsUser(users.parentA, `select public.save_user_contact('${users.parentA}', 'phone', '0612345678', '0612345678', 'MA', 'personal')`)).rejects.toThrow(/invalid_contact_value/);
  });

  it("verifies contacts with expiring one-time challenges hidden from users", async () => {
    const link = await database.query<{ id: string }>(`select id from public.user_contact_links where user_id = '${users.parentA}' limit 1`);
    const digest = "a".repeat(64);
    const created = await runAsDatabaseRole("service_role", `select * from public.create_contact_verification_challenge('${users.parentA}', '${link.rows[0]?.id}', '${digest}')`);
    expect(created.rows).toHaveLength(1);
    await expect(runAsDatabaseRole("service_role", `select * from public.create_contact_verification_challenge('${users.parentA}', '${link.rows[0]?.id}', '${"c".repeat(64)}')`)).rejects.toThrow(/otp_rate_limited/u);
    await expect(asUser<{ id: string }>(users.parentA, "select id from public.contact_verification_challenges")).rejects.toThrow(/permission denied/u);
    const wrong = await runAsDatabaseRole("service_role", `select public.verify_contact_verification_challenge('${users.parentA}', '${link.rows[0]?.id}', '${"b".repeat(64)}') as verified`);
    expect(wrong.rows).toEqual([{ verified: false }]);
    const correct = await runAsDatabaseRole("service_role", `select public.verify_contact_verification_challenge('${users.parentA}', '${link.rows[0]?.id}', '${digest}') as verified`);
    expect(correct.rows).toEqual([{ verified: true }]);
    const contact = await database.query<{ verification_status: string }>(`select verification_status from public.contact_points c join public.user_contact_links l on l.contact_point_id = c.id where l.id = '${link.rows[0]?.id}'`);
    expect(contact.rows).toEqual([{ verification_status: "verified" }]);
  });

  it("registers a push endpoint only for its authenticated owner", async () => {
    await runAsUser(users.studentA, `select public.save_push_subscription('device-key-00000001','Phone','Android','Browser','https://push.example.test/subscription-a','${"p".repeat(40)}','auth-secret')`);
    const stored = await database.query("select endpoint, user_id from public.push_subscriptions where endpoint = 'https://push.example.test/subscription-a'");
    expect(stored.rows).toEqual([{ endpoint: "https://push.example.test/subscription-a", user_id: users.studentA }]);
    await expect(asUser<{ endpoint: string }>(users.teacherA, "select endpoint from public.push_subscriptions")).rejects.toThrow(/permission denied/u);
  });

  it("routes an absence to the student and guardian while deduplicating delivery", async () => {
    const contact = await database.query<{ id: string }>("select id from public.contact_points where normalized_value = '+212612345678'");
    await runAsUser(users.adminA, `select public.set_contact_verification('${contact.rows[0]?.id}', 'verified')`);
    await runAsUser(users.parentA, "select public.set_notification_channels('attendance', true, false, false, true, false, 'immediate', null, null)");
    await runAsUser(users.studentA, "select public.set_notification_channels('attendance', true, false, false, true, false, 'immediate', null, null)");
    const session = "92000000-0000-4000-8000-000000000001";
    const attendance = "92000000-0000-4000-8000-000000000002";
    await database.exec(`
      insert into public.course_sessions(id, class_id, teacher_id, starts_at, ends_at, title)
      values('${session}', '${classes.first}', '${users.teacherA}', now(), now() + interval '1 hour', 'Attendance notification');
      insert into public.attendance_records(id, session_id, student_id, status, recorded_by)
      values('${attendance}', '${session}', '${users.studentA}', 'absent', '${users.teacherA}');
    `);
    const recipients = await database.query<{ user_id: string }>(`select user_id from public.notification_recipients where event_id = (select id from public.notification_events where entity_id = '${attendance}') order by user_id`);
    expect(recipients.rows.map(({ user_id }) => user_id)).toEqual([users.studentA, users.parentA].sort());
    const inApp = await database.query<{ count: number }>(`select count(*)::integer as count from public.notification_deliveries where event_id = (select id from public.notification_events where entity_id = '${attendance}') and channel = 'in_app'`);
    expect(inApp.rows).toEqual([{ count: 2 }]);
    const sms = await database.query<{ count: number }>(`select count(*)::integer as count from public.notification_deliveries where event_id = (select id from public.notification_events where entity_id = '${attendance}') and channel = 'sms'`);
    expect(sms.rows).toEqual([{ count: 1 }]);
    await database.exec(`select public.route_notification_event((select id from public.notification_events where entity_id = '${attendance}'))`);
    const afterRepeat = await database.query<{ count: number }>(`select count(*)::integer as count from public.notification_deliveries where event_id = (select id from public.notification_events where entity_id = '${attendance}')`);
    expect(afterRepeat.rows).toEqual([{ count: 3 }]);
  });

  it("moves exhausted provider deliveries to the dead-letter queue", async () => {
    const delivery = await database.query<{ id: string }>("select id from public.notification_deliveries where channel = 'sms' limit 1");
    await database.exec(`update public.notification_deliveries set max_attempts = 1 where id = '${delivery.rows[0]?.id}'`);
    await runAsDatabaseRole("service_role", "select * from public.claim_notification_deliveries(10)");
    await runAsDatabaseRole("service_role", `select public.finish_notification_delivery('${delivery.rows[0]?.id}', false, 'test', null, 'TEMPORARY', 'provider unavailable')`);
    const state = await database.query<{ status: string }>(`select status from public.notification_deliveries where id = '${delivery.rows[0]?.id}'`);
    expect(state.rows).toEqual([{ status: "dead_letter" }]);
  });

  it("previews scoped campaigns and reserves urgent broadcasts for direction", async () => {
    const estimate = await asUser<{ total: number }>(users.adminA, `select public.estimate_notification_audience('${schools.first}', '{"type":"role","role":"student"}'::jsonb) as total`);
    expect(estimate).toEqual([{ total: 2 }]);
    await expect(asUser(users.adminA, `select public.create_notification_campaign('${schools.first}', 'Urgent', 'Test', '', '{"type":"all"}'::jsonb, '{in_app}'::public.notification_channel[], 'urgent')`)).rejects.toThrow(/urgent_broadcast_forbidden/);
    const campaign = await asUser<{ id: string }>(users.direction, `select public.create_notification_campaign('${schools.first}', 'Direction notice', 'Important information', '', '{"type":"users","user_ids":["${users.studentA}"]}'::jsonb, '{in_app}'::public.notification_channel[], 'urgent') as id`);
    const recipients = await database.query<{ user_id: string }>(`select nr.user_id from public.notification_recipients nr join public.notification_events ne on ne.id = nr.event_id where ne.entity_id = '${campaign[0]?.id}'`);
    expect(recipients.rows).toEqual([{ user_id: users.studentA }]);
  });
});
