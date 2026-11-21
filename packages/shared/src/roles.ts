import { z } from "zod";

export const ROLES = [
  "SYSTEM_ADMIN",
  "PRODUCT_MANAGER",
  "APPROVER",
  "SUPPORT",
  "WAREHOUSE",
  "FINANCE",
  "LOGISTICS",
  "MANAGEMENT",
  "AUDITOR",
] as const;

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/**
 * The roles the application is about to retire (ADR 0058). Today they are
 * still in ROLES, so nothing changes until the cut removes them from there.
 */
export const RETIRED_ROLES = ["MANAGEMENT", "AUDITOR"] as const;

/**
 * Every value of the database's role type, written out. Each audit event's hash
 * covers its actor's role and the trail is append-only, so a retired value
 * stays readable for ever (ADR 0058). Use it to read a role back from storage,
 * never to accept one: a request, a user or an audit writer takes `Role`.
 */
export const STORED_ROLES = [
  "SYSTEM_ADMIN",
  "PRODUCT_MANAGER",
  "APPROVER",
  "SUPPORT",
  "WAREHOUSE",
  "FINANCE",
  "LOGISTICS",
  "MANAGEMENT",
  "AUDITOR",
] as const;

export const storedRoleSchema = z.enum(STORED_ROLES);
export type StoredRole = z.infer<typeof storedRoleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: "System admin",
  PRODUCT_MANAGER: "Product manager",
  APPROVER: "Management approver",
  SUPPORT: "Support",
  WAREHOUSE: "Warehouse",
  FINANCE: "Finance",
  LOGISTICS: "Logistics",
  MANAGEMENT: "Management",
  AUDITOR: "Auditor",
};
