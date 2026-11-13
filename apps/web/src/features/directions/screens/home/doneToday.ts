import type { WorkflowTask } from "@orderpilot/shared";

/** A task the person finished from the home screen, with the time they did. */
export interface DoneItem {
  task: WorkflowTask;
  at: Date;
}
