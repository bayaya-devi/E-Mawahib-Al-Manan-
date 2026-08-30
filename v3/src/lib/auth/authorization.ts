import type { AppRole } from "@/types";

export const CAPABILITIES = {
  "learning:read-own": ["student", "parent", "teacher", "admin", "direction"],
  "learning:assess": ["teacher", "admin", "direction"],
  "account:create-basic": ["admin", "direction"],
  "account:create-privileged": ["direction"],
  "school:manage": ["admin", "direction"],
  "platform:manage": ["direction"],
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
