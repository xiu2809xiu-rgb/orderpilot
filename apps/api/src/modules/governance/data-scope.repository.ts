import { Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_DATA_SCOPES,
  ROLES,
  dataScopeSchema,
  type DataScope,
  type Role,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/** The only place RoleDataScope is read or written. A role with no row reads as its default. */
@Injectable()
export class DataScopeRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async all(): Promise<Record<Role, DataScope>> {
    const rows = await this.database.client.roleDataScope.findMany();
    const scopes = { ...DEFAULT_DATA_SCOPES };
    for (const row of rows) {
      const parsed = dataScopeSchema.safeParse(row.scope);
      if (parsed.success && ROLES.includes(row.role)) {
        scopes[row.role] = parsed.data;
      }
    }
    return scopes;
  }

  async get(role: Role): Promise<DataScope> {
    const row = await this.database.client.roleDataScope.findUnique({
      where: { role },
    });
    const parsed = dataScopeSchema.safeParse(row?.scope);
    return parsed.success ? parsed.data : DEFAULT_DATA_SCOPES[role];
  }

  async set(role: Role, scope: DataScope): Promise<void> {
    await this.database.client.roleDataScope.upsert({
      where: { role },
      create: { role, scope },
      update: { scope },
    });
  }
}
