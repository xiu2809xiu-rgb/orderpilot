import type { MatrixRead200Data } from "@/lib/api/generated/model";

export const PERMISSION_GROUPS = [
  "platform",
  "oversight",
  "masking",
  "orders",
  "tracking",
  "approvals",
  "workflows",
  "other",
] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

/** A Map, not an object, so a permission called "constructor.x" finds nothing. */
const GROUP_BY_PREFIX: ReadonlyMap<string, PermissionGroup> = new Map([
  ["users", "platform"],
  ["roles", "platform"],
  ["settings", "platform"],
  ["audit", "oversight"],
  ["aiUsage", "oversight"],
  ["masking", "masking"],
  ["documents", "orders"],
  ["orders", "orders"],
  ["tracker", "tracking"],
  ["exceptions", "tracking"],
  ["insights", "tracking"],
  ["approvals", "approvals"],
  ["payments", "approvals"],
  ["workflows", "workflows"],
  ["spr", "workflows"],
  ["tasks", "workflows"],
]);

/**
 * The group a permission is listed under, by the word before its first dot. A
 * permission another area adds lands in "other" until it is given a group, so
 * it can never drop out of the matrix.
 */
export function groupOf(permission: string): PermissionGroup {
  return GROUP_BY_PREFIX.get(permission.split(".", 1)[0] ?? "") ?? "other";
}

/** The groups worth offering: those with a permission in them, in display order. */
export function groupsIn(permissions: readonly string[]): PermissionGroup[] {
  const present = new Set(permissions.map(groupOf));
  return PERMISSION_GROUPS.filter((group) => present.has(group));
}

export interface MatrixFilters {
  readonly search: string;
  /** A role, or "" for every role. */
  readonly role: string;
  /** A permission group, or "" for every group. */
  readonly group: string;
}

export const NO_MATRIX_FILTERS: MatrixFilters = {
  search: "",
  role: "",
  group: "",
};

export interface FilteredMatrix {
  readonly matrix: MatrixRead200Data;
  /** The data scope is per role, so it goes when the rows are being narrowed. */
  readonly showDataScope: boolean;
}

/** What the matrix shows for these filters. The server's answer is left whole. */
export function filterMatrix(
  matrix: MatrixRead200Data,
  filters: MatrixFilters,
  labelOf: (permission: string) => string,
): FilteredMatrix {
  const words = filters.search.trim().toLowerCase();
  const permissions = matrix.permissions.filter(
    (permission) =>
      (filters.group === "" || groupOf(permission) === filters.group) &&
      (words === "" ||
        `${labelOf(permission)} ${permission}`.toLowerCase().includes(words)),
  );
  const roles =
    filters.role === ""
      ? matrix.roles
      : matrix.roles.filter((access) => access.role === filters.role);
  return {
    matrix: { ...matrix, permissions, roles },
    showDataScope: words === "" && filters.group === "",
  };
}
