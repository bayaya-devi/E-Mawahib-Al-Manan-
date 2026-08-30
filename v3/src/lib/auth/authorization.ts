import type { AppRole } from "@/types";

export const CAPABILITIES = {
  "learning:read-own": ["student", "parent", "teacher", "admin", "super_admin"],
  "learning:assess": ["teacher", "admin", "super_admin"],
  "school:manage": ["admin", "super_admin"],
  "platform:manage": ["super_admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}

export function requireCapability(role: AppRole, capability: Capability): void {
  if (!can(role, capability)) {
    throw new AuthorizationError(capability);
  }
}

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor(readonly capability: Capability) {
    super("You are not allowed to perform this action.");
    this.name = "AuthorizationError";
  }
}
