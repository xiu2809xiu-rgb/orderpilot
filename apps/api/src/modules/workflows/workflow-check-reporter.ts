import { Inject, Injectable } from "@nestjs/common";
import type { CheckCompleted } from "@orderpilot/shared";
import { ConflictError } from "../../common/domain-error.js";
import type { CheckReporter } from "../checks/domain/order-status-reader.js";
import { holdKeyOf } from "./domain/order-state-machine.js";
import { OrderWorkflowService } from "./order-workflow.service.js";

const CHECKS = { kind: "system", name: "checks" } as const;

/** Enough for a batch of rules on one order to take turns, without looping for ever. */
const MAX_ATTEMPTS = 3;

/**
 * Area 3's port for reporting a finished check. Area 3 says pass or fail, and
 * this decides what that means: a failure holds the order, and that same rule
 * passing later clears its hold. A hold belongs to its rule, so one rule passing
 * never frees an order that another rule still holds.
 *
 * Checks can run again, so a report that changes nothing is ignored. So is a
 * report on an order the machine does not run, or one that has finished.
 *
 * Area 3 runs a batch of rules per order, so another move can get in between
 * reading the order and acting on it. A lost failure would let the order move
 * on unheld, so a conflict means read it again and decide again.
 */
@Injectable()
export class WorkflowCheckReporter implements CheckReporter {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
  ) {}

  async report(completed: CheckCompleted): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.act(completed);
        return;
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async act(completed: CheckCompleted): Promise<void> {
    const view = await this.workflow.statusOf(completed.orderNo);
    if (!view?.open) return;

    const hold = { source: "check", ref: completed.ruleId } as const;
    const held = view.holds.includes(holdKeyOf(hold));
    const info = { ip: null, traceId: completed.resultId };

    if (completed.outcome === "fail" && !held) {
      await this.workflow.apply(
        completed.orderNo,
        {
          type: "HOLD_RAISED",
          ...hold,
          reason: `The check ${completed.ruleId} failed`,
        },
        CHECKS,
        info,
      );
    }
    if (completed.outcome === "pass" && held) {
      await this.workflow.apply(
        completed.orderNo,
        { type: "HOLD_CLEARED", ...hold },
        CHECKS,
        info,
      );
    }
  }
}
