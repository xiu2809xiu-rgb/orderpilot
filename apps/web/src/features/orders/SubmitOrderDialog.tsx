import type { SalesOrderDetail } from "@orderpilot/shared";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitSummary } from "./SubmitSummary";
import type { SubmitFailure } from "./submitFailure";

interface SubmitOrderDialogProps {
  record: SalesOrderDetail;
  submitting: boolean;
  failure: SubmitFailure | null;
  onConfirm: () => void;
  /** Closes the dialog. Never called while a submit is in flight. */
  onKeepEditing: () => void;
  onReload: () => void;
  /** Where focus goes when the dialog closes: the button that opened it. */
  returnFocusTo: () => HTMLElement | null;
}

// A 409 or 404 does not say what became of the order, so its title says only
// that this submit did not go through, which holds for each of them.
const titleKey = {
  refused: "form.submit.failedTitle",
  reload: "form.submit.reloadTitle",
  unknown: "form.submit.unknownTitle",
} as const;

const PRESSABLE = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The step before a submit, because nothing in this build can take it back.
 * The consequence comes first, then what it does not do, then what is being
 * submitted. Focus starts on "Keep editing", so Enter never submits by habit,
 * and no shortcut confirms. While the request is in flight both buttons are
 * `aria-disabled` and ignore presses (not `disabled`, which drops focus), and
 * Escape and an outside click do nothing. The same holds while the order is
 * read again after a refusal (`submitting` is true then too). After a failure
 * it says only what the failure proves (see `SubmitFailure`) and focus moves to
 * what to do next.
 */
export function SubmitOrderDialog({
  record,
  submitting,
  failure,
  onConfirm,
  onKeepEditing,
  onReload,
  returnFocusTo,
}: SubmitOrderDialogProps) {
  const { t } = useTranslation("orders");
  const keep = useRef<HTMLButtonElement>(null);
  const reload = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const kind = failure?.kind ?? null;
  const mustReload = kind === "reload" || kind === "unknown";
  useEffect(() => {
    // The block is announced once, as it appears (role="alert"). Focus goes to
    // what the person can do next, so the failure is not read a second time.
    if (failure === null) return;
    (failure.kind === "refused" ? confirm : reload).current?.focus();
  }, [failure]);
  const hold = (event: Event) => {
    if (submitting) event.preventDefault();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submitting) onKeepEditing();
      }}
    >
      <DialogContent
        // A phone turned on its side is 390 px tall: the dialog scrolls inside itself.
        className="max-h-[calc(100dvh-1rem)] sm:max-w-md"
        // Keep editing is the way out: a second one that does nothing during a submit is not drawn.
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keep.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo()?.focus();
        }}
        onEscapeKeyDown={hold}
        onInteractOutside={hold}
      >
        <DialogHeader className="text-left">
          <DialogTitle>
            {t("form.submit.title", { orderNo: record.orderNo })}
          </DialogTitle>
          <DialogDescription>{t("form.submit.consequence")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("form.submit.notDone")}
        </p>
        <SubmitSummary record={record} />
        {failure ? (
          <div
            role="alert"
            className="flex items-start gap-s1 rounded-md border border-destructive/30 bg-(--destructive-surface) p-s2 text-sm"
          >
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1 break-words">
              <p className="font-medium">{t(titleKey[failure.kind])}</p>
              <p>
                {failure.kind === "unknown"
                  ? t("form.submit.unknownBody")
                  : failure.message}
              </p>
              {failure.kind === "refused" ? (
                <p>{t("form.submit.stillDraft")}</p>
              ) : null}
              {failure.traceId ? (
                <p className="numeral text-muted-foreground">
                  {t("form.submit.trace", { traceId: failure.traceId })}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            ref={keep}
            type="button"
            variant="outline"
            aria-disabled={submitting || undefined}
            className={`pointer-coarse:h-11 ${PRESSABLE}`}
            onClick={() => {
              if (!submitting) onKeepEditing();
            }}
          >
            {t("form.submit.keep")}
          </Button>
          {/* Keyed, so React draws a new button and the focus effect, not a reused node, decides where focus is. */}
          {mustReload ? (
            <Button
              key="reload"
              ref={reload}
              type="button"
              aria-disabled={submitting || undefined}
              className={`pointer-coarse:h-11 ${PRESSABLE}`}
              onClick={() => {
                if (!submitting) onReload();
              }}
            >
              {t("form.submit.reload")}
            </Button>
          ) : (
            <Button
              key="confirm"
              ref={confirm}
              type="button"
              aria-disabled={submitting || undefined}
              aria-busy={submitting || undefined}
              className={`pointer-coarse:h-11 ${PRESSABLE}`}
              onClick={() => {
                if (!submitting) onConfirm();
              }}
            >
              {t(submitting ? "form.submit.working" : "form.submit.confirm")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
