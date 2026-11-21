import { DEMO_PERSONAS, ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNTS,
  SECOND_APPROVER_EMAIL,
  demoEmail,
  offeredAccountOf,
  offeredAccounts,
} from "./demo-accounts.js";

/** Today's nine demo emails, written out so that a changed one fails here. */
const TODAY_EMAILS: Record<(typeof ROLES)[number], string> = {
  SYSTEM_ADMIN: "system.admin@example.test",
  PRODUCT_MANAGER: "product.manager@example.test",
  APPROVER: "approver@example.test",
  SUPPORT: "support@example.test",
  WAREHOUSE: "warehouse@example.test",
  FINANCE: "finance@example.test",
  LOGISTICS: "logistics@example.test",
  MANAGEMENT: "management@example.test",
  AUDITOR: "auditor@example.test",
};

describe("the demo accounts", () => {
  it("has the nine emails of today, one for each role", () => {
    expect(DEMO_ACCOUNTS).toHaveLength(9);
    for (const account of DEMO_ACCOUNTS) {
      expect(account.email).toBe(TODAY_EMAILS[account.role]);
    }
    expect(DEMO_ACCOUNTS.map((account) => account.email).sort()).toEqual(
      Object.values(TODAY_EMAILS).sort(),
    );
  });

  it("gives every account a unique email", () => {
    const emails = DEMO_ACCOUNTS.map((account) => account.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("offers exactly one account for each role", () => {
    for (const role of ROLES) {
      expect(
        offeredAccounts().filter((account) => account.role === role),
      ).toHaveLength(1);
      expect(offeredAccountOf(role)?.email).toBe(TODAY_EMAILS[role]);
    }
  });

  it("offers all nine today, in the order of ROLES", () => {
    expect(offeredAccounts().map((account) => account.role)).toEqual([
      ...ROLES,
    ]);
  });

  it("names each account as the synthetic persona of its role", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(account.displayName).toBe(DEMO_PERSONAS[account.role]);
    }
  });

  it("keeps demoEmail answering what it answered before the list was written out", () => {
    for (const role of ROLES) expect(demoEmail(role)).toBe(TODAY_EMAILS[role]);
  });

  it("puts the second approver's email in the list, as Management's account", () => {
    const account = DEMO_ACCOUNTS.find(
      (entry) => entry.email === SECOND_APPROVER_EMAIL,
    );
    expect(account?.role).toBe("MANAGEMENT");
  });
});
