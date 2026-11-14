import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = `${randomBytes(18).toString("base64url")}!Aa1`;

let directionId = "";
let studentId = "";
let schoolId = "";
let classId = "";

test.beforeAll(async () => {
  const direction = await createAuthUser("direction");
  directionId = direction.id;
  const bootstrap = await admin.rpc("bootstrap_direction_data", {
    target_user_id: directionId,
    target_login_alias: "t_admin.test",
    target_first_name: "Admin",
    target_last_name: "Test",
    target_school_name: "DAR Auth Test",
    target_school_code: "DAR-AUTH-TEST",
    target_locale: "ar",
  });
  expect(bootstrap.error).toBeNull();
  schoolId = bootstrap.data as string;

  const student = await createAuthUser("student");
  studentId = student.id;
  const provisioned = await admin.rpc("provision_account_data", {
    target_user_id: studentId,
    target_login_alias: "s_a.b",
    target_first_name: "A",
    target_last_name: "B",
    target_roles: ["student"],
    target_school_id: schoolId,
    actor_user_id: directionId,
    target_locale: "ar",
  });
  expect(provisioned.error).toBeNull();
  const activated = await admin.rpc("set_account_status", {
    target_user_id: studentId,
    target_status: "active",
    target_suspension_reason: null,
    actor_user_id: directionId,
    target_school_id: schoolId,
  });
  expect(activated.error).toBeNull();

  const authUser = await admin.auth.admin.getUserById(studentId);
  expect(authUser.error).toBeNull();
  expect(authUser.data.user?.email).toBe(internalEmail("student"));
  expect(authUser.data.user?.email_confirmed_at).toBeTruthy();

  const resolvedAlias = await admin.rpc("resolve_login_alias", {
    target_login_alias: "s_a.b",
  });
  expect(resolvedAlias.error).toBeNull();
  expect(resolvedAlias.data).toBe(internalEmail("student"));

  const directAuth = anonymousClient();
  const directLogin = await directAuth.auth.signInWithPassword({
    email: internalEmail("student"),
    password,
  });
  expect(directLogin.error).toBeNull();
  expect(directLogin.data.user?.id).toBe(studentId);
  await directAuth.auth.signOut();

  const classroom = await admin.from("classes").insert({
    school_id: schoolId,
    name: "Classe Auth Test",
    level: "Test",
    capacity: 10,
    status: "active",
    schedule_text: "الثلاثاء · 16:00–18:00",
  }).select("id").single();
  expect(classroom.error).toBeNull();
  classId = classroom.data!.id;
  expect((await admin.from("class_enrollments").insert({ class_id: classId, student_id: studentId, status: "active", created_by: directionId })).error).toBeNull();
  expect((await admin.from("class_schedule_slots").insert({ class_id: classId, day_of_week: 2, starts_at: "16:00", ends_at: "18:00" })).error).toBeNull();
});

test.afterAll(async () => {
  if (studentId) await admin.auth.admin.deleteUser(studentId);
  if (directionId) await admin.auth.admin.deleteUser(directionId);
});

test("real student Auth sessions are revoked by archive and restored safely", async ({ browser }) => {
  test.setTimeout(180_000);
  const studentA = await browser.newContext();
  const studentB = await browser.newContext();
  const direction = await browser.newContext();
  try {
    const studentPageA = await studentA.newPage();
    const studentPageB = await studentB.newPage();
    await login(studentPageA, "student", "A", "B", "/student");
    await expect(studentPageA.getByText("Classe Auth Test", { exact: true })).toBeVisible();
    await expect(studentPageA.getByText(/16:00/)).toBeVisible();
    await login(studentPageB, "student", "A", "B", "/student");

    const directSession = anonymousClient();
    const directLogin = await directSession.auth.signInWithPassword({ email: internalEmail("student"), password });
    expect(directLogin.error).toBeNull();
    const refreshToken = directLogin.data.session!.refresh_token;

    const directionPage = await direction.newPage();
    await login(directionPage, "teacher", "Admin", "Test", "/admin");
    const archiveStatuses = await directionPage.evaluate(async (id) => {
      const responses = await Promise.all([
        fetch(`/api/admin/accounts/${id}`, { method: "DELETE" }),
        fetch(`/api/admin/accounts/${id}`, { method: "DELETE" }),
      ]);
      return responses.map((response) => response.status);
    }, studentId);
    expect(archiveStatuses).toEqual([200, 200]);

    for (const page of [studentPageA, studentPageB]) {
      await page.goto("/student");
      await expect(page).toHaveURL(/\/ar\?auth=forbidden$/);
      const apiStatus = await page.evaluate(() => fetch("/api/student/learning?key=surah-114").then((response) => response.status));
      expect(apiStatus).toBe(403);
    }

    const refreshed = await directSession.auth.refreshSession({ refresh_token: refreshToken });
    expect(refreshed.error).toBeNull();
    const deniedRows = await directSession.from("student_profiles").select("user_id").eq("user_id", studentId);
    expect(deniedRows.error).toBeNull();
    expect(deniedRows.data).toEqual([]);

    const refused = await browser.newContext();
    try {
      const refusedPage = await refused.newPage();
      await openLogin(refusedPage, "student", "A", "B");
      await refusedPage.getByRole("button", { name: "دخول", exact: true }).click();
      await expect(refusedPage).toHaveURL(/\/login$/);
      await expect(refusedPage.locator(".login-v3__message")).toContainText("الإدارة");
    } finally {
      await refused.close();
    }

    const archived = await admin.from("profiles").select("status,deleted_at").eq("id", studentId).single();
    expect(archived.data?.status).toBe("archived");
    expect(archived.data?.deleted_at).toBeTruthy();
    const enrollment = await admin.from("class_enrollments").select("status").eq("student_id", studentId).single();
    expect(enrollment.data?.status).toBe("withdrawn");
    const archiveAudit = await admin.from("audit_logs").select("id").eq("entity_id", studentId).eq("action", "account.moved_to_trash");
    expect(archiveAudit.data).toHaveLength(1);

    const restoreStatus = await directionPage.evaluate((id) => fetch(`/api/admin/accounts/${id}/restore`, { method: "POST" }).then((response) => response.status), studentId);
    expect(restoreStatus).toBe(200);
    const restored = await admin.from("profiles").select("status,deleted_at").eq("id", studentId).single();
    expect(restored.data).toEqual({ status: "active", deleted_at: null });
    const preservedEnrollment = await admin.from("class_enrollments").select("status").eq("student_id", studentId).single();
    expect(preservedEnrollment.data?.status).toBe("withdrawn");
    const restoreAudit = await admin.from("audit_logs").select("id").eq("entity_id", studentId).eq("action", "account.restored_from_trash");
    expect(restoreAudit.data).toHaveLength(1);

    const restoredContext = await browser.newContext();
    try {
      const restoredPage = await restoredContext.newPage();
      await login(restoredPage, "student", "A", "B", "/student");
      await expect(restoredPage.getByText("A B", { exact: true }).first()).toBeVisible();
      await restoredPage.getByRole("button", { name: "تسجيل الخروج" }).click();
      await expect(restoredPage).toHaveURL(/\/login$/);
      await login(restoredPage, "student", "A", "B", "/student");
    } finally {
      await restoredContext.close();
    }
  } finally {
    await studentA.close();
    await studentB.close();
    await direction.close();
  }
});

async function login(page: Page, kind: "student" | "teacher", first: string, second: string, destination: string) {
  await openLogin(page, kind, first, second);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`), {
    timeout: 30_000,
  });
}

async function openLogin(page: Page, kind: "student" | "teacher", first: string, second: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: kind === "student" ? "تلميذ" : "أستاذ", exact: true }).click();
  await page.getByLabel("الاسم", { exact: true }).fill(first);
  await page.getByLabel(kind === "student" ? "الاسم العائلي" : "القسم", { exact: true }).fill(second);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
}

async function createAuthUser(kind: "direction" | "student") {
  const created = await admin.auth.admin.createUser({ email: internalEmail(kind), password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Auth user was not created");
  return created.data.user;
}

function internalEmail(kind: "direction" | "student") {
  return `${kind}-auth-lifecycle@accounts.test.invalid`;
}

function anonymousClient(): SupabaseClient {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
