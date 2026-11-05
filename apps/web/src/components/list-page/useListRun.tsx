import { useCallback, useState, type ReactNode } from "react";
import { ReasonDialog } from "./ReasonDialog";
import type { ListAction } from "./types";

interface Asking<Row> {
  action: ListAction<Row>;
  rows: readonly Row[];
  fromBar: boolean;
}

/**
 * How a list runs an action, from the bar or from a row menu: a Void or a
 * Disable first asks for its reason in the one shared dialog, everything else
 * runs at once. An action run from the bar on the ticked rows clears the
 * ticks when it is done; one from a row menu leaves them alone.
 */
export function useListRun<Row>(clearSelection: () => void): {
  run: (
    action: ListAction<Row>,
    rows: readonly Row[],
    fromBar: boolean,
  ) => void;
  dialog: ReactNode;
} {
  const [asking, setAsking] = useState<Asking<Row> | null>(null);

  const run = useCallback(
    (action: ListAction<Row>, rows: readonly Row[], fromBar: boolean) => {
      if (action.reasoned) {
        setAsking({ action, rows, fromBar });
        return;
      }
      action.onRun?.(rows);
      if (fromBar) clearSelection();
    },
    [clearSelection],
  );

  const reasoned = asking?.action.reasoned;
  const dialog =
    asking && reasoned ? (
      <ReasonDialog
        open
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={reasoned.title}
        {...(reasoned.description ? { description: reasoned.description } : {})}
        confirmLabel={reasoned.confirmLabel}
        doneMessage={reasoned.doneMessage(asking.rows)}
        onConfirm={async (reason) => {
          const result = await reasoned.run(asking.rows, reason);
          if (asking.fromBar) clearSelection();
          return result;
        }}
      />
    ) : null;
  return { run, dialog };
}
