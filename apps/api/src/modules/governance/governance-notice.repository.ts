import { Inject, Injectable } from "@nestjs/common";
import {
  governanceNoticeSchema,
  type GovernanceNotice,
  type PageQuery,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";

const ADMIN_ROLE_WIDENED = "admin-role-widened";

/**
 * The notices to the management approvers that the administrator's role
 * gained permissions (#383), and who has read each. A notice is written in
 * the same transaction as the grant and its audit event.
 */
@Injectable()
export class GovernanceNoticeRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async create(notice: {
    actorUserId: string;
    actorName: string;
    permissions: readonly Permission[];
    fromRole: Role | null;
  }): Promise<{ id: string }> {
    return this.database.client.governanceNotice.create({
      data: {
        kind: ADMIN_ROLE_WIDENED,
        actorUserId: notice.actorUserId,
        actorName: notice.actorName,
        permissions: [...notice.permissions],
        fromRole: notice.fromRole,
      },
      select: { id: true },
    });
  }

  /** A page of notices, newest first, each saying whether this person has read it. */
  async page(
    userId: string,
    query: PageQuery,
  ): Promise<{ items: GovernanceNotice[]; total: number; unread: number }> {
    const notices = this.database.client.governanceNotice;
    const [rows, total, unread] = await Promise.all([
      notices.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { reads: { where: { userId }, select: { userId: true } } },
      }),
      notices.count(),
      notices.count({ where: { reads: { none: { userId } } } }),
    ]);
    return { items: rows.map(toView), total, unread };
  }

  async one(id: string, userId: string): Promise<GovernanceNotice | null> {
    const row = await this.database.client.governanceNotice.findUnique({
      where: { id },
      include: { reads: { where: { userId }, select: { userId: true } } },
    });
    return row ? toView(row) : null;
  }

  /** Marks a notice read for one person. False when they had read it already. */
  async markRead(id: string, userId: string): Promise<boolean> {
    const { count } =
      await this.database.client.governanceNoticeRead.createMany({
        data: [{ noticeId: id, userId }],
        skipDuplicates: true,
      });
    return count === 1;
  }
}

function toView(row: {
  id: string;
  kind: string;
  actorName: string;
  permissions: string[];
  fromRole: Role | null;
  createdAt: Date;
  reads: { userId: string }[];
}): GovernanceNotice {
  // The row is ours, but its permissions are plain text in the table.
  return governanceNoticeSchema.parse({
    id: row.id,
    kind: row.kind,
    actorName: row.actorName,
    permissions: row.permissions,
    fromRole: row.fromRole,
    createdAt: row.createdAt.toISOString(),
    read: row.reads.length > 0,
  });
}
