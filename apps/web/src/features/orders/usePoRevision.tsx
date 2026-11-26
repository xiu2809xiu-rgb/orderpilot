import type { CreateSalesOrderBody } from "@orderpilot/shared";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useViewerChanged } from "@/components/form";
import { hasPermission, useSessionStore } from "@/stores/session";
import { PoRevisionPanel } from "./PoRevisionPanel";
import { previewRevision } from "./revisionCalls";
import { keptBodyOf, type Run, type RevisionPhase } from "./revisionRun";
import type { OrderNotice } from "./OrderNotices";
import type { OrderForm } from "./orderFormValues";
import { useConfirmRevision } from "./useConfirmRevision";
import { useExistingOrder, type ExistingOrder } from "./useExistingOrder";
import { useRevisionWatch } from "./useRevisionWatch";

type Duplicate = Extract<OrderNotice, { kind: "duplicate" }>;

/** The offer in the duplicate notice: "This PO revises ...". */
export interface RevisionOffer {
  onOpen: () => void;
  /** The button, so focus can return to it when the panel closes. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  expanded: boolean;
}

/**
 * Adding a re-sent PO to a submitted order as its next PO version, from the New
 * order form. The refused create names the order, and the person may say that
 * this PO revises it: the panel then asks the server what it would change
 * (writing nothing) and confirms with the number it compared with.
 *
 * The offer belongs to the body that was refused. If the form changes after the
 * refusal, or the notice goes, the offer and the panel go with it and Save
 * returns; while the panel is open the form is locked, so what it shows is what
 * would be sent. Preview and confirm are plain calls, not query hooks, so that a
 * refetch the app makes elsewhere never sends them again.
 */
export function usePoRevision(options: {
  form: OrderForm;
  notice: OrderNotice | null;
}): {
  /** The panel is open: the form is locked and the bar of actions is not drawn. */
  open: boolean;
  existing: ExistingOrder | null;
  offer: RevisionOffer | null;
  /** The person holds orders.edit; without it there is no offer, only the state of the order. */
  mayEdit: boolean;
  /** The form changed after the refusal, so the notice's state sentence is no longer true. */
  moved: boolean;
  node: ReactNode;
} {
  const { form, notice } = options;
  const otherViewer = useViewerChanged();
  const mayEdit = useSessionStore((state) =>
    hasPermission(state.session, "orders.edit"),
  );
  const duplicate = notice?.kind === "duplicate" ? notice : null;
  const fromCreate = duplicate?.fromCreate === true;
  const existing = useExistingOrder(
    duplicate && fromCreate ? duplicate.orderNo : null,
  );
  const { moved, writing, follow } = useRevisionWatch(form, duplicate);
  const [run, setRun] = useState<Run | null>(null);
  // A request counter, so an answer that has been overtaken is ignored.
  const latest = useRef(0);
  // The body the form now shows, once the header values were kept: opening the
  // panel again asks about that body and not about the one that was refused.
  const keptBody = useRef<{ of: Duplicate; body: CreateSalesOrderBody } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);

  const open =
    duplicate !== null &&
    fromCreate &&
    run?.of === duplicate &&
    !moved &&
    !otherViewer;

  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open && returnFocus.current) {
      buttonRef.current?.focus();
    }
    returnFocus.current = false;
    wasOpen.current = open;
  }, [open]);

  const preview = useCallback(
    async (of: Duplicate, body: CreateSalesOrderBody) => {
      latest.current += 1;
      const mine = latest.current;
      const phase = (next: RevisionPhase) => {
        if (mine === latest.current) {
          setRun((current) =>
            current?.of === of ? { ...current, phase: next } : current,
          );
        }
      };
      phase({ kind: "loading" });
      phase(await previewRevision(of.orderNo, body));
    },
    [],
  );

  const openPanel = useCallback(() => {
    if (!duplicate?.body) return;
    const body =
      keptBody.current?.of === duplicate
        ? keptBody.current.body
        : duplicate.body;
    setRun({ of: duplicate, body, phase: { kind: "loading" }, kept: false });
    void preview(duplicate, body);
  }, [duplicate, preview]);

  const close = useCallback(() => {
    latest.current += 1;
    returnFocus.current = true;
    setRun(null);
  }, []);

  // The form is locked while the panel is open, so the three values are set
  // here and the form keeps showing what the next confirmation sends.
  const keepHeader = useCallback(() => {
    if (
      !run ||
      (run.phase.kind !== "ready" && run.phase.kind !== "identical")
    ) {
      return;
    }
    const body = keptBodyOf(run.body, run.phase.data);
    writing.current = true;
    try {
      form.setValue("orderDate", body.orderDate);
      form.setValue("shipmentDate", body.shipmentDate ?? "");
      form.setValue("prepaymentPercent", body.prepaymentPercent);
    } finally {
      writing.current = false;
    }
    // The offer's key follows the new values, or it would vanish as if the
    // person had edited the form.
    follow();
    keptBody.current = { of: run.of, body };
    setRun({ ...run, body, kept: true });
    void preview(run.of, body);
  }, [follow, form, preview, run, writing]);

  const confirm = useConfirmRevision({ form, run, setRun, latest, writing });

  const offer: RevisionOffer | null =
    duplicate !== null &&
    fromCreate &&
    mayEdit &&
    !moved &&
    existing?.kind === "submitted"
      ? { onOpen: openPanel, buttonRef, expanded: open }
      : null;

  const node = open ? (
    <PoRevisionPanel
      orderNo={run.of.orderNo}
      existing={existing}
      phase={run.phase}
      kept={run.kept}
      onClose={close}
      onConfirm={confirm}
      onCompareAgain={() => {
        void preview(run.of, run.body);
      }}
      onKeepHeader={keepHeader}
    />
  ) : null;

  return { open, existing, offer, mayEdit, moved, node };
}
