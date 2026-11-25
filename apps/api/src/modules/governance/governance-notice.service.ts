import { Inject, Injectable } from "@nestjs/common";
import type { GovernanceNotice, PageQuery } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import { NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "./authorisation.service.js";
import { GovernanceNoticeRepository } from "./governance-notice.repository.js";

/**
 * What the management approvers are told about the administrator's own role
 * (#383, ADR 0067). The routes need approvals.decide, which the administrator
 * can never hold and the approver role always keeps, so the administrator can
 * neither read these nor take them away from the approvers.
 */
@Injectable()
export class GovernanceNoticeService {
  constructor(
    @Inject(GovernanceNoticeRepository)
    private readonly notices: GovernanceNoticeRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
  ) {}

  list(
    auth: AuthContext,
    query: PageQuery,
  ): Promise<{ items: GovernanceNotice[]; total: number; unread: number }> {
    return this.notices.page(auth.user.id, query);
  }

  /** Marks a notice read for the person asking, once, and records it. */
  markRead(
    id: string,
    auth: AuthContext,
    info: RequestInfo,
  ): Promise<GovernanceNotice> {
    return this.database.transaction(async () => {
      const notice = await this.notices.one(id, auth.user.id);
      if (!notice) throw new NotFoundError("Notice");
      if (await this.notices.markRead(id, auth.user.id)) {
        await this.audit.record({
          actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
          action: "governance.notice.read",
          entityType: "GovernanceNotice",
          entityId: id,
          summary: `${auth.user.displayName} read that the System admin role gained ${notice.permissions.join(", ")}`,
          changes: { permissions: notice.permissions },
          ip: info.ip,
          traceId: info.traceId,
        });
      }
      return { ...notice, read: true };
    });
  }
}
