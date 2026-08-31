import "server-only";

import { z } from "zod";

import { getClientEnvironment } from "./client";

const serverEnvironmentSchema = z.object({
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),
  APP_BASE_URL: z.string().url(),
});

const privilegedServerEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  INTERACTION_HMAC_KEY: z.string().min(32),
  AUTH_INTERNAL_EMAIL_DOMAIN: z
    .string()
    .min(3)
    .regex(/^[a-z0-9.-]+$/),
  NOTIFICATION_WORKER_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(32).optional(),
  NOTIFICATION_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_EMAIL_WEBHOOK_TOKEN: z.string().min(16).optional(),
  NOTIFICATION_SMS_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_SMS_WEBHOOK_TOKEN: z.string().min(16).optional(),
  NOTIFICATION_PUSH_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_PUSH_WEBHOOK_TOKEN: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  TWILIO_ACCOUNT_SID: z.string().regex(/^AC[0-9a-f]{32}$/iu).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(16).optional(),
  TWILIO_FROM_NUMBER: z.string().regex(/^\+[1-9][0-9]{7,14}$/u).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().regex(/^MG[0-9a-f]{32}$/iu).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(40).optional(),
  VAPID_PRIVATE_KEY: z.string().min(30).optional(),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/u).optional(),
  OTP_HMAC_SECRET: z.string().min(32).optional(),
});

export function getServerEnvironment() {
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const appBaseUrl =
    process.env.APP_BASE_URL ?? (vercelHost ? `https://${vercelHost}` : undefined);

  return {
    ...getClientEnvironment(),
    ...serverEnvironmentSchema.parse({
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
      APP_BASE_URL: appBaseUrl,
    }),
  };
}

export function getPrivilegedServerEnvironment() {
  return {
    ...getServerEnvironment(),
    ...privilegedServerEnvironmentSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      INTERACTION_HMAC_KEY: process.env.INTERACTION_HMAC_KEY,
      AUTH_INTERNAL_EMAIL_DOMAIN: process.env.AUTH_INTERNAL_EMAIL_DOMAIN,
      NOTIFICATION_WORKER_SECRET: process.env.NOTIFICATION_WORKER_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
      NOTIFICATION_EMAIL_WEBHOOK_URL: process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
      NOTIFICATION_EMAIL_WEBHOOK_TOKEN: process.env.NOTIFICATION_EMAIL_WEBHOOK_TOKEN,
      NOTIFICATION_SMS_WEBHOOK_URL: process.env.NOTIFICATION_SMS_WEBHOOK_URL,
      NOTIFICATION_SMS_WEBHOOK_TOKEN: process.env.NOTIFICATION_SMS_WEBHOOK_TOKEN,
      NOTIFICATION_PUSH_WEBHOOK_URL: process.env.NOTIFICATION_PUSH_WEBHOOK_URL,
      NOTIFICATION_PUSH_WEBHOOK_TOKEN: process.env.NOTIFICATION_PUSH_WEBHOOK_TOKEN,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
      TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT,
      OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET,
    }),
  };
}
