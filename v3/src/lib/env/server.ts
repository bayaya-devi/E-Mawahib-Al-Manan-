import "server-only";

import { z } from "zod";

import { getClientEnvironment } from "./client";

const serverEnvironmentSchema = z.object({
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),
  APP_BASE_URL: z.string().url(),
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
