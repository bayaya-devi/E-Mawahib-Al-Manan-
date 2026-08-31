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
  NOTIFICATION_WORKER_SECRET: z.string().min(32).optional(),
  NOTIFICATION_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_EMAIL_WEBHOOK_TOKEN: z.string().min(16).optional(),
  NOTIFICATION_SMS_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_SMS_WEBHOOK_TOKEN: z.string().min(16).optional(),
  NOTIFICATION_PUSH_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_PUSH_WEBHOOK_TOKEN: z.string().min(16).optional(),
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
      NOTIFICATION_WORKER_SECRET: process.env.NOTIFICATION_WORKER_SECRET,
      NOTIFICATION_EMAIL_WEBHOOK_URL: process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
      NOTIFICATION_EMAIL_WEBHOOK_TOKEN: process.env.NOTIFICATION_EMAIL_WEBHOOK_TOKEN,
      NOTIFICATION_SMS_WEBHOOK_URL: process.env.NOTIFICATION_SMS_WEBHOOK_URL,
      NOTIFICATION_SMS_WEBHOOK_TOKEN: process.env.NOTIFICATION_SMS_WEBHOOK_TOKEN,
      NOTIFICATION_PUSH_WEBHOOK_URL: process.env.NOTIFICATION_PUSH_WEBHOOK_URL,
      NOTIFICATION_PUSH_WEBHOOK_TOKEN: process.env.NOTIFICATION_PUSH_WEBHOOK_TOKEN,
    }),
  };
}
