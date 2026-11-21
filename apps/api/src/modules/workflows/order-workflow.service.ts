import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  AuditActor,
  NavisionStatus,
  OrderStatus,
  Role,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import {
  AuthorisationService,
  type RequestInfo,
} from "../governance/authorisation.service.js";
import {
  navisionStatusOf,
  ORDER_FLOW_RULES,
  OrderStateMachine,
  waitingOnOf,
  type OrderFlowRules,
  type OrderActor,
  type OrderCommand,
  type OrderSnapshot,
  type OrderTransitionResult,
} from "./domain/order-state-machine.js";
import {
  OrderWorkflowRepository,
  type StoredOrder,
} from "./order-workflow.repository.js";

type SprDecision = Extract<
  OrderCommand,
  { type: "SPR_APPROVED" | "SPR_REJECTED" | "SPR_DECISION_UNDONE" }
>;

/**
 * What area 4's policy needs to judge an SPR decision. The caller must take the
 * amount and the requester from the SPR's own record, never from the request.
 */
export interface SprDecisionFacts {
  readonly recordNo: string;
  readonly amount: string;
  readonly requesterUserId: string;
}

/** An order's status as other areas read it. They never set it or work it out. */
export interface OrderStatusView {
  readonly orderRef: string;
  readonly status: OrderStatus;
  readonly navisionStatus: NavisionStatus | null;
  readonly holds: readonly string[];
  readonly resumeTo: OrderStatus | null;
  /** The step it waits on, and whose move takes it on; null once it has finished. */
  readonly currentStep: string | null;
  readonly ownerRole: Role | null;
  /** When the order entered this status. */
  readonly since: Date;
  /** False once nothing is left to do on the order. */
  readonly open: boolean;
}

function auditActorOf(actor: OrderActor): AuditActor {
  return actor.kind === "user"
    ? { kind: "user", userId: actor.userId, role: actor.role }
    : { kind: "system", name: actor.name };
}

/**
 * Runs the order state machine against the database: it reads the order, lets
 * the machine decide, asks area 4's policy where the policy has a say, then
 * saves the status, its event and its audit event in one transaction. A refusal
 * leaves the order as it was, and is audited.
 */
@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);
  private readonly machine: OrderStateMachine;

  constructor(
    @Inject(OrderWorkflowRepository)
    private readonly repository: OrderWorkflowRepository,
    @Inject(Database) private readonly database: Database,
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ORDER_FLOW_RULES) private readonly rules: OrderFlowRules,
  ) {
    this.machine = new OrderStateMachine(rules);
  }

  async start(
    orderRef: string,
    facts: { readonly prepaymentDue: string | null },
    actor: OrderActor,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<OrderTransitionResult> {
    const result = await this.startDecision(orderRef, facts, actor, info, now);
    await this.startTransaction(orderRef, result, actor, info);
    return result;
  }

  private async startDecision(
    orderRef: string,
    facts: { readonly prepaymentDue: string | null },
    actor: OrderActor,
    info: RequestInfo,
    now: Date,
  ): Promise<OrderTransitionResult> {
    try {
      return this.machine.start(actor, now, facts);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      throw await this.refused(
        error,
        orderRef,
        "ORDER_STARTED",
        null,
        actor,
        info,
      );
    }
  }

  private async startTransaction(
    orderRef: string,
    result: OrderTransitionResult,
    actor: OrderActor,
    info: RequestInfo,
  ): Promise<void> {
    try {
      await this.database.transaction(async () => {
        await this.repository.insert(orderRef, result);
        await this.audit.record({
          actor: auditActorOf(actor),
          action: "workflow.started",
          entityType: "Order",
          entityId: orderRef,
          summary: `${actor.name} started the workflow of ${orderRef}`,
          changes: { to: result.event.to, data: result.event.data },
          ip: info.ip,
          traceId: info.traceId,
        });
      });
    } catch (error) {
      // Outside the transaction, so the refusal's audit event survives its rollback.
      if (!(error instanceof ConflictError)) throw error;
      throw await this.refused(
        error,
        orderRef,
        "ORDER_STARTED",
        null,
        actor,
        info,
      );
    }
  }

  /**
   * One move of the sales flow. An SPR decision is left out of this signature
   * and goes through `decideSpr`, so it cannot reach the machine unasked.
   */
  async apply(
    orderRef: string,
    command: Exclude<OrderCommand, SprDecision>,
    actor: OrderActor,
    info: RequestInfo,
    now: Date = new Date(),
    /** Writes that must commit or roll back with the move, such as a raised SPR's record and tasks. */
    alongside?: () => Promise<void>,
  ): Promise<OrderTransitionResult> {
    // The signature leaves these out; this keeps a cast from getting past the policy.
    const type: string = command.type;
    if (
      type === "SPR_APPROVED" ||
      type === "SPR_REJECTED" ||
      type === "SPR_DECISION_UNDONE"
    ) {
      throw new Error(`${type} must go through decideSpr.`);
    }
    return this.transition(
      orderRef,
      command,
      actor,
      info,
      now,
      undefined,
      alongside,
    );
  }

  /**
   * Approves or rejects an SPR, once area 4's policy has allowed it: the
   * requester's approver, within their limit, and never the requester.
   */
  decideSpr(
    orderRef: string,
    decision: SprDecision,
    spr: SprDecisionFacts,
    actor: OrderActor,
    info: RequestInfo,
    now: Date = new Date(),
    /** Writes that must commit or roll back with the move, such as the SPR's own record. */
    alongside?: () => Promise<void>,
  ): Promise<OrderTransitionResult> {
    const askPolicy = async () => {
      // The machine lets only people through to here; this satisfies the type.
      if (actor.kind !== "user") return;
      await this.policy.enforce(
        {
          actor: { userId: actor.userId, role: actor.role },
          action: "spr.approve",
          resource: { type: "Spr", id: spr.recordNo },
          amount: spr.amount,
          requesterUserId: spr.requesterUserId,
        },
        info,
        now,
      );
    };
    return this.transition(
      orderRef,
      decision,
      actor,
      info,
      now,
      askPolicy,
      alongside,
    );
  }

  /** Null for an order with no workflow, and for a sample the machine never ran. */
  async statusOf(orderRef: string): Promise<OrderStatusView | null> {
    const stored = await this.repository.find(orderRef);
    return stored ? this.viewOf(orderRef, stored) : null;
  }

  /** The prepayment the order's gate waits for; null with none due, or for an order the machine does not run. */
  async prepaymentDueOf(orderRef: string): Promise<string | null> {
    const stored = await this.repository.find(orderRef);
    return stored?.state?.prepaymentDue ?? null;
  }

  /** The orders the machine runs, by number. Others are simply absent. */
  async statusOfMany(
    orderRefs: readonly string[],
  ): Promise<ReadonlyMap<string, OrderStatusView>> {
    const views = new Map<string, OrderStatusView>();
    for (const { orderRef, stored } of await this.repository.findMany(
      orderRefs,
    )) {
      const view = this.viewOf(orderRef, stored);
      if (view) views.set(orderRef, view);
    }
    return views;
  }

  private viewOf(
    orderRef: string,
    stored: StoredOrder,
  ): OrderStatusView | null {
    const { state } = stored;
    if (!state) return null;
    const waitingOn = waitingOnOf(state, this.rules);
    return {
      orderRef,
      status: state.status,
      navisionStatus: navisionStatusOf(state),
      holds: state.holds,
      resumeTo: state.resumeTo,
      currentStep: waitingOn?.step ?? null,
      ownerRole: waitingOn?.role ?? null,
      since: new Date(state.enteredAt),
      open: state.status !== "Closed" && state.status !== "Cancelled",
    };
  }

  private async transition(
    orderRef: string,
    command: OrderCommand,
    actor: OrderActor,
    info: RequestInfo,
    now: Date,
    askPolicy?: () => Promise<void>,
    alongside?: () => Promise<void>,
  ): Promise<OrderTransitionResult> {
    const stored = await this.repository.find(orderRef);
    if (!stored) throw new NotFoundError(`Order ${orderRef}'s workflow`);
    const { state } = stored;
    if (!state) {
      throw await this.refused(
        new ConflictError(
          "This is a sample order, which the state machine does not run.",
        ),
        orderRef,
        command.type,
        null,
        actor,
        info,
      );
    }

    const result = await this.decided(
      state,
      orderRef,
      command,
      actor,
      info,
      now,
    );

    // Outside the transaction, because a refusal's audit event must survive it.
    // Area 4's enforce audits its own refusals.
    await askPolicy?.();

    const saved = await this.database.transaction(async () => {
      const written = await this.repository.saveTransition(
        { id: stored.id, version: stored.version },
        orderRef,
        result,
      );
      if (!written) return false;
      await this.audit.record({
        actor: auditActorOf(actor),
        action: "workflow.transition",
        entityType: "Order",
        entityId: orderRef,
        summary: `${actor.name}: ${command.type} on ${orderRef}, ${state.status} to ${result.state.status}`,
        changes: {
          event: command.type,
          from: state.status,
          to: result.state.status,
          reason: result.event.reason,
          data: result.event.data,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      await alongside?.();
      return true;
    });
    if (!saved) {
      throw await this.refused(
        new ConflictError(
          "Someone else moved this order first. Reload it and try again.",
        ),
        orderRef,
        command.type,
        state.status,
        actor,
        info,
      );
    }
    return result;
  }

  /** The machine's answer, with any refusal audited on the way out. */
  private async decided(
    state: OrderSnapshot,
    orderRef: string,
    command: OrderCommand,
    actor: OrderActor,
    info: RequestInfo,
    now: Date,
  ): Promise<OrderTransitionResult> {
    try {
      return this.machine.apply(state, command, actor, now);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      throw await this.refused(
        error,
        orderRef,
        command.type,
        state.status,
        actor,
        info,
      );
    }
  }

  /**
   * Audits a refusal and hands the error back to throw. If the audit write
   * fails the caller is refused all the same and the failure is logged, as for
   * the guard's and area 4's refusals (ADR 0012).
   */
  private async refused(
    error: DomainError,
    orderRef: string,
    event: string,
    from: OrderStatus | null,
    actor: OrderActor,
    info: RequestInfo,
  ): Promise<DomainError> {
    try {
      await this.audit.record({
        actor: auditActorOf(actor),
        action: "workflow.transition.refused",
        entityType: "Order",
        entityId: orderRef,
        summary: `${actor.name} was refused ${event} on ${orderRef}`,
        changes: {
          event,
          from,
          code: error.code,
          reason: error.message,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
    } catch (auditError) {
      this.logger.error(
        { traceId: info.traceId, err: auditError },
        "Could not audit a refused order transition",
      );
    }
    return error;
  }
}
