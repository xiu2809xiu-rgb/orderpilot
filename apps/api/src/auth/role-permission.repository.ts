import { Inject, Injectable } from "@nestjs/common";
import {
  permissionSchema,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { Database } from "../database/database.js";

/** The only place the RolePermission table is read or written. Area 4 owns its contents. */
@Injectable()
export class RolePermissionRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** The permissions a role holds. A name the code does not know is ignored. */
  async permissionsOf(role: Role): Promise<Permission[]> {
    const rows = await this.database.client.rolePermission.findMany({
      where: { role },
      select: { permission: true },
      orderBy: { permission: "asc" },
    });
    return rows.flatMap((row) => {
      const parsed = permissionSchema.safeParse(row.permission);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async has(role: Role, permission: Permission): Promise<boolean> {
    const count = await this.database.client.rolePermission.count({
      where: { role, permission },
    });
    return count > 0;
  }

  /** Adds the pairs that are missing and leaves the rest. Returns how many it added. */
  async addMissing(
    pairs: readonly { role: Role; permission: Permission }[],
  ): Promise<number> {
    const result = await this.database.client.rolePermission.createMany({
      data: pairs.map((pair) => ({ ...pair })),
      skipDuplicates: true,
    });
    return result.count;
  }
}
