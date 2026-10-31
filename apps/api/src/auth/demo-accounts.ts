import { DEMO_PERSONAS, ROLES, type Role } from "@orderpilot/shared";

/**
 * One account per role, with the synthetic names from @orderpilot/shared. The
 * seed creates them and the demo sign-in finds them by this email. The
 * addresses use the reserved example.test domain, so nothing can be sent to
 * them.
 */
export interface DemoAccount {
  readonly role: Role;
  readonly displayName: string;
  readonly email: string;
}

export function demoEmail(role: Role): string {
  return `${role.toLowerCase().replaceAll("_", ".")}@example.test`;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = ROLES.map((role) => ({
  role,
  displayName: DEMO_PERSONAS[role],
  email: demoEmail(role),
}));
