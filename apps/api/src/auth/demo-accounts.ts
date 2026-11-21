import { DEMO_PERSONAS, type Role } from "@orderpilot/shared";

/**
 * A demo account, written out. The seed creates every account in the list and
 * the demo sign-in finds an offered one by its role. The addresses use the
 * reserved example.test domain, so nothing can be sent to them.
 *
 * The email is written out, not built from the role: a later step re-roles one
 * account (ADR 0058), and the account must keep the address that its setup
 * rows, its audit links and its password sign-in already use.
 */
export interface DemoAccount {
  readonly role: Role;
  readonly displayName: string;
  readonly email: string;
  /** Whether the sign-in page offers it as a demo button. */
  readonly offered: boolean;
}

/**
 * The account at the top of the sample approval chain, which the approval setup
 * seed finds by email. It is today's Management account, and a later step makes
 * it a second approver (ADR 0058), so the seed names its place, not its role.
 */
export const SECOND_APPROVER_EMAIL = "management@example.test";

/** The synthetic names come from @orderpilot/shared. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "SYSTEM_ADMIN",
    displayName: DEMO_PERSONAS.SYSTEM_ADMIN,
    email: "system.admin@example.test",
    offered: true,
  },
  {
    role: "PRODUCT_MANAGER",
    displayName: DEMO_PERSONAS.PRODUCT_MANAGER,
    email: "product.manager@example.test",
    offered: true,
  },
  {
    role: "APPROVER",
    displayName: DEMO_PERSONAS.APPROVER,
    email: "approver@example.test",
    offered: true,
  },
  {
    role: "SUPPORT",
    displayName: DEMO_PERSONAS.SUPPORT,
    email: "support@example.test",
    offered: true,
  },
  {
    role: "WAREHOUSE",
    displayName: DEMO_PERSONAS.WAREHOUSE,
    email: "warehouse@example.test",
    offered: true,
  },
  {
    role: "FINANCE",
    displayName: DEMO_PERSONAS.FINANCE,
    email: "finance@example.test",
    offered: true,
  },
  {
    role: "LOGISTICS",
    displayName: DEMO_PERSONAS.LOGISTICS,
    email: "logistics@example.test",
    offered: true,
  },
  {
    role: "MANAGEMENT",
    displayName: DEMO_PERSONAS.MANAGEMENT,
    email: SECOND_APPROVER_EMAIL,
    offered: true,
  },
  {
    role: "AUDITOR",
    displayName: DEMO_PERSONAS.AUDITOR,
    email: "auditor@example.test",
    offered: true,
  },
];

/** The accounts the sign-in page shows as demo buttons. */
export function offeredAccounts(): readonly DemoAccount[] {
  return DEMO_ACCOUNTS.filter((account) => account.offered);
}

/** The offered account for a role, or undefined when the page offers none. */
export function offeredAccountOf(role: Role): DemoAccount | undefined {
  return offeredAccounts().find((account) => account.role === role);
}

/** The email the demo account of a role has today. */
export function demoEmail(role: Role): string {
  return `${role.toLowerCase().replaceAll("_", ".")}@example.test`;
}
