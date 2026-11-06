import { Inject, Injectable } from "@nestjs/common";
import type {
  DocumentTypeConfig,
  InboxRole,
  OpenRule,
  OrderFlow,
  PageMeta,
  PageQuery,
  SprDetail,
  TasksQuery,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import { AuthorisationService } from "../governance/authorisation.service.js";
import { ApprovalPolicy } from "./domain/approval-policy.js";
import { DocumentConfigRepository } from "./document-config.repository.js";
import { mockOpenRules } from "./mock/mock-open-rules.js";
import { SprRecordRepository } from "./spr-record.repository.js";
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

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/** Overdue first, then high priority, then the soonest due. */
function byUrgency(a: WorkflowTask, b: WorkflowTask): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const byPriority =
    PRIORITY_RANK[a.priority ?? "normal"] -
    PRIORITY_RANK[b.priority ?? "normal"];
  return byPriority || a.dueAt.localeCompare(b.dueAt);
}

/**
 * The area 2 base. It answers from the read model. The commands on the mock
 * data live in `MockWorkflowActions`, and Azri's stories put the state machine
 * in their place.
 */
@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
    @Inject(ApprovalPolicy) private readonly approvals: ApprovalPolicy,
    @Inject(DocumentConfigRepository)
    private readonly config: DocumentConfigRepository,
    @Inject(SprRecordRepository)
    private readonly sprRecords: SprRecordRepository,
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
  ) {}

  /** A role's tasks, filtered and paged on the server so a long inbox stays quick. */
  async tasks(role: InboxRole, query: TasksQuery): Promise<Page<WorkflowTask>> {
    const open = await this.openTasks(role);
    const shown = open.filter(
      (task) =>
        (query.overdue !== "true" || task.overdue) &&
        (!query.kind || task.kind === query.kind) &&
        (!query.priority || task.priority === query.priority),
    );
    return paged(shown.sort(byUrgency), query);
  }

  /**
   * The inbox reads from the mock until a story binds a real read model, but a
   * decided SPR is real and must not come back after a restart.
   */
  private async openTasks(role: InboxRole): Promise<WorkflowTask[]> {
    const tasks = await this.model.tasksFor(role);
    const orders = tasks.flatMap((task) =>
      task.kind === "APPROVE_SPR" && task.orderNo ? [task.orderNo] : [],
    );
    const finished = await this.sprRecords.finished(orders);
    return tasks.filter(
      (task) =>
        task.kind !== "APPROVE_SPR" ||
        !task.orderNo ||
        !finished.has(task.orderNo),
    );
  }

  async reminders(
    role: InboxRole,
    query: PageQuery,
  ): Promise<Page<WorkflowReminder>> {
    const all = await this.model.remindersFor(role);
    // As for the task: nobody should be chased over an SPR that has been dealt with.
    const finished =
      role === "APPROVER"
        ? await this.sprRecords.finished(all.map((r) => r.orderNo))
        : new Set<string>();
    const reminders = all.filter((r) => !finished.has(r.orderNo));
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

  async spr(recordNo: string, viewerUserId?: string): Promise<SprDetail> {
    const record = await this.model.sprByRecordNo(recordNo);
    if (!record) throw new NotFoundError(`Stock purchase request ${recordNo}`);
    const approver = await this.approvals.approverFor(record.requestedBy.role);
    if (!approver) throw new NotFoundError(`An approver for ${recordNo}`);
    const stored = record.orderNo
      ? await this.sprRecords.findByOrder(record.orderNo)
      : null;
    const next = stored?.passedOn
      ? await this.policy.deciderFor(stored.passedOn.byUserId)
      : null;
    return {
      ...record,
      // Once the workflow runs this SPR, its own record is what is true of it.
      decision: stored ? stored.decision : record.decision,
      decidable: stored !== null,
      passedTo: stored?.passedOn
        ? {
            name: stored.passedOn.toName,
            byName: stored.passedOn.byName,
            at: stored.passedOn.at,
            askedOutcome: stored.passedOn.outcome,
            comment: stored.passedOn.comment,
            youDecide:
              next !== null &&
              next.kind !== "none" &&
              next.userId === viewerUserId,
          }
        : null,
      approver: { displayName: approver.displayName, setup: approver.setup },
      substituteName: approver.substituteName,
      escalatesToName: approver.escalatesToName,
    };
  }

  documentConfig(): Promise<DocumentTypeConfig[]> {
    return this.config.list();
  }

  /** What stays open until Spectra confirms it, with today's draft values. */
  async openRules(): Promise<OpenRule[]> {
    return mockOpenRules(await this.approvals.approverFor("PRODUCT_MANAGER"));
  }
}
