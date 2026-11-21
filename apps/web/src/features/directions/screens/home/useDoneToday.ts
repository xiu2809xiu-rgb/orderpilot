import type { WorkflowTask } from "@orderpilot/shared";
import { useCallback, useState } from "react";
import { useSessionStore } from "@/stores/session";
import { forgetDone, readDone, recordDone, type DoneItem } from "./doneToday";

/**
 * What the signed-in person finished today, from the browser's own copy. Home
 * lists it and the order page adds to it through the same two calls, so an act
 * made on an order's page is on Home the next time Home opens. The list is read
 * once when the screen starts: the screens that start again for the next person
 * (a role switch) read that person's list.
 */
export function useDoneToday(): {
  done: readonly DoneItem[];
  record: (task: WorkflowTask, at: Date) => void;
  forget: (task: WorkflowTask) => void;
} {
  const viewerId = useSessionStore((state) => state.session?.user.id ?? null);
  const [done, setDone] = useState(() => readDone(viewerId));
  const record = useCallback(
    (task: WorkflowTask, at: Date) => {
      setDone(recordDone(viewerId, task, at));
    },
    [viewerId],
  );
  const forget = useCallback(
    (task: WorkflowTask) => {
      setDone(forgetDone(viewerId, task));
    },
    [viewerId],
  );
  return { done, record, forget };
}
