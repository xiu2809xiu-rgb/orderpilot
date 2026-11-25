import type { INestApplicationContext } from "@nestjs/common";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { Database } from "../../database/database.js";
import { lockRepairs, pairsToSeed } from "./domain/matrix-rules.js";
import { RevokedPermissionRepository } from "./revoked-permission.repository.js";

/**
 * Adds each default pair the matrix lacks, except one someone revoked on
 * purpose (ADR 0053). A default that is only missing is still added, so a
 * permission a later story brings reaches an existing database. Safe to run
 * again, and says what it did in one line.
 */
export async function seedRolePermissions(
  app: INestApplicationContext,
): Promise<string> {
  const revoked = await app
    .get(RevokedPermissionRepository, { strict: false })
    .all();
  const pairs = pairsToSeed(DEFAULT_ROLE_PERMISSIONS, revoked);
  const added = await app
    .get(RolePermissionRepository, { strict: false })
    .addMissing(pairs);
  const defaults = Object.values(DEFAULT_ROLE_PERMISSIONS).flat().length;
  const left = defaults - pairs.length;
  const repaired = await repairLockedCells(app);
  const done =
    added === 0
      ? `the matrix holds all ${String(pairs.length)} default pairs`
      : `added ${String(added)} of ${String(pairs.length)} default pairs to the matrix`;
  const kept =
    left === 0
      ? done
      : `${done}, and ${String(left)} revoked on purpose ${left === 1 ? "stays" : "stay"} out`;
  return repaired === 0
    ? kept
    : `${kept}; repaired ${String(repaired)} locked ${repaired === 1 ? "cell" : "cells"}`;
}

/**
 * Puts the locked cells right (#383): takes away a pair a lock says never,
 * and gives back one a lock says always, even if it was revoked before the
 * lock existed. The matrix never allows either, but a row changed another way
 * can. Each repair commits with its own audit row, by the seed, so a second
 * run finds nothing and records nothing.
 */
async function repairLockedCells(
  app: INestApplicationContext,
): Promise<number> {
  const permissions = app.get(RolePermissionRepository, { strict: false });
  const revoked = app.get(RevokedPermissionRepository, { strict: false });
  const audit = app.get(AuditService, { strict: false });
  const database = app.get(Database, { strict: false });
  const { remove, restore } = lockRepairs(await permissions.all());
  const record = (
    pair: { role: Role; permission: Permission },
    granted: boolean,
  ) =>
    audit.record({
      actor: { kind: "system", name: "seed" },
      action: granted
        ? "governance.permission.granted"
        : "governance.permission.revoked",
      entityType: "RolePermission",
      entityId: `${pair.role}:${pair.permission}`,
      summary: `The seed ${granted ? "gave back" : "took away"} ${pair.permission} ${granted ? "to" : "from"} ${ROLE_LABELS[pair.role]}, as its locked cell says`,
      changes: {
        role: pair.role,
        permission: pair.permission,
        granted: { from: !granted, to: granted },
        rule: "locked-cell",
        lock: granted ? "always" : "never",
      },
      traceId: "seed",
    });
  for (const pair of remove) {
    await database.transaction(async () => {
      await permissions.revoke(pair.role, pair.permission);
      await record(pair, false);
    });
  }
  for (const pair of restore) {
    await database.transaction(async () => {
      await permissions.grant(pair.role, pair.permission);
      await revoked.forget(pair.role, pair.permission);
      await record(pair, true);
    });
  }
  return remove.length + restore.length;
}
