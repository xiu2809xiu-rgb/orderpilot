import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../auth/auth-context.js";
import { ConflictError, NotFoundError } from "../../common/domain-error.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import { actorOf } from "./actor-of.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import { SprRecordRepository } from "./spr-record.repository.js";
import { WorkflowReadModel } from "./workflow-read-model.js";
import {
  WorkflowTaskRepository,
  type StoredTask,
} from "./workflow-task.repository.js";

/** The approver's task, worded as the sample data words it. */
export const APPROVE_SPR_TITLE = "Approve or reject the SPR";
/** The product manager's task, worded as the sample data words it. */
export const RAISE_SPR_TITLE = "Review the suggested SPR";
/** The product manager's step after an approval. */
export const PLACE_VENDOR_PO_TITLE = "Place the vendor PO";

/**
 * Raising an SPR, and taking a raise back. Raising moves the order on the state
 * machine to wait on the approvers, gives the SPR its data, closes the product
 * manager's task and opens the approvers' one, all in one transaction, so the
 * approvers find it in their list straight away (#251, #290). The amount comes
 * from the SPR itself and the requester is whoever raised it.
 */
@Injectable()
export class SprRaiseService {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(SprRecordRepository) private readonly records: SprRecordRepository,
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
  ) {}

  async raise(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<void> {
    assertAboutSpr(task);
    // By the order: a sample SPR's number moves with the day, the order's does not.
    const spr = await this.model.sprByOrder(task.orderRef);
    if (!spr) throw new NotFoundError(`An SPR for ${task.orderRef}`);
    const recordNo = spr.ref.recordNo;
    const dueAt = await this.tasks.dueFor("APPROVE_SPR", now);
    await this.workflow.apply(
      task.orderRef,
      { type: "SPR_RAISED" },
      actorOf(auth),
      info,
      now,
      async () => {
        await this.records.raise(task.orderRef, {
          amount: spr.amount,
          requesterUserId: auth.user.id,
        });
        await this.tasks.setOpenById(task.id, false, now);
        await this.tasks.openTask({
          orderRef: task.orderRef,
          kind: "APPROVE_SPR",
          title: APPROVE_SPR_TITLE,
          assigneeRole: "APPROVER",
          recordNo,
          now,
          dueAt,
        });
      },
    );
  }

  /** Before anyone has decided: the SPR is a suggestion again, back with the product manager. */
  async withdraw(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<void> {
    assertAboutSpr(task);
    const recordNo = task.recordNo;
    const dueAt = await this.tasks.dueFor("RAISE_SPR", now);
    await this.workflow.apply(
      task.orderRef,
      { type: "SPR_RAISE_WITHDRAWN" },
      actorOf(auth),
      info,
      now,
      async () => {
        await this.records.withdraw(task.orderRef);
        await this.tasks.setOpen(task.orderRef, "APPROVE_SPR", false, now);
        await this.tasks.openTask({
          orderRef: task.orderRef,
          kind: "RAISE_SPR",
          title: task.title,
          assigneeRole: "PRODUCT_MANAGER",
          recordNo,
          now,
          dueAt,
        });
      },
    );
  }
}

function assertAboutSpr(task: StoredTask): void {
  if (!task.recordNo) {
    throw new ConflictError("This task is not about an SPR.");
  }
}
