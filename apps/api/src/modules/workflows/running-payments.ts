import { Inject, Injectable } from "@nestjs/common";
import {
  TASK_RECORDED_MESSAGE,
  TASK_UNDONE_MESSAGE,
  USD,
  type OrderStatus,
  type PaymentConfirmationInput,
  type PaymentRecord,
  type PaymentResult,
  type PaymentUndoResult,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import {
  ConflictError,
  type DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import { actorOf } from "./actor-of.js";
import { GATE_TYPES, covers, gateTotal } from "./domain/payment-gate.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import {
  DuplicatePaymentError,
  PaymentConfirmationRepository,
} from "./payment-confirmation.repository.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";

/** The warehouse's task once the prepayment is in, worded as the sample data words it. */
export const PACK_ORDER_TITLE = "Pick and pack the order";
/** Finance's task, back again when a confirmation is undone. */
export const CONFIRM_PAYMENT_TITLE = "Confirm the prepayment";

/** The statuses before the gate: a payment taken back there closes nothing. */
const BEFORE_THE_GATE: readonly OrderStatus[] = [
  "Received",
  "Confirmed",
  "StockChecked",
  "AwaitingSpr",
  "SprApproved",
  "AwaitingPayment",
];

/**
 * Finance's payment confirmations on the orders the state machine runs (#290).
 * A confirmation that, with those before it, covers the prepayment due moves
 * the order to Paid, closes Finance's task and gives the warehouse its Pack
 * task, in one transaction. One that does not is kept and audited, and the
 * order waits. Undoing the confirmation that opened the gate closes it again,
 * until the warehouse has started packing. Every refusal is audited.
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
    // Spectra bills in US dollars, so the right number in another currency is not the payment.
    if (input.currencyCode !== USD) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "wrong-currency",
        new ConflictError(
          `This order is billed in ${USD}, so a payment in ${input.currencyCode} cannot be confirmed against it.`,
        ),
      );
    }
    const before = await this.payments.forOrder(orderNo);
    // One transfer is one bank reference: two equal instalments are two payments.
    if (before.some((paid) => isSameTransfer(paid, input))) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "already-confirmed",
        new ConflictError("This payment is already confirmed."),
      );
    }

    const view = await this.workflow.statusOf(orderNo);
    const due = await this.workflow.prepaymentDueOf(orderNo);
    let paymentId = "";
    const store = async () => {
      paymentId = await this.payments.add({
        ...input,
        orderRef: orderNo,
        confirmedByUserId: auth.user.id,
        confirmedAt: now,
      });
      await this.recordConfirmed(auth, info, orderNo, input, paymentId);
    };
    const total = gateTotal([...before, input]);
    const opensGate =
      view?.status === "AwaitingPayment" &&
      GATE_TYPES.includes(input.paymentType) &&
      covers(total, due);

    await this.auditingRefusals(auth, info, orderNo, async () => {
      if (!opensGate) {
        await this.database.transaction(store);
        return;
      }
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
          await store();
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
    });
    return {
      applied: true,
      message: TASK_RECORDED_MESSAGE,
      orderNo,
      paymentId,
      paymentType: input.paymentType,
    };
  }

  /**
   * Takes a confirmation back. Only one the gate still needs on a Paid order
   * moves the order back to Finance; once the goods are being packed against
   * it, it is refused. Any other is simply removed.
   */
  async undo(
    orderNo: string,
    paymentId: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<PaymentUndoResult> {
    const all = await this.payments.forOrder(orderNo);
    const payment = all.find((paid) => paid.id === paymentId);
    if (!payment) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "unknown-payment",
        new NotFoundError("A payment confirmation"),
      );
    }
    const view = await this.workflow.statusOf(orderNo);
    const due = await this.workflow.prepaymentDueOf(orderNo);
    const rest = all.filter((paid) => paid.id !== paymentId);
    const closesGate =
      GATE_TYPES.includes(payment.paymentType) &&
      covers(gateTotal(all), due) &&
      !covers(gateTotal(rest), due);
    const status = view?.status ?? "AwaitingPayment";

    if (!closesGate || BEFORE_THE_GATE.includes(status)) {
      await this.auditingRefusals(auth, info, orderNo, () =>
        this.database.transaction(async () => {
          await this.removeOrFail(orderNo, paymentId);
          await this.recordUndone(auth, info, orderNo, paymentId);
        }),
      );
    } else if (status === "Paid") {
      const dueAt = await this.tasks.dueFor("CONFIRM_PAYMENT", now);
      await this.auditingRefusals(auth, info, orderNo, async () => {
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
      });
    } else {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "goods-moving",
        new ConflictError(
          "The goods are being packed against this payment, so it cannot be taken back. Undo the packing first.",
        ),
      );
    }
    return { applied: true, message: TASK_UNDONE_MESSAGE, orderNo, paymentId };
  }

  /**
   * A refusal raised inside a transaction is caught here, once the transaction
   * has rolled back, so that its audit event is written and kept: the
   * database's unique key stopping a second confirmation racing in, and a
   * payment someone else took back first.
   */
  private async auditingRefusals(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof DuplicatePaymentError) {
        throw await this.refused(
          auth,
          info,
          orderNo,
          "already-confirmed",
          new ConflictError("This payment is already confirmed."),
        );
      }
      if (error instanceof PaymentChangedError) {
        throw await this.refused(
          auth,
          info,
          orderNo,
          "changed-meanwhile",
          new ConflictError(
            "Someone else changed this payment first. Reload it and try again.",
          ),
        );
      }
      throw error;
    }
  }

  private async removeOrFail(orderNo: string, paymentId: string) {
    if (!(await this.payments.remove(orderNo, paymentId))) {
      throw new PaymentChangedError();
    }
  }

  /** Audits a refusal, outside any transaction, and hands back the error to throw. */
  private async refused(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    reason: string,
    error: DomainError,
  ): Promise<DomainError> {
    await this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.payment.refused",
      entityType: "Order",
      entityId: orderNo,
      summary: `${auth.user.displayName} was refused a payment action on ${orderNo}: ${error.message}`,
      changes: { reason, orderNo },
      ip: info.ip,
      traceId: info.traceId,
    });
    return error;
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

/** The payment vanished between the read and the removal: someone undid it first. */
class PaymentChangedError extends Error {}

/** The same transfer: the same type under the same bank reference, whatever its case. */
function isSameTransfer(
  paid: PaymentRecord,
  input: PaymentConfirmationInput,
): boolean {
  return (
    paid.paymentType === input.paymentType &&
    paid.reference.trim().toLowerCase() === input.reference.trim().toLowerCase()
  );
}
