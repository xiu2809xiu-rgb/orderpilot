import { Inject, Injectable } from "@nestjs/common";
import type { PageQuery, Role } from "@orderpilot/shared";
import { BaseRepository, type Page } from "../common/repository.js";
import { Database } from "../database/database.js";
import type { User as UserRow } from "../generated/prisma/client.js";

/** A user as the services see it. The password hash stays inside the auth layer. */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly disabledAt: Date | null;
  readonly createdAt: Date;
  readonly passwordHash: string | null;
}

export interface NewUser {
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly passwordHash: string | null;
}

/** The only place the User table is read or written. Users are never deleted. */
@Injectable()
export class UserRepository extends BaseRepository<UserRecord, string> {
  protected readonly entityName = "User";

  constructor(@Inject(Database) private readonly database: Database) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.database.client.user.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.database.client.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return row ? toRecord(row) : null;
  }

  async list(query: PageQuery): Promise<Page<UserRecord>> {
    const [rows, total] = await Promise.all([
      this.database.client.user.findMany({
        orderBy: [{ role: "asc" }, { email: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.user.count(),
    ]);
    return this.toPage(rows.map(toRecord), total, query);
  }

  /** Display names by id, for screens that show who did something. Unknown ids are left out. */
  async namesByIds(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.database.client.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, displayName: true },
    });
    return new Map(rows.map((row) => [row.id, row.displayName]));
  }

  async create(user: NewUser): Promise<UserRecord> {
    const row = await this.database.client.user.create({
      data: { ...user, email: user.email.toLowerCase() },
    });
    return toRecord(row);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.client.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async setDisabledAt(
    id: string,
    disabledAt: Date | null,
  ): Promise<UserRecord> {
    const row = await this.database.client.user.update({
      where: { id },
      data: { disabledAt },
    });
    return toRecord(row);
  }
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    passwordHash: row.passwordHash,
  };
}
