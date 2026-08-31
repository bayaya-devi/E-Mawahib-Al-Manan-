import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const [sourceDirectory, reportPath] = process.argv.slice(2);
const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AUTH_INTERNAL_EMAIL_DOMAIN", "LEGACY_AUTH_HMAC_KEY", "V3_DIRECTION_PASSWORD"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);
if (!sourceDirectory || !reportPath) throw new Error("Usage: node scripts/migration/import-v1-production.mjs <backup-directory> <report.json>");

const nativeFetch = globalThis.fetch.bind(globalThis);
async function resilientFetch(input, init) {
  let lastError;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const response = await nativeFetch(input, init);
      if (response.status < 500 || attempt === 6) return response;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
  throw lastError ?? new Error("Supabase request failed");
}
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: resilientFetch } });
const read = async (name) => JSON.parse(await readFile(join(sourceDirectory, `${name}.json`), "utf8"));
const [students, teachers, progressions, assignments] = await Promise.all(["eleves", "profs", "progressions", "devoirs"].map(read));
const report = { startedAt: new Date().toISOString(), source: { students: students.length, teachers: teachers.length, progressions: progressions.length, assignments: assignments.length }, migrated: { students: 0, teachers: 0, progressions: 0, assignments: 0 }, review: [] };

function derivedPassword(login, encoded) {
  let plain;
  try { plain = Buffer.from(String(encoded), "base64").toString("utf8"); } catch { plain = String(encoded ?? ""); }
  return createHmac("sha256", process.env.LEGACY_AUTH_HMAC_KEY).update(`e-mawahib-v1:${login}:${plain}`).digest("hex");
}
function internalEmail(id) { return `${id}@${process.env.AUTH_INTERNAL_EMAIL_DOMAIN}`; }
function deterministicUuid(namespace) {
  const hex = createHash("sha256").update(namespace).digest("hex").slice(0, 32).split("");
  hex[12] = "4"; hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}
async function must(result, label) { if (result.error) throw new Error(`${label}: ${result.error.code ?? "error"} ${result.error.message ?? ""} ${result.error.details ?? ""}`.trim()); return result.data; }
async function retry(operation, attempts = 6) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { result = await operation(); } catch (error) { result = { error }; }
    if (!result?.error) return result;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  return result;
}

let directionId;
let schoolId;
const existingDirection = await must(await client.from("user_roles").select("user_id").eq("role", "direction").limit(1).maybeSingle(), "read direction");
if (existingDirection) {
  directionId = existingDirection.user_id;
  schoolId = (await must(await client.from("school_memberships").select("school_id").eq("user_id", directionId).eq("status", "active").limit(1).single(), "read school")).school_id;
} else {
  directionId = randomUUID();
  await must(await retry(() => client.auth.admin.createUser({ id: directionId, email: internalEmail(directionId), password: process.env.V3_DIRECTION_PASSWORD, email_confirm: true })), "create direction auth");
  schoolId = await must(await client.rpc("bootstrap_direction_data", { target_user_id: directionId, target_login_alias: "t_auti1.487", target_first_name: "الإدارة", target_last_name: "مواهب المنان", target_school_name: "جمعية مواهب المنان", target_school_code: "EMM-AIN-AOUDA", target_locale: "ar" }), "bootstrap direction");
}

const accountIds = new Map();
const studentIds = new Set();
const teacherIds = new Set();
const accountKey = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("fr");
async function importAccount(row, role) {
  const rawLogin = accountKey(row.username);
  const login = `${role === "student" ? "s" : "t"}_${rawLogin}`;
  const resolved = await must(await client.rpc("resolve_login_alias", { target_login_alias: login }), `resolve ${role}`);
  if (resolved) {
    const existing = await must(await client.from("profiles").select("id").eq("id", resolved.split("@")[0]).maybeSingle(), `find ${role}`);
    if (existing) {
      await must(await retry(() => client.auth.admin.updateUserById(existing.id, { password: derivedPassword(login, row.password) })), `refresh ${role} auth`);
      accountIds.set(rawLogin, existing.id);
      (role === "student" ? studentIds : teacherIds).add(existing.id);
      return existing.id;
    }
  }
  const id = randomUUID();
  const password = derivedPassword(login, row.password);
  const email = internalEmail(id);
  await must(await retry(() => client.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { migrated_from: "v1", requires_password_reset: true } })), `create ${role} auth`);
  const lastName = role === "student" ? String(row.nom ?? "-") : String(row.classe ?? "-");
  const provision = await client.rpc("provision_account_data", { target_user_id: id, target_login_alias: login, target_first_name: String(row.prenom ?? "-"), target_last_name: lastName, target_roles: [role], target_school_id: schoolId, actor_user_id: directionId, target_locale: "ar" });
  if (provision.error) { await client.auth.admin.deleteUser(id); throw new Error(`provision ${role}: ${provision.error.code ?? provision.error.message}`); }
  const status = role === "student" && row.is_suspended ? "suspended" : "active";
  await must(await client.rpc("set_account_status", { target_user_id: id, target_status: status, target_suspension_reason: status === "suspended" ? "حساب موقوف في النسخة السابقة" : null, actor_user_id: directionId, target_school_id: schoolId }), `activate ${role}`);
  accountIds.set(rawLogin, id);
  (role === "student" ? studentIds : teacherIds).add(id);
  report.migrated[`${role}s`] += 1;
  return id;
}

async function importInBatches(rows, role) {
  for (let index = 0; index < rows.length; index += 5) {
    await Promise.all(rows.slice(index, index + 5).map((row) => importAccount(row, role)));
  }
}
await importInBatches(teachers, "teacher");
await importInBatches(students, "student");

const classIds = new Map();
for (const teacher of teachers) {
  const name = String(teacher.classe ?? "").trim();
  if (!name) { report.review.push({ kind: "teacher_without_class", legacyId: teacher.username }); continue; }
  let classId = classIds.get(name);
  if (!classId) {
    const row = await must(await client.from("classes").upsert({ school_id: schoolId, name }, { onConflict: "school_id,name" }).select("id").single(), "upsert class");
    classId = row.id; classIds.set(name, classId);
  }
  const teacherId = accountIds.get(accountKey(teacher.username));
  if (!teacherIds.has(teacherId)) { report.review.push({ kind: "invalid_teacher_assignment", legacyId: teacher.username }); continue; }
  await must(await client.from("class_teacher_assignments").upsert({ id: deterministicUuid(`v1:teacher-class:${teacher.username}:${name}`), class_id: classId, teacher_id: teacherId, assignment_kind: "primary", status: "active", created_by: directionId }, { onConflict: "id" }), "assign teacher");
  for (const username of Array.isArray(teacher.students) ? teacher.students : []) {
    const studentId = accountIds.get(accountKey(username));
    if (!studentId || !studentIds.has(studentId)) { report.review.push({ kind: "unknown_student_assignment", legacyId: username }); continue; }
    const current = await must(await client.from("class_enrollments").select("id,class_id").eq("student_id", studentId).eq("status", "active").maybeSingle(), "read enrollment");
    if (!current) await must(await client.from("class_enrollments").insert({ id: deterministicUuid(`v1:student-class:${username}`), class_id: classId, student_id: studentId, status: "active", created_by: directionId }), "enroll student");
  }
}

const surahs = await must(await client.from("quran_surahs").select("number,slug,name_arabic"), "read surahs");
const surahBySlug = new Map(surahs.map((row) => [row.slug, row.number]));
const normalizeArabic = (value) => String(value ?? "").normalize("NFD").replace(/[\u064B-\u065F\u0670]/gu, "").replace(/[^\u0600-\u06FF]/gu, "");
const surahByArabic = new Map(surahs.map((row) => [normalizeArabic(row.name_arabic).replace(/^سورة/u, ""), row.number]));
const progressRows = [];
for (const row of progressions) {
  const studentId = accountIds.get(accountKey(row.username));
  const surahNumber = surahBySlug.get(String(row.surah_id));
  if (!studentId) { report.review.push({ kind: "progression_student_unmapped", legacyId: `${row.username}:${row.surah_id}` }); continue; }
  if (!surahNumber) { report.review.push({ kind: "progression_surah_unmapped", legacyId: `${row.username}:${row.surah_id}` }); continue; }
  progressRows.push({ student_id: studentId, surah_number: surahNumber, status: "mastered", completion_percent: 100, highest_completed_step: Math.max(1, Object.keys(row.activities ?? {}).length), stars: 3, started_at: row.completed_at ?? null, mastered_at: row.completed_at ?? null, last_activity_at: row.completed_at ?? null });
}
for (let index = 0; index < progressRows.length; index += 250) await must(await client.from("student_surah_progress").upsert(progressRows.slice(index, index + 250), { onConflict: "student_id,surah_number" }), "import progress");
report.migrated.progressions = progressRows.length;

for (const row of assignments) {
  const studentId = accountIds.get(accountKey(row.student_id));
  const teacherId = accountIds.get(accountKey(row.prof_id));
  const name = normalizeArabic(row.surate).replace(/^سورة/u, "");
  const surahNumber = surahByArabic.get(name) ?? null;
  if (!studentId || !teacherId) { report.review.push({ kind: "assignment_unmapped", legacyId: row.id }); continue; }
  const id = deterministicUuid(`v1:assignment:${row.id}`);
  await must(await client.from("assignments").upsert({ id, school_id: schoolId, student_id: studentId, teacher_id: teacherId, title: "واجب قرآني", surah_number: surahNumber, verse_from: Number(row.aya_debut) || null, verse_to: Number(row.aya_fin) || null, due_at: null, created_at: row.created_at ?? new Date().toISOString() }, { onConflict: "id" }), "import assignment");
  const status = row.statut === "termine" ? "submitted" : "todo";
  await must(await client.from("assignment_submissions").upsert({ assignment_id: id, student_id: studentId, status, submitted_at: status === "submitted" ? row.created_at ?? new Date().toISOString() : null }, { onConflict: "assignment_id,student_id" }), "import assignment status");
  report.migrated.assignments += 1;
}

report.completedAt = new Date().toISOString();
report.schoolId = schoolId;
report.directionId = directionId;
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: report.review.length === 0, source: report.source, migrated: report.migrated, reviewCount: report.review.length }));
