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
  | { kind: "failed"; failure: SubmitFailure };

/**
 * Submit, for a saved draft: the bar's action and the dialog it opens. The
 * action is null for anything that is not a draft. Confirming sends the version
 * the form was typed against, so a draft someone else changed is refused and
 * not submitted over their work.
 *
 * Who is signed in is checked as the other writes of the kit check it: the
 * dialog sits outside the bar, so the bar's block does not reach it. If someone
 * else has signed in over the open page, the dialog closes and confirming
 * sends nothing.
 */
export function useSubmitOrder(options: {
  form: OrderForm;
  record: SalesOrderDetail | null;
  /** The server's field names where the form calls them something else. */
  serverPaths: PathMap;
  /** Reads the order again and gives the form its values; the notice's Reload does the same. */
  onReload: () => void;
}): { action: DocumentAction | null; dialog: ReactNode } {
  const { form, record, serverPaths, onReload } = options;
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

  useEffect(() => {
    if (otherViewer && !inFlight.current) setPhase({ kind: "closed" });
  }, [otherViewer]);

  const open = useCallback(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    restoreFocus.current = true;
    setPhase({ kind: "open" });
  }, []);

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
      // In this order, and nothing sets state after the swap: the cache write
      // makes the route draw the order's page in place of this form, so the
      // page that mounts finds the mark and takes focus.
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
        setPhase({ kind: "failed", failure });
        // The order may be submitted after all: the page swaps by itself if so.
        if (failure.kind === "unknown") {
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
    record && phase.kind !== "closed" ? (
      <SubmitOrderDialog
        record={record}
        submitting={phase.kind === "submitting"}
        failure={phase.kind === "failed" ? phase.failure : null}
        onConfirm={() => {
          void confirm();
        }}
        onKeepEditing={() => {
          setPhase({ kind: "closed" });
        }}
        onReload={() => {
          // Dropping the typed draft first, as the notice's Reload does, or the
          // reload would bring it back. If the order is submitted now, by
          // someone else, the page that replaces this one takes focus.
          if (orderNo !== null) markSubmittedFocus(orderNo);
          setPhase({ kind: "closed" });
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
