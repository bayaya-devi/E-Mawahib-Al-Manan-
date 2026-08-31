import type { AppRole } from "@/types";

const workspaceRoles: ReadonlyArray<readonly [string, readonly AppRole[]]> = [
  ["/admin", ["admin", "direction"]],
  ["/teacher", ["teacher"]],
  ["/family", ["parent"]],
  ["/student", ["student"]],
];

export function requiredRolesForPath(pathname: string): readonly AppRole[] | null {
  const match = workspaceRoles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match?.[1] ?? null;
}

export function mayAccessPath(pathname: string, roles: readonly AppRole[]): boolean {
  const required = requiredRolesForPath(pathname);
  return !required || required.some((role) => roles.includes(role));
}
