import { Inject, Injectable } from "@nestjs/common";
import type {
  AuditChainCheck,
  AuditEventQuery,
  AuditEventView,
  PageMeta,
  Role,
} from "@orderpilot/shared";
import {
  AuditEventRepository,
  type AuditRecord,
  type AuditSearch,
} from "../../audit/audit-event.repository.js";
import { AuditService } from "../../audit/audit.service.js";
import { NotFoundError } from "../../common/domain-error.js";
import { UserRepository } from "../../users/user.repository.js";
import { toEventView } from "./audit-view.js";
import { AUDIT_MASKING_RULES } from "./domain/audit-masking.js";

/**
 * The audit viewer. It only reads, through P-9's repository and service:
 * nothing here writes, edits or deletes an event. Every change is masked for
 * the caller's role before it leaves, so a value the caller may not see never
 * reaches the browser.
 */
@Injectable()
export class AuditViewerService {
  constructor(
    @Inject(AuditEventRepository)
    private readonly events: AuditEventRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  async list(
    query: AuditEventQuery,
    role: Role,
  ): Promise<{ items: AuditEventView[]; meta: PageMeta }> {
    const page = await this.events.search(toSearch(query), query);
    return { items: await this.toViews(page.items, role), meta: page.meta };
  }

  async get(id: string, role: Role): Promise<AuditEventView> {
    const record = await this.events.findRecordById(id);
    if (!record) throw new NotFoundError("Audit event");
    const [view] = await this.toViews([record], role);
    if (!view) throw new NotFoundError("Audit event");
    return view;
  }

  /**
   * Walks the whole chain. It reports the last sequence that fits, or the
   * first one that does not. Events written while it runs are not claimed:
   * "verified through" is the newest sequence that existed when it began.
   */
  async checkChain(): Promise<AuditChainCheck> {
    const newest = await this.events.lastSequence();
    const report = await this.audit.verify();
    const checkedAt = new Date().toISOString();
    if (report.ok || !report.brokenAt) {
      return {
        ok: true,
        checked: report.checked,
        verifiedThrough: newest ?? 0,
        brokenAtSequence: null,
        brokenAtEventId: null,
        problem: null,
        checkedAt,
      };
    }
    const brokenAt = await this.events.sequenceOf(report.brokenAt.id);
    const before =
      brokenAt === null ? null : await this.events.sequenceBefore(brokenAt);
    return {
      ok: false,
      checked: report.checked,
      verifiedThrough: before ?? 0,
      brokenAtSequence: brokenAt,
      brokenAtEventId: report.brokenAt.id,
      problem: report.brokenAt.problem,
      checkedAt,
    };
  }

  private async toViews(
    records: readonly AuditRecord[],
    role: Role,
  ): Promise<AuditEventView[]> {
    const ids = new Set<string>();
    for (const { event } of records) {
      if (event.actor.kind === "user") ids.add(event.actor.userId);
    }
    const names = await this.users.namesByIds([...ids]);
    return records.map((record) =>
      toEventView(record, role, AUDIT_MASKING_RULES, names),
    );
  }
}

function toSearch(query: AuditEventQuery): AuditSearch {
  return {
    ...(query.actorKind ? { actorKind: query.actorKind } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.from ? { from: new Date(query.from) } : {}),
    ...(query.to ? { to: new Date(query.to) } : {}),
    ...(query.refusalsOnly ? { refusalsOnly: true } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
}
