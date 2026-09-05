import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const repair = process.argv.includes("--repair");
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("fr");
}

function deterministicUuid(namespace) {
  const hex = createHash("sha256").update(namespace).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.code ?? "query_failed"}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function readAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.users: ${error.code ?? "query_failed"}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function resolveId(alias) {
  const { data, error } = await client.rpc("resolve_login_alias", {
    target_login_alias: normalize(alias),
  });
  if (error) throw new Error(`resolve_login_alias: ${error.code ?? "query_failed"}`);
  return data ? String(data).split("@")[0] : null;
}

async function loadSnapshot() {
  const [
    legacyStudents,
    legacyTeachers,
    authUsers,
    profiles,
    roles,
    studentProfiles,
    teacherProfiles,
    adminProfiles,
    memberships,
    classes,
    enrollments,
    teacherAssignments,
  ] = await Promise.all([
    readAll("eleves", "username,is_suspended"),
    readAll("profs", "username,classe,students"),
    readAuthUsers(),
    readAll("profiles", "id,status"),
    readAll("user_roles", "user_id,role"),
    readAll("student_profiles", "user_id"),
    readAll("teacher_profiles", "user_id"),
    readAll("admin_profiles", "user_id"),
    readAll("school_memberships", "user_id,school_id,status"),
    readAll("classes", "id,name"),
    readAll("class_enrollments", "student_id,class_id,status"),
    readAll("class_teacher_assignments", "teacher_id,class_id,status"),
  ]);

  const studentIds = new Map();
  for (const student of legacyStudents) {
    studentIds.set(normalize(student.username), await resolveId(`s_${student.username}`));
  }
  const teacherIds = new Map();
  for (const teacher of legacyTeachers) {
    teacherIds.set(normalize(teacher.username), await resolveId(`t_${teacher.username}`));
  }

  return {
    legacyStudents,
    legacyTeachers,
    authUsers,
    profiles,
    roles,
    studentProfiles,
    teacherProfiles,
    adminProfiles,
    memberships,
    classes,
    enrollments,
    teacherAssignments,
    studentIds,
    teacherIds,
  };
}

function analyze(snapshot) {
  const authIds = new Set(snapshot.authUsers.map(({ id }) => id));
  const profileIds = new Set(snapshot.profiles.map(({ id }) => id));
  const studentProfileIds = new Set(snapshot.studentProfiles.map(({ user_id }) => user_id));
  const teacherProfileIds = new Set(snapshot.teacherProfiles.map(({ user_id }) => user_id));
  const adminProfileIds = new Set(snapshot.adminProfiles.map(({ user_id }) => user_id));
  const activeMemberIds = new Set(
    snapshot.memberships.filter(({ status }) => status === "active").map(({ user_id }) => user_id),
  );
  const activeEnrollmentIds = new Set(
    snapshot.enrollments.filter(({ status }) => status === "active").map(({ student_id }) => student_id),
  );
  const roles = new Map();
  for (const row of snapshot.roles) {
    const values = roles.get(row.user_id) ?? new Set();
    values.add(row.role);
    roles.set(row.user_id, values);
  }

  const structurallyValid = (id, role, subtypeIds) =>
    Boolean(
      id &&
        authIds.has(id) &&
        profileIds.has(id) &&
        subtypeIds.has(id) &&
        roles.get(id)?.has(role) &&
        activeMemberIds.has(id),
    );

  const brokenStudents = snapshot.legacyStudents.filter((student) => {
    const id = snapshot.studentIds.get(normalize(student.username));
    return !student.is_suspended && !structurallyValid(id, "student", studentProfileIds);
  });
  const brokenTeachers = snapshot.legacyTeachers.filter((teacher) => {
    const id = snapshot.teacherIds.get(normalize(teacher.username));
    return !structurallyValid(id, "teacher", teacherProfileIds);
  });
  const directionIds = snapshot.roles
    .filter(({ role }) => role === "direction")
    .map(({ user_id }) => user_id);
  const brokenAdmins = directionIds.filter(
    (id) => !structurallyValid(id, "direction", adminProfileIds),
  );

  const knownStudents = new Set(snapshot.legacyStudents.map(({ username }) => normalize(username)));
  const missingEnrollments = [];
  const staleTeacherReferences = new Set();
  for (const teacher of snapshot.legacyTeachers) {
    for (const legacyUsername of Array.isArray(teacher.students) ? teacher.students : []) {
      const normalizedUsername = normalize(legacyUsername);
      if (!knownStudents.has(normalizedUsername)) {
        staleTeacherReferences.add(normalizedUsername);
        continue;
      }
      const studentId = snapshot.studentIds.get(normalizedUsername);
      if (studentId && !activeEnrollmentIds.has(studentId)) {
        missingEnrollments.push({ studentId, teacher });
      }
    }
  }

  const authWithoutProfile = snapshot.authUsers.filter(({ id }) => !profileIds.has(id)).length;
  const profileWithoutAuth = snapshot.profiles.filter(({ id }) => !authIds.has(id)).length;
  const profileWithoutRole = snapshot.profiles.filter(({ id }) => !roles.has(id)).length;
  const duplicateAuthEmails =
    snapshot.authUsers.length -
    new Set(snapshot.authUsers.map(({ email }) => normalize(email))).size;

  return {
    brokenStudents,
    brokenTeachers,
    brokenAdmins,
    missingEnrollments,
    staleTeacherReferences,
    counts: {
      historical: snapshot.legacyStudents.length + snapshot.legacyTeachers.length + directionIds.length,
      students: snapshot.legacyStudents.length,
      teachers: snapshot.legacyTeachers.length,
      admins: directionIds.length,
      structurallyBroken:
        brokenStudents.length + brokenTeachers.length + brokenAdmins.length,
      missingEnrollments: new Set(missingEnrollments.map(({ studentId }) => studentId)).size,
      staleTeacherReferences: staleTeacherReferences.size,
      authWithoutProfile,
      profileWithoutAuth,
      profileWithoutRole,
      duplicateAuthEmails,
    },
  };
}

async function repairMissingEnrollments(snapshot, analysis) {
  const classByName = new Map(snapshot.classes.map((row) => [normalize(row.name), row.id]));
  const directionId = snapshot.roles.find(({ role }) => role === "direction")?.user_id;
  if (!directionId) throw new Error("direction account is required for reconciliation");

  const repaired = new Set();
  for (const { studentId, teacher } of analysis.missingEnrollments) {
    if (repaired.has(studentId)) continue;
    const teacherId = snapshot.teacherIds.get(normalize(teacher.username));
    const assignedClassIds = snapshot.teacherAssignments
      .filter(
        (row) => row.teacher_id === teacherId && row.status === "active",
      )
      .map(({ class_id }) => class_id);
    const classId = classByName.get(normalize(teacher.classe));
    if (!classId || !assignedClassIds.includes(classId)) continue;

    const { error } = await client.from("class_enrollments").insert({
      id: deterministicUuid(`v1:student-class:${studentId}`),
      class_id: classId,
      student_id: studentId,
      status: "active",
      created_by: directionId,
    });
    if (error && error.code !== "23505") {
      throw new Error(`class_enrollments: ${error.code ?? "insert_failed"}`);
    }
    repaired.add(studentId);
  }
  return repaired.size;
}

const beforeSnapshot = await loadSnapshot();
const before = analyze(beforeSnapshot);
const repaired = repair ? await repairMissingEnrollments(beforeSnapshot, before) : 0;
const after = repair ? analyze(await loadSnapshot()) : before;
const pass =
  after.counts.structurallyBroken === 0 &&
  after.counts.missingEnrollments === 0 &&
  after.counts.authWithoutProfile === 0 &&
  after.counts.profileWithoutAuth === 0 &&
  after.counts.profileWithoutRole === 0 &&
  after.counts.duplicateAuthEmails === 0;

console.log(
  JSON.stringify({
    pass,
    repairRequested: repair,
    repaired,
    before: before.counts,
    after: after.counts,
  }),
);

if (!pass) process.exitCode = 1;
