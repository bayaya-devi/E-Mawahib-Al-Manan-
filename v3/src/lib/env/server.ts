import "server-only";

import { z } from "zod";

import { getClientEnvironment } from "./client";

const serverEnvironmentSchema = z.object({
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),
  APP_BASE_URL: z.string().url(),
});

const privilegedServerEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PUBLIC_INTERACTION_HMAC_KEY: z.string().min(32),
  AUTH_INTERNAL_EMAIL_DOMAIN: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+$/),
});

export function getServerEnvironment() {
  return {
    ...getClientEnvironment(),
    ...serverEnvironmentSchema.parse({
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
      APP_BASE_URL: process.env.APP_BASE_URL,
    }),
  };
}

export function getPrivilegedServerEnvironment() {
  return {
    ...getServerEnvironment(),
    ...privilegedServerEnvironmentSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      PUBLIC_INTERACTION_HMAC_KEY: process.env.PUBLIC_INTERACTION_HMAC_KEY,
      AUTH_INTERNAL_EMAIL_DOMAIN: process.env.AUTH_INTERNAL_EMAIL_DOMAIN,
    }),
  };
}
