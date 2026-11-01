import { Injectable } from "@nestjs/common";
import type { PaymentRecord, SprDetail } from "@orderpilot/shared";

export type SprDecision = NonNullable<SprDetail["decision"]>;

interface OverlaidDecision {
  readonly decision: SprDecision;
  /** The task this decision closed, so an Undo can give it back. */
  readonly taskId: string | null;
}

interface OverlaidPayment {
  readonly record: PaymentRecord;
  readonly taskId: string | null;
}

/**
 * A MOCK that keeps what people did to the mock tasks, so the buttons feel
 * real before the workflow exists: a done task leaves the inbox, a decision
 * shows on its SPR, and each can be undone. Azri's state machine replaces this
 * class, along with `MockWorkflowActions`.
 *
 * It lives in this process's memory on purpose. A restart forgets it, and so
 * does a new day, because the dataset is rebuilt then and an id may name
 * another task. It never holds or changes an order's status, and it decides
 * nothing: no limit, no segregation of duties, no SLA and no transition rule.
 */
@Injectable()
export class MockDecisionOverlay {
  private day: string | null = null;
  private readonly closedTasks = new Set<string>();
  private readonly decisions = new Map<string, OverlaidDecision>();
  private readonly payments = new Map<string, OverlaidPayment>();

  startDay(day: string): void {
    if (day === this.day) return;
    this.day = day;
    this.closedTasks.clear();
    this.decisions.clear();
    this.payments.clear();
  }

  isClosed(taskId: string): boolean {
    return this.closedTasks.has(taskId);
  }

  closeTask(taskId: string): void {
    this.closedTasks.add(taskId);
  }

  /** False when the overlay held no such task, so there was nothing to undo. */
  reopenTask(taskId: string): boolean {
    return this.closedTasks.delete(taskId);
  }

  decisionOf(recordNo: string): SprDecision | null {
    return this.decisions.get(recordNo)?.decision ?? null;
  }

  recordDecision(
    recordNo: string,
    decision: SprDecision,
    taskId: string | null,
  ): void {
    // A second decision replaces the first, and its Undo must still reopen the
    // task the first one closed.
    const closed = this.decisions.get(recordNo)?.taskId ?? taskId;
    this.decisions.set(recordNo, { decision, taskId: closed });
    if (closed) this.closedTasks.add(closed);
  }

  undoDecision(recordNo: string): boolean {
    const entry = this.decisions.get(recordNo);
    if (!entry) return false;
    this.decisions.delete(recordNo);
    if (entry.taskId) this.closedTasks.delete(entry.taskId);
    return true;
  }

  paymentsOf(orderNo: string): PaymentRecord[] {
    return [...this.payments.values()]
      .map((entry) => entry.record)
      .filter((record) => record.orderNo === orderNo);
  }

  recordPayment(record: PaymentRecord, taskId: string | null): void {
    // Only the confirmation that closed the task may reopen it.
    const closes = taskId !== null && !this.closedTasks.has(taskId);
    this.payments.set(record.id, {
      record,
      taskId: closes ? taskId : null,
    });
    if (closes) this.closedTasks.add(taskId);
  }

  undoPayment(orderNo: string, paymentId: string): boolean {
    const entry = this.payments.get(paymentId);
    if (entry?.record.orderNo !== orderNo) return false;
    this.payments.delete(paymentId);
    if (entry.taskId) this.closedTasks.delete(entry.taskId);
    return true;
  }
}
