import { Inject, Injectable } from "@nestjs/common";
import {
  TASK_RECORDED_MESSAGE,
  TASK_UNDONE_MESSAGE,
  compareDecimal,
  sumDecimal,
  type PaymentConfirmationInput,
  type PaymentResult,
  type PaymentType,
  type PaymentUndoResult,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import { ConflictError, NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import { actorOf } from "./actor-of.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import { PaymentConfirmationRepository } from "./payment-confirmation.repository.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";

/** The warehouse's task once the prepayment is in, worded as the sample data words it. */
export const PACK_ORDER_TITLE = "Pick and pack the order";
/** Finance's task, back again when a confirmation is undone. */
export const CONFIRM_PAYMENT_TITLE = "Confirm the prepayment";

/** The payment types the gate counts. A deposit or a balance never opens it. */
const GATE_TYPES: readonly PaymentType[] = ["prepayment", "full-payment"];

/**
 * Finance's payment confirmations on the orders the state machine runs (#290).
 * A confirmation that, with those before it, covers the prepayment due moves
 * the order to Paid, closes Finance's task and gives the warehouse its Pack
 * task, in one transaction. One that does not is kept and audited, and the
 * order waits. Undoing the confirmation that opened the gate closes it again,
 * until the warehouse has started packing.
 */
@Injectable()
export class RunningPayments {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(PaymentConfirmationRepository)
    private readonly payments: PaymentConfirmationRepository,
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
  ) {}

  /** True when the machine runs the order, so its payments are kept here. */
  async runs(orderNo: string): Promise<boolean> {
    return (await this.workflow.statusOf(orderNo)) !== null;
  }

  async confirm(
    orderNo: string,
    input: PaymentConfirmationInput,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<PaymentResult> {
    const before = await this.payments.forOrder(orderNo);
    const repeated = before.some(
      (paid) =>
        paid.paymentType === input.paymentType &&
        compareDecimal(paid.amount, input.amount) === 0,
    );
    if (repeated) throw new ConflictError("This payment is already confirmed.");

    const view = await this.workflow.statusOf(orderNo);
    const store = () =>
      this.payments.add({
        ...input,
        orderRef: orderNo,
        confirmedByUserId: auth.user.id,
        confirmedAt: now,
      });
    let paymentId = "";
    if (
      view?.status === "AwaitingPayment" &&
      GATE_TYPES.includes(input.paymentType)
    ) {
      const total = gateTotal([...before, input]);
      const covers = await this.covers(orderNo, total);
      if (covers) {
        const dueAt = await this.tasks.dueFor("PACK_ORDER", now);
        await this.workflow.apply(
          orderNo,
          {
            type: "PAYMENT_CONFIRMED",
            paymentType: input.paymentType,
            amount: total,
          },
          actorOf(auth),
          info,
          now,
          async () => {
            paymentId = await store();
            await this.recordConfirmed(auth, info, orderNo, input, paymentId);
            await this.tasks.setOpen(orderNo, "CONFIRM_PAYMENT", false, now);
            await this.tasks.openTask({
              orderRef: orderNo,
              kind: "PACK_ORDER",
              title: PACK_ORDER_TITLE,
              assigneeRole: "WAREHOUSE",
              recordNo: null,
              now,
              dueAt,
            });
          },
        );
        return {
          applied: true,
          message: TASK_RECORDED_MESSAGE,
          orderNo,
          paymentId,
          paymentType: input.paymentType,
        };
      }
    }
    await this.database.transaction(async () => {
      paymentId = await store();
      await this.recordConfirmed(auth, info, orderNo, input, paymentId);
    });
    return {
      applied: true,
      message: TASK_RECORDED_MESSAGE,
      orderNo,
      paymentId,
      paymentType: input.paymentType,
    };
  }

  async undo(
    orderNo: string,
    paymentId: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<PaymentUndoResult> {
    const all = await this.payments.forOrder(orderNo);
    const payment = all.find((paid) => paid.id === paymentId);
    if (!payment) throw new NotFoundError("A payment confirmation");
    const rest = all.filter((paid) => paid.id !== paymentId);
    const view = await this.workflow.statusOf(orderNo);
    const opensGate =
      GATE_TYPES.includes(payment.paymentType) &&
      !(await this.covers(orderNo, gateTotal(rest)));

    if (opensGate && view?.status !== "AwaitingPayment") {
      // The machine refuses it once the warehouse has started (409), audited.
      const dueAt = await this.tasks.dueFor("CONFIRM_PAYMENT", now);
      await this.workflow.apply(
        orderNo,
        { type: "PAYMENT_UNDONE" },
        actorOf(auth),
        info,
        now,
        async () => {
          await this.removeOrFail(orderNo, paymentId);
          await this.recordUndone(auth, info, orderNo, paymentId);
          await this.tasks.setOpen(orderNo, "PACK_ORDER", false, now);
          await this.tasks.openTask({
            orderRef: orderNo,
            kind: "CONFIRM_PAYMENT",
            title: CONFIRM_PAYMENT_TITLE,
            assigneeRole: "FINANCE",
            recordNo: null,
            now,
            dueAt,
          });
        },
      );
    } else {
      await this.database.transaction(async () => {
        await this.removeOrFail(orderNo, paymentId);
        await this.recordUndone(auth, info, orderNo, paymentId);
      });
    }
    return { applied: true, message: TASK_UNDONE_MESSAGE, orderNo, paymentId };
  }

  /** Whether this much, confirmed against the gate, covers the order's prepayment due. */
  private async covers(orderNo: string, total: string): Promise<boolean> {
    const due = await this.workflow.prepaymentDueOf(orderNo);
    return due !== null && compareDecimal(total, due) >= 0;
  }

  private async removeOrFail(orderNo: string, paymentId: string) {
    if (!(await this.payments.remove(orderNo, paymentId))) {
      throw new ConflictError(
        "Someone else changed this payment first. Reload it and try again.",
      );
    }
  }

  private recordConfirmed(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    input: PaymentConfirmationInput,
    paymentId: string,
  ) {
    return this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.payment.confirmed",
      entityType: "Payment",
      entityId: paymentId,
      summary: `${auth.user.displayName} confirmed a ${input.paymentType} for ${orderNo}`,
      changes: {
        orderNo,
        paymentType: input.paymentType,
        amount: input.amount,
        currencyCode: input.currencyCode,
        reference: input.reference,
      },
      ip: info.ip,
      traceId: info.traceId,
    });
  }

  private recordUndone(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    paymentId: string,
  ) {
    return this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.payment.undone",
      entityType: "Payment",
      entityId: paymentId,
      summary: `${auth.user.displayName} undid the payment confirmation for ${orderNo}`,
      changes: { orderNo },
      ip: info.ip,
      traceId: info.traceId,
    });
  }
}

/** Everything confirmed against the gate: prepayments and full payments only. */
function gateTotal(
  payments: readonly { paymentType: PaymentType; amount: string }[],
): string {
  return sumDecimal(
    payments
      .filter((paid) => GATE_TYPES.includes(paid.paymentType))
      .map((paid) => paid.amount),
  );
}
