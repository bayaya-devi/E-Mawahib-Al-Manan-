import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const requiredEnvironmentNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_INTERNAL_EMAIL_DOMAIN",
  "BOOTSTRAP_LOGIN",
  "BOOTSTRAP_PASSWORD",
  "BOOTSTRAP_FIRST_NAME",
  "BOOTSTRAP_LAST_NAME",
  "BOOTSTRAP_SCHOOL_NAME",
  "BOOTSTRAP_SCHOOL_CODE",
];

for (const name of requiredEnvironmentNames) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}
if (process.env.BOOTSTRAP_PASSWORD.length < 12) {
  throw new Error("BOOTSTRAP_PASSWORD must contain at least 12 characters");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const internalEmail = `${randomUUID()}@${process.env.AUTH_INTERNAL_EMAIL_DOMAIN}`;
const { data: created, error: authError } = await supabase.auth.admin.createUser({
  email: internalEmail,
  password: process.env.BOOTSTRAP_PASSWORD,
  email_confirm: true,
});

if (authError || !created.user) {
  throw new Error(`Auth bootstrap failed: ${authError?.code ?? "missing_user"}`);
}

const { data: schoolId, error: profileError } = await supabase.rpc(
  "bootstrap_direction_data",
  {
    target_user_id: created.user.id,
    target_login_alias: process.env.BOOTSTRAP_LOGIN,
    target_first_name: process.env.BOOTSTRAP_FIRST_NAME,
    target_last_name: process.env.BOOTSTRAP_LAST_NAME,
    target_school_name: process.env.BOOTSTRAP_SCHOOL_NAME,
    target_school_code: process.env.BOOTSTRAP_SCHOOL_CODE,
    target_locale: "ar",
  },
);

if (profileError) {
  await supabase.auth.admin.deleteUser(created.user.id);
  throw new Error(`Database bootstrap failed: ${profileError.code}`);
}

console.log(
  JSON.stringify({
    userId: created.user.id,
    schoolId,
    login: process.env.BOOTSTRAP_LOGIN,
  }),
);
