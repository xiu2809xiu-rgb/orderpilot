import {
  DEFAULT_DATA_SCOPES,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_CELLS,
  PERMISSIONS,
  ROLES,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  NO_MATRIX_FILTERS,
  filterMatrix,
  groupOf,
  groupsIn,
  type MatrixFilters,
} from "./matrixFilter";

const matrix = {
  permissions: [...PERMISSIONS],
  roles: ROLES.map((role) => ({
    role,
    permissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
    dataScope: DEFAULT_DATA_SCOPES[role],
  })),
  locked: [...LOCKED_CELLS],
};

const LABELS: Readonly<Record<string, string>> = {
  "orders.edit": "Edit draft orders",
  "approvals.decide": "Approve or reject",
};
const labelOf = (permission: string): string =>
  LABELS[permission] ?? "A permission";

const run = (filters: Partial<MatrixFilters>) =>
  filterMatrix(matrix, { ...NO_MATRIX_FILTERS, ...filters }, labelOf);
const rolesOf = (result: ReturnType<typeof run>) =>
  result.matrix.roles.map((access) => access.role);

describe("the permission groups", () => {
  it.each([
    ["users.manage", "platform"],
    ["roles.read", "platform"],
    ["settings.manage", "platform"],
    ["audit.read", "oversight"],
    ["aiUsage.read", "oversight"],
    ["masking.customerNote", "masking"],
    ["documents.upload", "orders"],
    ["orders.edit", "orders"],
    ["tracker.read", "tracking"],
    ["exceptions.read", "tracking"],
    ["insights.read", "tracking"],
    ["approvals.decide", "approvals"],
    ["payments.post", "approvals"],
    ["workflows.inboxes.any", "workflows"],
    ["spr.read", "workflows"],
    ["tasks.complete", "workflows"],
  ])("puts %s in %s", (permission, group) => {
    expect(groupOf(permission)).toBe(group);
  });

  it("puts a permission nobody has grouped under other, so it still shows", () => {
    expect(groupOf("reports.read")).toBe("other");
  });

  it("is not fooled by a permission named after an object's own keys", () => {
    expect(groupOf("constructor.read")).toBe("other");
    expect(groupOf("__proto__.read")).toBe("other");
  });

  it("offers only the groups that have a permission, in display order", () => {
    expect(groupsIn(["payments.post", "users.read", "orders.read"])).toEqual([
      "platform",
      "orders",
      "approvals",
    ]);
    expect(groupsIn(["users.read", "reports.read"])).toEqual([
      "platform",
      "other",
    ]);
  });

  it("offers Masking for the masking rows, not Other (walkthrough gap A11)", () => {
    const groups = groupsIn(matrix.permissions);
    expect(groups).toContain("masking");
    const masking = matrix.permissions.filter((p) => p.startsWith("masking."));
    expect(masking.length).toBeGreaterThan(0);
    expect(masking.map(groupOf)).toEqual(masking.map(() => "masking"));
    expect(
      run({ group: "masking" }).matrix.permissions.every((p) =>
        p.startsWith("masking."),
      ),
    ).toBe(true);
  });
});

describe("filtering the matrix", () => {
  it("changes nothing with no filters, and shows the data scope", () => {
    const result = run({});
    expect(result.matrix.permissions).toEqual([...PERMISSIONS]);
    expect(rolesOf(result)).toEqual([...ROLES]);
    expect(result.showDataScope).toBe(true);
  });

  it("finds a permission by its label, ignoring case", () => {
    expect(run({ search: "DRAFT" }).matrix.permissions).toEqual([
      "orders.edit",
    ]);
  });

  it("finds a permission by its key", () => {
    expect(run({ search: "tasks.complete" }).matrix.permissions).toEqual([
      "tasks.complete",
    ]);
  });

  it("ignores the spaces around what is typed", () => {
    expect(run({ search: "  draft  " }).matrix.permissions).toEqual([
      "orders.edit",
    ]);
  });

  it("treats a search of only spaces as no search", () => {
    const result = run({ search: "   " });
    expect(result.matrix.permissions).toEqual([...PERMISSIONS]);
    expect(result.showDataScope).toBe(true);
  });

  it("leaves one role's column and every row for a role filter, with the data scope", () => {
    const result = run({ role: "FINANCE" });
    expect(rolesOf(result)).toEqual(["FINANCE"]);
    expect(result.matrix.permissions).toEqual([...PERMISSIONS]);
    expect(result.showDataScope).toBe(true);
  });

  it("leaves one group's rows and every role for a group filter, without the data scope", () => {
    const result = run({ group: "approvals" });
    expect(result.matrix.permissions).toEqual([
      "approvals.decide",
      "payments.confirm",
      "payments.post",
    ]);
    expect(rolesOf(result)).toEqual([...ROLES]);
    expect(result.showDataScope).toBe(false);
  });

  it("hides the data scope while searching", () => {
    expect(run({ search: "draft" }).showDataScope).toBe(false);
  });

  it("applies the search, the role and the group together", () => {
    const result = run({
      search: "approve",
      role: "APPROVER",
      group: "approvals",
    });
    expect(result.matrix.permissions).toEqual(["approvals.decide"]);
    expect(rolesOf(result)).toEqual(["APPROVER"]);
  });

  it("finds nothing when nothing matches", () => {
    expect(run({ search: "no such permission" }).matrix.permissions).toEqual(
      [],
    );
  });

  it("keeps the locked cells, so a lock still shows", () => {
    expect(run({ role: "SYSTEM_ADMIN" }).matrix.locked).toEqual([
      ...LOCKED_CELLS,
    ]);
  });
});
