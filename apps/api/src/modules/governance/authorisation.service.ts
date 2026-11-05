import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PolicyDecision, PolicyRequest } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { DomainError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { UserRepository } from "../../users/user.repository.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import { deciderFor, type Decider } from "./domain/approval-route.js";
import type { ApprovalSetup, Approver } from "./domain/approval-setup.js";
import { ACTION_POLICY } from "./domain/policies.js";
import { policyActionOf } from "./domain/policy-actions.js";

/** Where a request came from, for the audit trail. Area 2's ActionInfo has this shape. */
export interface RequestInfo {
  readonly ip: string | null;
  readonly traceId: string;
}

/**
 * Area 4's policy for an action, asked by the area that acts: who, what, on
 * which record, for how much and raised by whom (F-1's PolicyRequest). It
 * gathers the facts the rules need and leaves every decision to them.
 */
@Injectable()
export class AuthorisationService {
  private readonly logger = new Logger(AuthorisationService.name);

  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
    @Inject(ApprovalSetupRepository)
    private readonly setups: ApprovalSetupRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** The decision on one action, without acting on it. */
  async decide(
    request: PolicyRequest,
    now: Date = new Date(),
  ): Promise<PolicyDecision> {
    const action = policyActionOf(request.action);
    if (!action) {
      return {
        outcome: "refused",
        rule: "action",
        reason: "the policy knows no such action",
      };
    }
    const [roleHoldsPermission, approvers] = await Promise.all([
      this.matrix.has(request.actor.role, action.permission),
      this.approversAround(request.requesterUserId, request.actor.userId),
    ]);
    return ACTION_POLICY.decide({
      actor: request.actor,
      permission: action.permission,
      roleHoldsPermission,
      approval: {
        limit: action.limit,
        amount: request.amount,
        requesterUserId: request.requesterUserId,
        approvers,
        now,
      },
    });
  }

  /**
   * Refuses the action unless the policy allows it. The refusal is audited with
   * the rule and the reason, and thrown as the standard FORBIDDEN, whose
   * message says nothing about the rules.
   */
  async enforce(
    request: PolicyRequest,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<void> {
    // The audit writer joins an open transaction, and the refusal would then
    // roll back with the action, taking its audit event with it.
    if (this.database.inTransaction) {
      throw new Error(
        "Call AuthorisationService.enforce before opening the transaction, so a refusal's audit event is not rolled back with it.",
      );
    }
    const decision = await this.decide(request, now);
    if (decision.outcome === "allowed") return;
    await this.auditRefusal(request, decision, info);
    throw new DomainError("FORBIDDEN", "You do not have access to this.");
  }

  /** Who should receive a request raised by `requesterUserId`, for area 2 to route it. */
  async deciderFor(
    requesterUserId: string,
    now: Date = new Date(),
  ): Promise<Decider> {
    return deciderFor(
      requesterUserId,
      await this.approversAround(requesterUserId),
      now,
    );
  }

  /**
   * The setups the rules may read: the actor's and the requester's, then the
   * requester's approver, then that approver's substitute and the person they
   * escalate to. Three small reads by key, never the whole table.
   */
  private async approversAround(
    requesterUserId: string | undefined,
    actorUserId?: string,
  ): Promise<ReadonlyMap<string, Approver>> {
    const found = new Map<string, ApprovalSetup>();
    const load = async (ids: readonly (string | null | undefined)[]) => {
      const wanted = ids.filter(
        (id): id is string => typeof id === "string" && !found.has(id),
      );
      for (const setup of await this.setups.findMany(wanted)) {
        found.set(setup.userId, setup);
      }
    };
    await load([actorUserId, requesterUserId]);
    const approverId = requesterUserId
      ? found.get(requesterUserId)?.approverId
      : undefined;
    await load([approverId]);
    const approver = approverId ? found.get(approverId) : undefined;
    await load([approver?.substituteUserId, approver?.approverId]);

    const users = await Promise.all(
      [...found.keys()].map((id) => this.users.findById(id)),
    );
    const disabled = new Set(
      users.flatMap((user) => (user?.disabledAt ? [user.id] : [])),
    );
    return new Map(
      [...found].map(([id, setup]) => [
        id,
        { setup, disabled: disabled.has(id) },
      ]),
    );
  }

  /**
   * A refusal changes nothing, so it is audited on its own. If that write
   * fails, the caller is refused all the same and the failure is logged, as
   * for the guard's refusals (ADR 0012).
   */
  private async auditRefusal(
    request: PolicyRequest,
    decision: PolicyDecision,
    info: RequestInfo,
  ): Promise<void> {
    const { actor, resource } = request;
    try {
      const names = await this.users.namesByIds([actor.userId]);
      const name = names.get(actor.userId) ?? actor.userId;
      await this.audit.record({
        actor: { kind: "user", userId: actor.userId, role: actor.role },
        action: "governance.policy.refused",
        entityType: resource.type,
        entityId: resource.id,
        // The amount stays in changes, out of the sentence: masking may hide it.
        summary: `${name} was refused ${request.action} on ${resource.id} (${decision.rule})`,
        changes: {
          action: request.action,
          rule: decision.rule,
          reason: decision.reason,
          amount: request.amount ?? null,
          requesterUserId: request.requesterUserId ?? null,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
    } catch (error) {
      this.logger.error(
        { traceId: info.traceId, err: error },
        "Could not audit a policy refusal",
      );
    }
  }
}
