import type { INestApplicationContext } from "@nestjs/common";
import { DEFAULT_ROLE_PERMISSIONS } from "@orderpilot/shared";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { pairsToSeed } from "./domain/matrix-rules.js";
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
  const done =
    added === 0
      ? `the matrix holds all ${String(pairs.length)} default pairs`
      : `added ${String(added)} of ${String(pairs.length)} default pairs to the matrix`;
  if (left === 0) return done;
  return `${done}, and ${String(left)} revoked on purpose ${left === 1 ? "stays" : "stay"} out`;
}
