import { Inject, Injectable } from "@nestjs/common";
import type { UserListQuery } from "@orderpilot/shared";
import { AuditService } from "../audit/audit.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import type { Page } from "../common/repository.js";
import { Database } from "../database/database.js";
import { RefreshTokenRepository } from "../sessions/refresh-token.repository.js";
import { TwoStepRepository } from "../two-step/two-step.repository.js";
import {
  assertNotSelf,
  assertNotSelfForReset,
  isSelf,
} from "./domain/user-rules.js";
import { UserRepository, type UserRecord } from "./user.repository.js";
import type { TwoStepReset, UserView } from "./users.schemas.js";

export interface RequestInfo {
  readonly ip: string | null;
  readonly traceId: string;
}

export function toView(user: UserRecord): UserView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    disabled: user.disabledAt !== null,
    disabledAt: user.disabledAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(RefreshTokenRepository)
    private readonly tokens: RefreshTokenRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
    @Inject(TwoStepRepository) private readonly twoStep: TwoStepRepository,
  ) {}

  async list(query: UserListQuery): Promise<Page<UserView>> {
    const page = await this.users.list(query);
    return { items: page.items.map(toView), meta: page.meta };
  }

  async get(id: string): Promise<UserView> {
    return toView(await this.users.getById(id));
  }

  /**
   * Disables a user and ends every session of theirs, in one transaction with
   * its audit event. Their access token stops at its next request, because the
   * auth guard reads the user each time. Disabling twice changes nothing.
   */
  async disable(
    id: string,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<UserView> {
    // Every refusal is recorded (#276). Outside the transaction, so the record
    // stays although the refusal rolls the change back.
    if (isSelf(actor.user.id, id)) await this.recordSelfDisable(actor, info);
    return this.database.transaction(async () => {
      assertNotSelf(actor.user.id, id);
      const user = await this.users.getById(id);
      if (user.disabledAt !== null) return toView(user);
      const now = new Date();
      const updated = await this.users.setDisabledAt(id, now);
      const revoked = await this.tokens.revokeAllForUser(
        id,
        "user-disabled",
        now,
      );
      await this.audit.record({
        actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
        action: "user.disabled",
        entityType: "User",
        entityId: id,
        summary: `${actor.user.displayName} disabled ${user.displayName}`,
        changes: {
          disabled: { from: false, to: true },
          sessionsRevoked: revoked,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      return toView(updated);
    });
  }

  private async recordSelfDisable(
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<void> {
    await this.audit.record({
      actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
      action: "user.disable.refused",
      entityType: "User",
      entityId: actor.user.id,
      summary: `${actor.user.displayName} was refused disabling their own account`,
      changes: { rule: "no-self-disable" },
      ip: info.ip,
      traceId: info.traceId,
    });
  }

  /**
   * Takes another person's two-step verification away, for someone who lost the
   * phone and the recovery codes, and ends every session of theirs (demo ones
   * too) so nothing opened before the reset stays open. A person with no
   * two-step has nothing to reset: that is a 200 with no audit row and no
   * session change. A setup nobody confirmed is removed and audited, but ends no
   * session. Never one's own.
   *
   * This is user administration, like disabling: it gives the administrator no
   * permission to approve, pay or post. It does let an administrator who knows
   * a person's password sign in as them with no second step, so every reset is
   * audited and shows in the person's own history (ADR 0068).
   */
  async resetTwoStep(
    id: string,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<TwoStepReset> {
    // The refusal is recorded outside the transaction, so it stays although the
    // refusal rolls the change back (as for a self-disable).
    if (isSelf(actor.user.id, id)) await this.recordSelfReset(actor, info);
    return this.database.transaction(async () => {
      assertNotSelfForReset(actor.user.id, id);
      // An unknown person is a 404, not a no-op.
      await this.users.getById(id);
      const row = await this.twoStep.lockForUse(id);
      if (row === null) return { wasOn: false, sessionsEnded: 0 };
      if (row.status !== "ACTIVE") {
        // A pending setup guards nothing, so the sessions stay. It is still
        // one person changing another's account, so it is audited.
        await this.twoStep.deleteForUser(id);
        await this.audit.record({
          actor: {
            kind: "user",
            userId: actor.user.id,
            role: actor.user.role,
          },
          action: "user.two-step-reset",
          entityType: "User",
          entityId: id,
          summary: "A pending two-step setup was removed by an administrator",
          changes: { wasOn: false, pendingRemoved: true },
          ip: info.ip,
          traceId: info.traceId,
        });
        return { wasOn: false, sessionsEnded: 0 };
      }
      // The row's challenges, recovery codes and lock go with it.
      await this.twoStep.deleteForUser(id);
      const sessionsEnded = await this.tokens.revokeAllForUser(
        id,
        "two-step-reset",
        new Date(),
      );
      await this.audit.record({
        actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
        action: "user.two-step-reset",
        entityType: "User",
        entityId: id,
        summary: "Two-step verification was reset by an administrator",
        changes: { sessionsEnded },
        ip: info.ip,
        traceId: info.traceId,
      });
      return { wasOn: true, sessionsEnded };
    });
  }

  private async recordSelfReset(
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<void> {
    await this.audit.record({
      actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
      action: "user.two-step-reset.refused",
      entityType: "User",
      entityId: actor.user.id,
      summary: "A two-step reset was refused",
      changes: { reason: "self" },
      ip: info.ip,
      traceId: info.traceId,
    });
  }

  enable(id: string, actor: AuthContext, info: RequestInfo): Promise<UserView> {
    return this.database.transaction(async () => {
      const user = await this.users.getById(id);
      if (user.disabledAt === null) return toView(user);
      const updated = await this.users.setDisabledAt(id, null);
      await this.audit.record({
        actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
        action: "user.enabled",
        entityType: "User",
        entityId: id,
        summary: `${actor.user.displayName} enabled ${user.displayName}`,
        changes: { disabled: { from: true, to: false } },
        ip: info.ip,
        traceId: info.traceId,
      });
      return toView(updated);
    });
  }
}
