import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "@/components/common";
import { isSameViewer, useMountViewer } from "@/components/form";
import { markConfirmedFocus } from "@/features/directions/screens/order/versions/confirmedFocus";
import { getOrdersOneQueryKey } from "@/lib/api/generated/endpoints/orders/orders";
import type { OrderForm } from "./orderFormValues";
import { confirmRevision } from "./revisionCalls";
import type { Run } from "./revisionRun";

/**
 * Pressing Confirm: sends the body that was previewed with the number it was
 * compared with, and on success ends the form's life: a toast, the form reset
 * (which drops the typed draft), the order written to the cache, and a move to
 * the order's Versions tab. A second press while one is in flight does nothing,
 * and neither does one after someone else has signed in over the page.
 *
 * The order route's cache entry is the whole envelope, so the order is written as
 * `{ data }`: the route reads `data.captureState` and would crash on a bare order.
 */
export function useConfirmRevision(options: {
  form: OrderForm;
  run: Run | null;
  setRun: Dispatch<SetStateAction<Run | null>>;
  /** Moved on by a confirmation, so an older preview's late answer is ignored. */
  latest: RefObject<number>;
  /** Held while the form is written or reset by the panel, which is not an edit. */
  writing: RefObject<boolean>;
}): () => void {
  const { form, run, setRun, latest, writing } = options;
  const { t } = useTranslation("orders");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mountViewer = useMountViewer();
  const inFlight = useRef(false);
  const confirm = useCallback(async () => {
    if (run?.phase.kind !== "ready" || inFlight.current) return;
    // Checked at the press, as the other writes of the kit check it: the panel
    // sits outside the bar, so the bar's own check does not reach it.
    if (!isSameViewer(mountViewer)) return;
    const { data } = run.phase;
    const { orderNo } = run.of;
    inFlight.current = true;
    latest.current += 1;
    setRun({ ...run, phase: { kind: "confirming", data } });
    const result = await confirmRevision(
      orderNo,
      run.body,
      data.fromPoVersionNo,
    );
    inFlight.current = false;
    if (!result.ok) {
      const { failure } = result;
      setRun((current) =>
        current && isSameViewer(mountViewer)
          ? { ...current, phase: { kind: "ready", data, failure } }
          : null,
      );
      // The PO version may be saved after all: the order is read again.
      if (failure.kind === "unknown") {
        void queryClient.invalidateQueries({
          queryKey: getOrdersOneQueryKey(orderNo),
        });
      }
      return;
    }
    // In this order, and nothing sets state after the navigation.
    markConfirmedFocus(orderNo);
    toast.done(
      t("form.revision.done", { n: result.answer.poVersionNo, orderNo }),
    );
    writing.current = true;
    form.reset();
    queryClient.setQueryData(getOrdersOneQueryKey(orderNo), {
      data: result.answer.order,
    });
    // Dropped, not only marked stale: a list read at the old number would be
    // drawn at once, saying that the order has one PO version, until its
    // refetch landed. The tab reads them again from nothing.
    const versionsPath = `/api/v1/orders/${orderNo}/po-versions`;
    queryClient.removeQueries({
      predicate: ({ queryKey }) =>
        typeof queryKey[0] === "string" && queryKey[0].startsWith(versionsPath),
    });
    void queryClient.invalidateQueries();
    void navigate(`/orders/${orderNo}?tab=versions`, { replace: true });
  }, [
    form,
    latest,
    mountViewer,
    navigate,
    queryClient,
    run,
    setRun,
    t,
    writing,
  ]);
  return () => {
    void confirm();
  };
}
