import { ROLES, type Role } from "@orderpilot/shared";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { sessionFor } from "@/test/fixtures";
import { MODULES } from "./define";
import {
  featuresFor,
  groupedMenu,
  HOME_ENTRY,
  isEntryActive,
  menuFor,
} from "./nav";
import { allFeatures } from "./registry";

/** A label as a person reads it. */
const en = (key: string) => i18n.t(key);

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    ...allFeatures.map((feature) => feature.namespace),
  ]);
});

const MASTER_DATA = ["Customers", "Vendors", "Items"];
const INBOX = ["Home", "My tasks"];

// What the default matrix gives each role. Sales, Purchasing, Warehouse,
// Finance and Documents are empty on purpose: no screen exists in them yet, and
// an empty module is not shown. Warehouse and Approver have short menus for
// that reason, not by mistake.
const EXPECTED: Record<Role, Record<string, readonly string[]>> = {
  SYSTEM_ADMIN: {
    home: ["Home"],
    system: ["Users", "Roles", "Audit log", "Monitoring"],
  },
  PRODUCT_MANAGER: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker", "KPIs"],
  },
  APPROVER: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker"],
  },
  SUPPORT: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions"],
  },
  WAREHOUSE: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions"],
  },
  FINANCE: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions"],
  },
  LOGISTICS: {
    home: INBOX,
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions"],
  },
  MANAGEMENT: {
    home: ["Home"],
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions", "KPIs"],
    system: ["Monitoring"],
  },
  AUDITOR: {
    home: ["Home"],
    masterData: MASTER_DATA,
    reports: ["Order tracker", "Exceptions", "KPIs"],
    system: ["Roles", "Audit log", "Monitoring"],
  },
};

function labelsOf(role: Role) {
  return Object.fromEntries(
    groupedMenu(menuFor(sessionFor(role))).map((group) => [
      group.module,
      group.entries.map((entry) => en(entry.label)),
    ]),
  );
}

describe("menus by role", () => {
  it.each(ROLES)("%s gets its modules and entries, in order", (role) => {
    expect(labelsOf(role)).toEqual(EXPECTED[role]);
  });

  it("shows only the areas a role's permissions open", () => {
    const admin = featuresFor(sessionFor("SYSTEM_ADMIN")).map((f) => f.id);
    expect(admin).toContain("governance");
    expect(admin).toContain("audit");
    expect(admin).not.toContain("master-data");

    const warehouse = featuresFor(sessionFor("WAREHOUSE")).map((f) => f.id);
    expect(warehouse).toContain("exceptions");
    expect(warehouse).not.toContain("governance");
    expect(warehouse).not.toContain("audit");
  });

  it("shows nothing without a session", () => {
    expect(featuresFor(null)).toEqual([]);
    expect(menuFor(null)).toEqual([]);
  });

  it("drops a module with no entry for the role and keeps the order", () => {
    const modules = groupedMenu(menuFor(sessionFor("SYSTEM_ADMIN"))).map(
      (group) => group.module,
    );
    expect(modules).toEqual(["home", "system"]);
    expect(MODULES).toEqual([
      "home",
      "sales",
      "purchasing",
      "warehouse",
      "finance",
      "documents",
      "masterData",
      "reports",
      "system",
    ]);
  });

  it("gives only the roles with an inbox a My tasks entry", () => {
    const withInbox = ROLES.filter((role) =>
      menuFor(sessionFor(role)).some((e) => e.id === "workflows.myTasks"),
    );
    expect(withInbox).toEqual([
      "PRODUCT_MANAGER",
      "APPROVER",
      "SUPPORT",
      "WAREHOUSE",
      "FINANCE",
      "LOGISTICS",
    ]);
  });

  it("needs the entry's own permission as well as the feature's", () => {
    const session = sessionFor("SYSTEM_ADMIN");
    const withoutUsers = {
      ...session,
      permissions: session.permissions.filter((p) => p !== "users.read"),
    };
    const labels = menuFor(withoutUsers).map((e) => en(e.label));
    expect(labels).toContain("Roles");
    expect(labels).not.toContain("Users");
  });
});

describe("menu entries", () => {
  const entries = allFeatures.flatMap((feature) => feature.menu);

  it("have a unique id, a real module and a label that reads", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(MODULES).toContain(entry.module);
      expect(en(entry.label), entry.id).not.toBe(entry.label);
    }
  });

  it("carry a count only where work waits", () => {
    const counted = entries.filter((e) => e.count).map((e) => e.id);
    expect(counted.sort()).toEqual([
      "exceptions.exceptions",
      "workflows.myTasks",
    ]);
  });

  it("count the same list as the home tile that opens it", () => {
    const apis = new Set(
      allFeatures.flatMap((feature) => feature.cues.map((cue) => cue.api)),
    );
    for (const entry of entries) {
      if (entry.count) expect(apis.has(entry.count.api), entry.id).toBe(true);
    }
  });

  it("tell two tabs of one page apart", () => {
    const users = entries.find((e) => e.id === "governance.users");
    const roles = entries.find((e) => e.id === "governance.roles");
    if (!users || !roles) throw new Error("governance entries are missing");
    const at = (search: string) => ({ pathname: "/governance", search });
    expect(isEntryActive(users, at("?tab=users"))).toBe(true);
    expect(isEntryActive(roles, at("?tab=users"))).toBe(false);
    // The page opens the roles tab when the address names none.
    expect(isEntryActive(roles, at(""))).toBe(true);
    expect(isEntryActive(users, at(""))).toBe(false);
    expect(
      isEntryActive(users, { pathname: "/audit", search: "?tab=users" }),
    ).toBe(false);
  });

  it("mark Home only on the home page", () => {
    expect(isEntryActive(HOME_ENTRY, { pathname: "/", search: "" })).toBe(true);
    expect(isEntryActive(HOME_ENTRY, { pathname: "/audit", search: "" })).toBe(
      false,
    );
  });
});
