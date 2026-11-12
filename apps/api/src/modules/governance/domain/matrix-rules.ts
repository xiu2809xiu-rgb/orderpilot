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

export function assertCanGrant(role: Role, permission: Permission): void {
  const lock = lockOf(role, permission, "never");
  if (lock) throw new ConflictError(lock.reason);
}

export function assertCanRevoke(role: Role, permission: Permission): void {
  const lock = lockOf(role, permission, "always");
  if (lock) throw new ConflictError(lock.reason);
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
    throw new ConflictError("Choose two different roles to copy between.");
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
