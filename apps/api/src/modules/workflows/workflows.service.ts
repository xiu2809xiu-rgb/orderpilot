import { Inject, Injectable } from "@nestjs/common";
import {
  NOT_APPLIED_MESSAGE,
  type DocumentTypeConfig,
  type InboxRole,
  type OrderFlow,
  type PageMeta,
  type PageQuery,
  type PaymentConfirmationInput,
  type PaymentResult,
  type SprDecisionResult,
  type SprDetail,
  type WorkflowReminder,
  type WorkflowTask,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import { ApprovalPolicy } from "./domain/approval-policy.js";
import { DocumentConfigRepository } from "./document-config.repository.js";
import { WorkflowReadModel } from "./workflow-read-model.js";

export interface Page<T> {
  readonly items: T[];
  readonly meta: PageMeta;
}

function paged<T>(all: readonly T[], query: PageQuery): Page<T> {
  const start = (query.page - 1) * query.pageSize;
  return {
    items: all.slice(start, start + query.pageSize),
    meta: { page: query.page, pageSize: query.pageSize, total: all.length },
  };
}

/** Overdue first, then the soonest due. */
function byUrgency(a: WorkflowTask, b: WorkflowTask): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return a.dueAt.localeCompare(b.dueAt);
}

/**
 * The area 2 base. It answers from the read model and changes nothing: the
 * commands check what they should (the record exists, the input is valid, the
 * caller holds the permission) and then say that nothing was applied. Azri's
 * stories put the state machine behind the commands.
 */
@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
    @Inject(ApprovalPolicy) private readonly approvals: ApprovalPolicy,
    @Inject(DocumentConfigRepository)
    private readonly config: DocumentConfigRepository,
  ) {}

  async tasks(
    role: InboxRole,
    query: PageQuery,
    overdueOnly: boolean,
  ): Promise<Page<WorkflowTask>> {
    const tasks = await this.model.tasksFor(role);
    const shown = overdueOnly ? tasks.filter((task) => task.overdue) : tasks;
    return paged([...shown].sort(byUrgency), query);
  }

  async reminders(
    role: InboxRole,
    query: PageQuery,
  ): Promise<Page<WorkflowReminder>> {
    const reminders = await this.model.remindersFor(role);
    return paged(
      [...reminders].sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
      query,
    );
  }

  async flow(orderNo: string): Promise<OrderFlow> {
    const flow = await this.model.flowOf(orderNo);
    if (!flow) throw new NotFoundError(`Order ${orderNo}`);
    return flow;
  }

  async spr(recordNo: string): Promise<SprDetail> {
    const record = await this.model.sprByRecordNo(recordNo);
    if (!record) throw new NotFoundError(`Stock purchase request ${recordNo}`);
    const approver = await this.approvals.approverFor(record.requestedBy.role);
    if (!approver) throw new NotFoundError(`An approver for ${recordNo}`);
    return {
      ...record,
      approver: { displayName: approver.displayName, setup: approver.setup },
      substituteName: approver.substituteName,
    };
  }

  /** Approve or reject. Checked and answered; nothing is changed (the SPR story is Azri's). */
  async decide(
    recordNo: string,
    outcome: SprDecisionResult["outcome"],
    comment: string,
  ): Promise<SprDecisionResult> {
    await this.spr(recordNo);
    return {
      applied: false,
      message: NOT_APPLIED_MESSAGE,
      recordNo,
      outcome,
      comment,
    };
  }

  /** Confirm a payment. Checked and answered; nothing is stored (the payment gate is Azri's). */
  async confirmPayment(
    orderNo: string,
    input: PaymentConfirmationInput,
  ): Promise<PaymentResult> {
    await this.flow(orderNo);
    return {
      applied: false,
      message: NOT_APPLIED_MESSAGE,
      orderNo,
      paymentType: input.paymentType,
    };
  }

  documentConfig(): Promise<DocumentTypeConfig[]> {
    return this.config.list();
  }
}
