import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isSameViewer, useMountViewer } from "@/components/form";
import { ReasonDialog } from "@/components/list-page";
import type { DocumentAction } from "./types";
import { useReportFailure } from "./useReportFailure";

/**
 * Runs the bar's actions: a Void or Reject first asks for its reason in the
 * shared dialog, the rest run at once. One runs at a time, the confirm of a
 * reason included, so a double click cannot submit twice, and a failure ends in
 * the server's words, never silence.
 */
export function useActionRunner(): {
  run: (action: DocumentAction) => void;
  dialog: ReactNode;
  busy: boolean;
} {
  const { t } = useTranslation("document-form");
  const report = useReportFailure();
  const mountViewer = useMountViewer();
  const [asking, setAsking] = useState<DocumentAction | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref as well as state: two clicks before a re-render must still see it.
  const inFlight = useRef(false);

  const begin = useCallback((): boolean => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    return true;
  }, []);
  const end = useCallback(() => {
    inFlight.current = false;
    setBusy(false);
  }, []);

  const run = useCallback(
    (action: DocumentAction) => {
      // Checked at the click as well as when the bar was drawn: what is on
      // screen belongs to the person who opened it.
      if (!isSameViewer(mountViewer) || inFlight.current) return;
      if (action.reasoned) {
        setAsking(action);
        return;
      }
      const work = action.run;
      if (!work || !begin()) return;
      void (async () => {
        try {
          await work();
        } catch (error) {
          report(error);
        } finally {
          end();
        }
      })();
    },
    [mountViewer, begin, end, report],
  );

  const reasoned = asking?.reasoned;
  const confirm = reasoned
    ? async (reason: string) => {
        if (!begin()) throw new Error(t("bar.working"));
        try {
          return await reasoned.run(reason);
        } finally {
          end();
        }
      }
    : undefined;
  const dialog =
    reasoned && confirm ? (
      <ReasonDialog
        open
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={reasoned.title}
        {...(reasoned.description ? { description: reasoned.description } : {})}
        confirmLabel={reasoned.confirmLabel}
        doneMessage={reasoned.doneMessage}
        onConfirm={confirm}
      />
    ) : null;
  return { run, dialog, busy };
}
