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

export const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: "System admin",
  PRODUCT_MANAGER: "Product manager",
  APPROVER: "Approver",
  SUPPORT: "Support",
  WAREHOUSE: "Warehouse",
  FINANCE: "Finance",
  LOGISTICS: "Logistics",
  MANAGEMENT: "Management",
  AUDITOR: "Auditor",
};
