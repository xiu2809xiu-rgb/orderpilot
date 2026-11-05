import { Inject, Injectable } from "@nestjs/common";
import type { AuditActor } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { Database } from "../../database/database.js";
import { UserRepository } from "../../users/user.repository.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import {
  assertValidSetup,
  changesBetween,
  type ApprovalSetup,
} from "./domain/approval-setup.js";

/** Who made a change and where from, for the audit trail. */
export interface ChangeInfo {
  readonly actor: AuditActor;
  readonly ip: string | null;
  readonly traceId: string;
}

/**
 * Writes approval setups. Each change is audited with the before and after of
 * the fields that changed, in the same transaction as the write, so a change is
 * never saved without its event. Saving what is already there writes nothing.
 */
@Injectable()
export class ApprovalSetupService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(ApprovalSetupRepository)
    private readonly setups: ApprovalSetupRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Saves one row. Resolves to false when nothing changed. */
  async save(setup: ApprovalSetup, by: ChangeInfo): Promise<boolean> {
    assertValidSetup(setup);
    return this.database.transaction(async () => {
      const before = await this.setups.find(setup.userId);
      const changes = changesBetween(before, setup);
      if (!changes) return false;
      await this.setups.save(setup);
      const names = await this.users.namesByIds([setup.userId]);
      const name = names.get(setup.userId) ?? setup.userId;
      await this.audit.record({
        actor: by.actor,
        action: "governance.approval-setup.changed",
        entityType: "ApprovalUserSetup",
        entityId: setup.userId,
        // The limits stay in changes, out of the sentence: masking may hide them.
        summary: before
          ? `Changed the approval setup of ${name}`
          : `Set up approval for ${name}`,
        changes: { before: changes.before, after: changes.after },
        ip: by.ip,
        traceId: by.traceId,
      });
      return true;
    });
  }
}
