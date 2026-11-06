import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { ReasonDialog } from "@/components/list-page";
import type { DocumentAction } from "./types";

/**
 * Runs the bar's actions: a Void or Reject first asks for its reason in the
 * shared dialog, the rest run at once. One runs at a time, so a double click
 * cannot submit twice, and a failure ends in a message, never silence.
 */
export function useActionRunner(): {
  run: (action: DocumentAction) => void;
  dialog: ReactNode;
  busy: boolean;
} {
  const { t } = useTranslation("document-form");
  const [asking, setAsking] = useState<DocumentAction | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    (action: DocumentAction) => {
      if (action.reasoned) {
        setAsking(action);
        return;
      }
      if (busy || !action.run) return;
      setBusy(true);
      void (async () => {
        try {
          await action.run?.();
        } catch {
          toast.failed(t("actionFailed"));
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, t],
  );

  const reasoned = asking?.reasoned;
  const dialog = reasoned ? (
    <ReasonDialog
      open
      onOpenChange={(open) => {
        if (!open) setAsking(null);
      }}
      title={reasoned.title}
      {...(reasoned.description ? { description: reasoned.description } : {})}
      confirmLabel={reasoned.confirmLabel}
      doneMessage={reasoned.doneMessage}
      onConfirm={reasoned.run}
    />
  ) : null;
  return { run, dialog, busy };
}
