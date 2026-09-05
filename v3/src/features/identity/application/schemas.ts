import { z } from "zod";

import { APP_ROLES } from "@/types";
import { ACCOUNT_STATUSES } from "@/types";

import { isValidLoginAlias, normalizeLoginAlias } from "../domain/login-alias";

export const loginInputSchema = z.object({
  login: z.string().transform(normalizeLoginAlias).refine(isValidLoginAlias),
  password: z.string().min(1).max(128),
  kind: z.enum(["student", "teacher"]).optional(),
  firstName: z.string().max(80).optional(),
  secondValue: z.string().max(80).optional(),
}).superRefine(({ kind, firstName, secondValue }, context) => {
  const identityParts = [kind, firstName, secondValue];
  if (identityParts.some((value) => value !== undefined) && identityParts.some((value) => value === undefined)) {
    context.addIssue({ code: "custom", message: "incomplete_login_identity" });
  }
});

export const provisionAccountInputSchema = z.object({
  login: z.string().transform(normalizeLoginAlias).refine(isValidLoginAlias),
  temporaryPassword: z.string().min(10).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  roles: z.array(z.enum(APP_ROLES)).min(1).max(APP_ROLES.length),
  schoolId: z.string().uuid(),
  locale: z.enum(["ar", "fr", "en", "zgh"]).default("ar"),
}).superRefine(({ roles }, context) => {
  if (new Set(roles).size !== roles.length) {
    context.addIssue({ code: "custom", message: "duplicate_roles", path: ["roles"] });
  }
});

export const accountStatusInputSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES),
    suspensionReason: z.string().trim().min(3).max(500).nullable().default(null),
    schoolId: z.string().uuid(),
  })
  .superRefine(({ status, suspensionReason }, context) => {
    if (status === "suspended" && !suspensionReason) {
      context.addIssue({
        code: "custom",
        message: "suspension_reason_required",
        path: ["suspensionReason"],
      });
    }
    if (status !== "suspended" && suspensionReason) {
      context.addIssue({
        code: "custom",
        message: "suspension_reason_forbidden",
        path: ["suspensionReason"],
      });
    }
  });

export type LoginInput = z.infer<typeof loginInputSchema>;
export type ProvisionAccountInput = z.infer<typeof provisionAccountInputSchema>;
