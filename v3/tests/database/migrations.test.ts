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
  await database.exec("set role authenticated");
  try {
    const result = await database.query<Row>(sql);
    return result.rows;
  } finally {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function runAsUser(userId: string, sql: string): Promise<void> {
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await database.exec("set role authenticated");
  try {
    await database.exec(sql);
  } finally {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub', '', false)");
  }
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
      "admin_profiles",
      "audit_logs",
      "class_enrollments",
      "class_teacher_assignments",
      "classes",
      "family_relationships",
      "parent_profiles",
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
      "school_memberships",
      "schools",
      "student_profiles",
      "teacher_profiles",
      "user_roles",
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
      "admin_profiles_select_self_or_direction",
      "audit_logs_select_administration",
      "class_enrollments_select_scoped",
      "class_teacher_assignments_select_scoped",
      "classes_select_scoped",
      "family_relationships_select_scoped",
      "parent_profiles_select_self_or_admin",
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
      "school_memberships_select_scoped",
      "schools_select_member",
      "student_profiles_select_scoped",
      "teacher_profiles_select_self_or_admin",
      "user_roles_select_administration",
      "user_roles_select_own",
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
});
