import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PolicyDecision, PolicyRequest } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { AppConfig } from "../../config/app-config.js";
import { DomainError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { UserRepository } from "../../users/user.repository.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import {
  BANK_HOLD_ENTITY,
  BankHoldRepository,
} from "./bank-hold.repository.js";
import { deciderFor, type Decider } from "./domain/approval-route.js";
import type { ApprovalSetup, Approver } from "./domain/approval-setup.js";
import {
  approverGroup,
  type ApproverGroup,
  type GroupCandidate,
} from "./domain/approver-group.js";
import {
  isHoldStep,
  isVendorPayment,
  type HoldClearanceFacts,
  type HoldResolution,
  type VendorHoldFacts,
  type VerificationAttempt,
} from "./domain/bank-hold-rules.js";
import { ACTION_POLICY } from "./domain/policies.js";
import { policyActionOf, type LimitKind } from "./domain/policy-actions.js";
import type { EarlierDuties } from "./domain/segregation-of-duties.js";

/**
 * F-1's PolicyRequest, plus who did the earlier duties on this record, for
 * segregation of duties (F-4). The caller takes `requesterUserId` and every
 * person in `earlierDuties` from its own stored records (the SPR's raisedBy,
 * the payment's approvedBy), never from the request body. Copied from a body,
 * they would let a caller name someone else and pass every rule they guard.
 */
export interface GovernanceRequest extends PolicyRequest {
  readonly earlierDuties?: EarlierDuties | undefined;
  /**
   * The vendor a payment goes to, by Business Central number, from your stored
   * payment record, never a request body (F-5). A vendor payment without it is
   * refused.
   */
  readonly vendorNo?: string | undefined;
  /** What Finance reports, for `payment-hold.verify`. */
  readonly verification?: VerificationAttempt | undefined;
  /** How `payment-hold.clear` closes the hold. */
  readonly resolution?: HoldResolution | undefined;
}

/** A decision, with the facts its audit row records. */
interface Evaluation {
  readonly decision: PolicyDecision;
  readonly holdIds: readonly string[];
  readonly earlierDuties: EarlierDuties;
}

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
/** The group handed to the rules while the old chain decides: never read. */
const NOBODY_YET: ApproverGroup = { approvers: [], reason: null };

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
    @Inject(BankHoldRepository) private readonly holds: BankHoldRepository,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  /** The decision on one action, without acting on it. */
  async decide(
    request: GovernanceRequest,
    now: Date = new Date(),
  ): Promise<PolicyDecision> {
    return (await this.evaluate(request, now)).decision;
  }

  private async evaluate(
    request: GovernanceRequest,
    now: Date,
  ): Promise<Evaluation> {
    const action = policyActionOf(request.action);
    if (!action) {
      return {
        decision: {
          outcome: "refused",
          rule: "action",
          reason: "the policy knows no such action",
        },
        holdIds: [],
        earlierDuties: request.earlierDuties ?? {},
      };
    }
    const { limit } = action;
    const groupDecides = this.config.governance.approverGroup;
    const [roleHoldsPermission, approvers, group, payment, holdStep] =
      await Promise.all([
        this.matrix.has(request.actor.role, action.permission),
        limit
          ? this.approversAround(request.requesterUserId, request.actor.userId)
          : undefined,
        // Who may decide, with no limit applied: a refusal for the amount is
        // the limit rule's, so it names its own rule. Read only while the
        // group decides; the old chain needs none of it.
        limit && groupDecides
          ? this.groupFor({
              requesterUserId: request.requesterUserId,
              limit,
              amount: request.amount,
              limitsOn: false,
            })
          : NOBODY_YET,
        isVendorPayment(request.action)
          ? this.vendorPaymentFacts(request.vendorNo)
          : undefined,
        isHoldStep(request.action)
          ? this.holdStepFacts(request, now)
          : undefined,
      ]);
    // Area 4's own record of who did what wins over anything a caller says.
    const earlierDuties: EarlierDuties = {
      ...request.earlierDuties,
      ...payment?.duties,
      ...holdStep?.duties,
    };
    const decision = ACTION_POLICY.decide({
      actor: request.actor,
      action: request.action,
      permission: action.permission,
      roleHoldsPermission,
      resource: request.resource,
      requesterUserId: request.requesterUserId,
      earlierDuties,
      ...(limit && approvers
        ? {
            approval: {
              limit,
              amount: request.amount,
              approvers,
              now,
              group,
              groupDecides,
              limitsOn: this.limitsApply(),
            },
          }
        : {}),
      ...(payment ? { vendorHold: payment.facts } : {}),
      ...(holdStep ? { holdClearance: holdStep.facts } : {}),
    });
    return {
      decision,
      holdIds: payment?.facts.openHoldIds ?? holdStep?.holdIds ?? [],
      earlierDuties,
    };
  }

  private async vendorPaymentFacts(
    vendorNo: string | undefined,
  ): Promise<{ facts: VendorHoldFacts; duties: EarlierDuties }> {
    if (!vendorNo) {
      return { facts: { vendorNo, openHoldIds: [] }, duties: {} };
    }
    const [openHoldIds, changer] = await Promise.all([
      this.holds.openHoldIdsFor(vendorNo),
      this.holds.latestChangerOf(vendorNo),
    ]);
    return {
      facts: { vendorNo, openHoldIds },
      duties: changer ? { "vendor-bank.change": changer } : {},
    };
  }

  private async holdStepFacts(
    request: GovernanceRequest,
    now: Date,
  ): Promise<{
    facts: HoldClearanceFacts;
    duties: EarlierDuties;
    holdIds: readonly string[];
  }> {
    const hold =
      request.resource.type === BANK_HOLD_ENTITY
        ? await this.holds.findById(request.resource.id)
        : null;
    const latest = hold?.verifications.at(-1) ?? null;
    return {
      facts: {
        hold: hold
          ? {
              status: hold.status,
              openedAt: hold.openedAt,
              latestOutcome: latest?.outcome ?? null,
            }
          : null,
        attempt: request.verification,
        resolution: request.resolution,
        now,
      },
      duties: {
        ...(hold?.changedByUserId
          ? { "vendor-bank.change": hold.changedByUserId }
          : {}),
        ...(latest ? { "payment-hold.verify": latest.verifiedByUserId } : {}),
      },
      holdIds: hold ? [hold.id] : [],
    };
  }

  /**
   * Refuses the action unless the policy allows it. The refusal is audited with
   * the rule and the reason, and thrown as the standard FORBIDDEN, whose
   * message says nothing about the rules.
   */
  async enforce(
    request: GovernanceRequest,
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
    const evaluation = await this.evaluate(request, now);
    if (evaluation.decision.outcome === "allowed") return;
    await this.auditRefusal(request, evaluation, info);
    throw new DomainError("FORBIDDEN", "You do not have access to this.");
  }

  /**
   * Audits a refusal the rules never saw, because the request could not be put
   * to them. The row is the same as a rule's, and the caller does the refusing.
   */
  async recordRefusal(
    request: GovernanceRequest,
    refusal: { readonly rule: string; readonly reason: string },
    info: RequestInfo,
    holdIds: readonly string[] = [],
  ): Promise<void> {
    await this.auditRefusal(
      request,
      {
        decision: { outcome: "refused", ...refusal },
        holdIds,
        earlierDuties: request.earlierDuties ?? {},
      },
      info,
    );
  }

  /**
   * The approvers who may decide a request (#252): every enabled management
   * approver except the requester and, while limits are on, only those whose
   * own limit covers the amount. Each is an id and a name, never an email.
   * `reason` is set only when nobody may decide. Area 2 routes an SPR to all
   * of them, and the first decision closes it.
   */
  async approversFor(question: {
    readonly requester: string;
    readonly action: string;
    readonly amount: string | undefined;
  }): Promise<ApproverGroup> {
    const limit = policyActionOf(question.action)?.limit;
    if (!limit) {
      return { approvers: [], reason: `${question.action} is not an approval` };
    }
    return this.groupFor({
      requesterUserId: question.requester,
      limit,
      amount: question.amount,
      limitsOn: this.limitsApply(),
    });
  }

  /**
   * Whether approval limits apply: always under the old chain, as before
   * #252, and under the group only while APPROVAL_LIMITS is on.
   */
  private limitsApply(): boolean {
    const { approverGroup, approvalLimits } = this.config.governance;
    return approverGroup ? approvalLimits : true;
  }

  /**
   * Who should receive a request raised by `requesterUserId`, along the old
   * approval chain.
   *
   * Deprecated since #252: route with `approversFor`. While APPROVER_GROUP is
   * off this chain still decides who may approve, unchanged; area 2 turns the
   * group on when it moves (#251), and the follow-up removes this.
   */
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
   * The approver group for one request. Every user with the APPROVER role is
   * read, a page at a time: the group is small (three at Spectra). Setups are
   * read only while limits apply, and only the id, name and enabled state of
   * each user go on: never an email or a password hash.
   */
  private async groupFor(question: {
    readonly requesterUserId: string | undefined;
    readonly limit: LimitKind | undefined;
    readonly amount: string | undefined;
    readonly limitsOn: boolean;
  }): Promise<ApproverGroup> {
    const people: { id: string; displayName: string; disabled: boolean }[] = [];
    for (let page = 1; ; page += 1) {
      const found = await this.users.list({
        role: "APPROVER",
        page,
        pageSize: 200,
      });
      for (const user of found.items) {
        people.push({
          id: user.id,
          displayName: user.displayName,
          disabled: user.disabledAt !== null,
        });
      }
      if (people.length >= found.meta.total || found.items.length === 0) break;
    }
    const setups = question.limitsOn
      ? new Map(
          (await this.setups.findMany(people.map((each) => each.id))).map(
            (setup) => [setup.userId, setup],
          ),
        )
      : new Map<string, ApprovalSetup>();
    const candidates: GroupCandidate[] = people.map((each) => ({
      userId: each.id,
      displayName: each.displayName,
      disabled: each.disabled,
      setup: setups.get(each.id) ?? null,
    }));
    return approverGroup(candidates, question);
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
    request: GovernanceRequest,
    { decision, holdIds, earlierDuties }: Evaluation,
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
          earlierDuties:
            Object.keys(earlierDuties).length > 0 ? earlierDuties : null,
          ...(request.vendorNo ? { vendorNo: request.vendorNo } : {}),
          ...(holdIds.length > 0 ? { holdIds: [...holdIds] } : {}),
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
