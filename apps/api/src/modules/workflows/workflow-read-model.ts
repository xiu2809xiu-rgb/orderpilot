import type {
  InboxRole,
  OrderFlow,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import type { SprRecord } from "./mock/mock-sprs.js";
import type { RoleTask } from "./workflow-task.repository.js";

/**
 * Where the routes read their answers from. The base binds it to
 * `MockWorkflowReadModel` (typed data from the synthetic dataset). Azri's
 * stories bind it to a Prisma-backed one reading WorkflowInstance,
 * WorkflowTask and the rest; the service, controller and screens stay as they
 * are, and the routes drop `meta.mock`.
 */
export abstract class WorkflowReadModel {
  /** The open tasks in a role's inbox. */
  abstract tasksFor(role: InboxRole): Promise<WorkflowTask[]>;
  /** One task, open or not: an Undo has to find a closed one. */
  abstract taskById(id: string): Promise<WorkflowTask | null>;
  abstract flowOf(orderNo: string): Promise<OrderFlow | null>;
  abstract sprByRecordNo(recordNo: string): Promise<SprRecord | null>;
  /** An order's SPR. The order's number never changes; a sample SPR's number moves with the day. */
  abstract sprByOrder(orderNo: string): Promise<SprRecord | null>;
  /**
   * A task the workflow opened, such as the approvers' task once an SPR is
   * raised, with what a person needs on the row: the customer, the amount and
   * what the SPR would buy. Null when the order is not in the data.
   */
  abstract describe(task: RoleTask, now: Date): Promise<WorkflowTask | null>;
  abstract remindersFor(role: InboxRole): Promise<WorkflowReminder[]>;
}
