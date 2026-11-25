import { LOCKED_CELLS, type Permission, type Role } from "@orderpilot/shared";
import { ConflictError } from "../../../common/domain-error.js";

/**
 * The few rules about editing the matrix itself. They are the stated promises
 * of the platform (the system admin never approves, posts or pays, and can
 * always edit the matrix), not the authorisation policy, which is area 4's to
 * write. No HTTP and no database here, so each rule is a plain unit test.
 */

function lockOf(role: Role, permission: Permission, kind: "never" | "always") {
  return LOCKED_CELLS.find(
    (cell) =>
      cell.role === role &&
      cell.permission === permission &&
      cell.kind === kind,
  );
}

/** Which rule of the matrix refused, and on what: what the audit row names. */
export type MatrixRefusal =
  | {
      readonly rule: "locked-cell";
      readonly permission: Permission;
      readonly lock: "never" | "always";
    }
  | { readonly rule: "same-role" };

/**
 * A rule of the matrix said no. It answers 409 as any conflict does, and
 * carries the rule, so the service can record the refusal (#378).
 */
export class MatrixRuleRefusedError extends ConflictError {
  constructor(
    message: string,
    readonly refusal: MatrixRefusal,
  ) {
    super(message);
  }
}

export function assertCanGrant(role: Role, permission: Permission): void {
  const lock = lockOf(role, permission, "never");
  if (lock) {
    throw new MatrixRuleRefusedError(lock.reason, {
      rule: "locked-cell",
      permission,
      lock: "never",
    });
  }
}

export function assertCanRevoke(role: Role, permission: Permission): void {
  const lock = lockOf(role, permission, "always");
  if (lock) {
    throw new MatrixRuleRefusedError(lock.reason, {
      rule: "locked-cell",
      permission,
      lock: "always",
    });
  }
}

export interface CopyPlan {
  readonly grant: readonly Permission[];
  readonly revoke: readonly Permission[];
}

/**
 * What it takes to make `target` hold exactly what `source` holds. Throws if
 * that would break a locked cell, so a copy never does what a single change
 * would refuse.
 */
export function planCopy(
  fromRole: Role,
  toRole: Role,
  source: readonly Permission[],
  target: readonly Permission[],
): CopyPlan {
  if (fromRole === toRole) {
    throw new MatrixRuleRefusedError(
      "Choose two different roles to copy between.",
      { rule: "same-role" },
    );
  }
  const wanted = new Set(source);
  const held = new Set(target);
  const grant = source.filter((permission) => !held.has(permission));
  const revoke = target.filter((permission) => !wanted.has(permission));
  grant.forEach((permission) => {
    assertCanGrant(toRole, permission);
  });
  revoke.forEach((permission) => {
    assertCanRevoke(toRole, permission);
  });
  return { grant, revoke };
}

/**
 * The default pairs the seed may add: every one except those revoked on
 * purpose (ADR 0053). A default that is merely missing stays in, so a
 * permission a later story adds still reaches an existing database.
 */
export function pairsToSeed(
  defaults: Readonly<Partial<Record<Role, readonly Permission[]>>>,
  revoked: readonly { readonly role: Role; readonly permission: string }[],
): { role: Role; permission: Permission }[] {
  const out = new Set(revoked.map((pair) => `${pair.role}:${pair.permission}`));
  return (Object.keys(defaults) as Role[]).flatMap((role) =>
    (defaults[role] ?? [])
      .filter((permission) => !out.has(`${role}:${permission}`))
      .map((permission) => ({ role, permission })),
  );
}

/** A role-permission pair, as the table holds it. */
export interface RolePermissionPair {
  readonly role: Role;
  readonly permission: string;
}

/**
 * What the table breaks of the locked cells (#383): a pair held where a lock
 * says never, and a pair missing where a lock says always. The matrix never
 * lets either happen, but a row put in or taken out another way (a script, an
 * older database) can, so the seed repairs them and records each repair.
 */
export function lockRepairs(held: readonly RolePermissionPair[]): {
  remove: { role: Role; permission: Permission }[];
  restore: { role: Role; permission: Permission }[];
} {
  const has = new Set(held.map((pair) => `${pair.role}:${pair.permission}`));
  const pair = (cell: (typeof LOCKED_CELLS)[number]) => ({
    role: cell.role,
    permission: cell.permission,
  });
  return {
    remove: LOCKED_CELLS.filter(
      (cell) =>
        cell.kind === "never" && has.has(`${cell.role}:${cell.permission}`),
    ).map(pair),
    restore: LOCKED_CELLS.filter(
      (cell) =>
        cell.kind === "always" && !has.has(`${cell.role}:${cell.permission}`),
    ).map(pair),
  };
}
