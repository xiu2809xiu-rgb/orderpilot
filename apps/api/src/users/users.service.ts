import { Inject, Injectable } from "@nestjs/common";
import type { PageQuery } from "@orderpilot/shared";
import { AuditService } from "../audit/audit.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import type { Page } from "../common/repository.js";
import { Database } from "../database/database.js";
import { RefreshTokenRepository } from "../sessions/refresh-token.repository.js";
import { assertNotSelf } from "./domain/user-rules.js";
import { UserRepository, type UserRecord } from "./user.repository.js";
import type { UserView } from "./users.schemas.js";

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
  ) {}

  async list(query: PageQuery): Promise<Page<UserView>> {
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
  disable(
    id: string,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<UserView> {
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
