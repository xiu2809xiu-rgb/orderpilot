import { DEFAULT_ROLE_PERMISSIONS } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import governance from "@/locales/en/governance.json";
import settings from "@/locales/en/settings.json";
import { describeAccess, type Translate } from "./accessGroups";

/**
 * The real locale files, read the way i18next reads them: dotted paths into
 * nested objects. Own keys only, and a reduce rather than a loop that walks an
 * object by key: Semgrep's prototype-pollution rule refuses that loop.
 */
function lookup(source: unknown, path: string): string | undefined {
  const found = path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null && Object.hasOwn(node, part)
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
  return typeof found === "string" ? found : undefined;
}

const t: Translate = (key, options) => {
  const [first, rest] = key.includes(":") ? key.split(":") : ["settings", key];
  const source = first === "governance" ? governance : settings;
  return lookup(source, rest ?? key) ?? options?.defaultValue ?? key;
};

const sentences = (permissions: readonly string[]) =>
  Object.fromEntries(
    describeAccess(permissions, t).map((group) => [
      group.title,
      group.sentence,
    ]),
  );

describe("describeAccess", () => {
  it("tells a support role's access one line to each kind of work", () => {
    expect(sentences(DEFAULT_ROLE_PERMISSIONS.SUPPORT)).toEqual({
      Orders: "View, create and edit draft orders",
      Documents: "View and upload documents",
      Tracking:
        "Follow orders in the tracker, check exceptions and see workflows and tasks",
      "Tasks and approvals": "Complete tasks assigned to you",
      "Sensitive data": "See the sample customer note",
    });
  });

  it("tells the system admin's access, which holds none of the work", () => {
    expect(sentences(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ADMIN)).toEqual({
      People: "View, add and disable users",
      "Roles and access": "View and change what each role can do",
      "System and audit":
        "Change system settings, see AI usage and cost and read the audit log",
    });
  });

  it("joins two with and, three with a comma and and, and starts with a capital", () => {
    expect(sentences(["documents.read", "documents.upload"])).toEqual({
      Documents: "View and upload documents",
    });
    expect(sentences(["orders.read"])).toEqual({ Orders: "View orders" });
  });

  it("keeps a permission it has no wording for, under Other, with the governance label", () => {
    expect(sentences(["orders.read", "documents.read", "exports.run"])).toEqual(
      {
        Orders: "View orders",
        Documents: "View documents",
        Other: "Exports.run",
      },
    );
  });

  it("says nothing for a role with no permissions", () => {
    expect(describeAccess([], t)).toEqual([]);
  });

  it("never shows a permission code", () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      const text = JSON.stringify(describeAccess(permissions, t));
      for (const code of permissions) expect(text).not.toContain(code);
    }
  });
});
