export const APP_ROLES = [
  "student",
  "parent",
  "teacher",
  "admin",
  "direction",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ACCOUNT_STATUSES = ["pending", "active", "suspended", "archived"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

declare const entityIdBrand: unique symbol;

export type EntityId<Entity extends string> = string & {
  readonly [entityIdBrand]: Entity;
};

export type UserId = EntityId<"User">;
export type SchoolId = EntityId<"School">;
export type ClassId = EntityId<"Class">;

export type ISODateTime = string;

export interface AuditMetadata {
  actorId: UserId | null;
  occurredAt: ISODateTime;
  requestId: string | null;
}
