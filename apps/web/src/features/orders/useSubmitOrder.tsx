import type { SalesOrderDetail } from "@orderpilot/shared";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import type { DocumentAction } from "@/components/document-form";
import {
  applyServerError,
  isSameViewer,
  useMountViewer,
  useViewerChanged,
  type PathMap,
} from "@/components/form";
import {
  getOrdersOneQueryKey,
  ordersSubmitDraft,
} from "@/lib/api/generated/endpoints/orders/orders";
import { markSubmittedFocus } from "@/features/directions/screens/order/submittedFocus";
import { SubmitOrderDialog } from "./SubmitOrderDialog";
import { submitFailureOf, type SubmitFailure } from "./submitFailure";
import { markSubmitReopen, takeSubmitReopen } from "./submitReopen";
import type { OrderForm } from "./orderFormValues";

/** The page's button with these words, when the one that was pressed is gone. */
function buttonNamed(name: string): HTMLElement | null {
  const buttons = document.querySelectorAll<HTMLElement>("button");
  return (
    [...buttons].find((button) => button.textContent.trim() === name) ?? null
  );
}

type Phase =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "failed"; failure: SubmitFailure }
  // The order is being read again: the dialog stays, inert, until the page is
  // drawn anew, and opens at its first view if the order is still a draft.
  | { kind: "reloading"; failure: SubmitFailure };

/**
 * Submit, for a saved draft: the bar's action and the dialog it opens. The
 * action is null for anything that is not a draft. Confirming sends the version
 * the form was typed against, so a draft someone else changed is refused and
 * not submitted over their work.
 *
 * Who is signed in is checked as the other writes of the kit check it: the
 * dialog sits outside the bar, so the bar's block does not reach it. If someone
 * else has signed in over the open page, the dialog closes (also when a request
 * settles after it) and confirming sends nothing.
 */
export function useSubmitOrder(options: {
  form: OrderForm;
  record: SalesOrderDetail | null;
  /** The server's field names where the form calls them something else. */
  serverPaths: PathMap;
  /** Reads the order again and gives the form its values; the notice's Reload does the same. */
  onReload: () => void;
  /** False while the page draws something instead of the form (not found, an error). */
  canReopen: boolean;
}): { action: DocumentAction | null; dialog: ReactNode } {
  const { form, record, serverPaths, onReload, canReopen } = options;
  const { t } = useTranslation("orders");
  const queryClient = useQueryClient();
  const mountViewer = useMountViewer();
  const otherViewer = useViewerChanged();
  const [phase, setPhase] = useState<Phase>({ kind: "closed" });
  // A ref as well as state: two presses before a re-render must still see it.
  const inFlight = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  // False once a field has taken focus, which nothing may take back.
  const restoreFocus = useRef(true);
  const orderNo = record?.orderNo ?? null;
  const isDraft = record?.captureState === "draft";

  const kind = phase.kind;
  useEffect(() => {
    // Also when a request settles: the failure view would show the first
    // person's order to the one who signed in meanwhile.
    if (otherViewer && kind !== "closed" && kind !== "submitting")
      setPhase({ kind: "closed" });
  }, [otherViewer, kind]);

  const open = useCallback(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    restoreFocus.current = true;
    setPhase({ kind: "open" });
  }, []);

  useEffect(() => {
    // A reload of this order from the dialog gave the page a new key: open the
    // dialog again if the order is still a draft, with the new edit token.
    if (orderNo === null || !takeSubmitReopen(orderNo)) return;
    if (canReopen && isDraft) open();
  }, [canReopen, isDraft, open, orderNo]);

  const confirm = useCallback(async () => {
    if (orderNo === null || inFlight.current) return;
    // Checked at the press as well as when the dialog opened.
    if (!isSameViewer(mountViewer)) return;
    inFlight.current = true;
    setPhase({ kind: "submitting" });
    try {
      const answer = await ordersSubmitDraft(orderNo, {
        version: form.getValues("version") ?? 1,
      });
      // The mark first, then the cache write that makes the route draw the
      // order's page in place of this form: the page that mounts takes the
      // mark. Nothing sets state after the swap.
      markSubmittedFocus(orderNo);
      toast.done(t("form.submit.done", { orderNo }));
      queryClient.setQueryData(getOrdersOneQueryKey(orderNo), answer);
      void queryClient.invalidateQueries();
    } catch (error) {
      const failure = submitFailureOf(error);
      if (failure === "fields") {
        restoreFocus.current = false;
        setPhase({ kind: "closed" });
        applyServerError(error, form, serverPaths);
      } else {
        // Checked again now: the answer belongs to the person who pressed.
        setPhase(
          isSameViewer(mountViewer)
            ? { kind: "failed", failure }
            : { kind: "closed" },
        );
        // The order may be submitted after all: the page swaps by itself if
        // so, and the notice takes focus, so the mark is set as for a success.
        if (failure.kind === "unknown") {
          markSubmittedFocus(orderNo);
          void queryClient.invalidateQueries({
            queryKey: getOrdersOneQueryKey(orderNo),
          });
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [form, mountViewer, orderNo, queryClient, serverPaths, t]);

  const action = useMemo<DocumentAction | null>(
    () =>
      isDraft
        ? {
            id: "submit",
            kind: "submit",
            permission: "orders.edit",
            label: t("form.submit.label"),
            icon: FileCheck,
            run: open,
          }
        : null,
    [isDraft, open, t],
  );

  const dialog =
    record && phase.kind !== "closed" && !otherViewer ? (
      <SubmitOrderDialog
        record={record}
        submitting={phase.kind === "submitting" || phase.kind === "reloading"}
        failure={
          phase.kind === "failed" || phase.kind === "reloading"
            ? phase.failure
            : null
        }
        onConfirm={() => {
          void confirm();
        }}
        onKeepEditing={() => {
          setPhase({ kind: "closed" });
        }}
        onReload={() => {
          if (phase.kind !== "failed" || orderNo === null) return;
          // Dropping the typed draft first, as the notice's Reload does, or the
          // reload would bring it back. If the order is submitted now, by
          // someone else, the page that replaces this one takes focus; if it is
          // still a draft, the page that mounts opens this dialog again.
          markSubmittedFocus(orderNo);
          markSubmitReopen(orderNo);
          restoreFocus.current = false;
          setPhase({ kind: "reloading", failure: phase.failure });
          form.reset();
          onReload();
        }}
        returnFocusTo={() => {
          if (!restoreFocus.current) return null;
          const button = opener.current;
          if (button?.isConnected) return button;
          // The bar draws its button again while it works, so the one that was
          // pressed may be gone: the one with the same words is its successor.
          return buttonNamed(t("form.submit.label"));
        }}
      />
    ) : null;
  return { action, dialog };
}
