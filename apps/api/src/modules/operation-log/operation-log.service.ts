import { Inject, Injectable } from "@nestjs/common";
import type {
  OperationLogEntry,
  OperationLogParams,
  OperationLogQuery,
  PageMeta,
} from "@orderpilot/shared";
import { AuditEventRepository } from "../../audit/audit-event.repository.js";
import { UserRepository } from "../../users/user.repository.js";
import {
  actorUserIds,
  toOperationLogEntry,
} from "./domain/operation-log-entry.js";

/**
 * A record's operation log: what was done to the record, newest first. It
 * reads P-9's audit trail through its repository and writes nothing. The
 * permissions guard has already checked that the caller may read the record
 * (ADR 0041), so this only reads and trims each event to who, when and what.
 */
@Injectable()
export class OperationLogService {
  constructor(
    @Inject(AuditEventRepository)
    private readonly events: AuditEventRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  async list(
    record: OperationLogParams,
    query: OperationLogQuery,
  ): Promise<{ items: OperationLogEntry[]; meta: PageMeta }> {
    // A refused attempt changed nothing on the record, and saying who tried
    // what is the audit trail's business, for the roles that may read it.
    const page = await this.events.search(
      {
        entityType: record.entityType,
        entityId: record.entityId,
        withoutRefusals: true,
      },
      query,
    );
    const events = page.items.map((item) => item.event);
    const names = await this.users.namesByIds(actorUserIds(events));
    return {
      items: events.map((event) => toOperationLogEntry(event, names)),
      meta: page.meta,
    };
  }
}
