import { Inject, Injectable } from "@nestjs/common";
import type { Permission, Role } from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/**
 * The pairs someone revoked on the matrix (F-8, ADR 0053), so the seed leaves
 * them out. Written in the same transaction as the change and its audit event.
 */
@Injectable()
export class RevokedPermissionRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** Records a revocation. Recording one twice keeps the first. */
  async record(role: Role, permission: Permission): Promise<void> {
    await this.database.client.revokedRolePermission.createMany({
      data: [{ role, permission }],
      skipDuplicates: true,
    });
  }

  /** Forgets a revocation, once the pair is granted again. */
  async forget(role: Role, permission: Permission): Promise<void> {
    await this.database.client.revokedRolePermission.deleteMany({
      where: { role, permission },
    });
  }

  /** Every recorded revocation, as the seed reads them. */
  async all(): Promise<{ role: Role; permission: string }[]> {
    return this.database.client.revokedRolePermission.findMany({
      select: { role: true, permission: true },
      orderBy: [{ role: "asc" }, { permission: "asc" }],
    });
  }
}
