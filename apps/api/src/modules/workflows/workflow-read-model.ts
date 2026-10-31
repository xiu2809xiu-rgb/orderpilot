import type {
  InboxRole,
  OrderFlow,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import type { SprRecord } from "./mock/mock-sprs.js";

/**
 * Where the routes read their answers from. The base binds it to
 * `MockWorkflowReadModel` (typed data from the synthetic dataset). Azri's
 * stories bind it to a Prisma-backed one reading WorkflowInstance,
 * WorkflowTask and the rest; the service, controller and screens stay as they
 * are, and the routes drop `meta.mock`.
 */
export abstract class WorkflowReadModel {
  abstract tasksFor(role: InboxRole): Promise<WorkflowTask[]>;
  abstract flowOf(orderNo: string): Promise<OrderFlow | null>;
  abstract sprByRecordNo(recordNo: string): Promise<SprRecord | null>;
  abstract remindersFor(role: InboxRole): Promise<WorkflowReminder[]>;
}
