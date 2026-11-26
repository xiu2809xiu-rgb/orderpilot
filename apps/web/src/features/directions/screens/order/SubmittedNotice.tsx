import type { SalesOrderDetail } from "@orderpilot/shared";
import { Info } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { AuditLink } from "@/components/common/AuditLink";
import { hasPermission, useSessionStore } from "@/stores/session";
import { isTypedHere } from "../orders/orderRow";
import { focusActivityPanel } from "./focusActivityPanel";
import { takeSubmittedFocus } from "./submittedFocus";

/**
 * What a submitted order is, and what is not true of it yet. Shown only for an
 * order entered here, submitted, that no team holds: it says the order is not
 * approved, that no team has a task for it, and where to see who submitted it.
 * A role that may edit orders also reads what a mistake means, because only
 * that role could have made one. It names no price, so a masked role reads the
 * same words.
 *
 * It is a labelled region and not a live region: the toast that ended the
 * submit already announced it, and a focused, labelled region is read once.
 * It takes focus once, straight after a submit (`takeSubmittedFocus`).
 */
export function SubmittedNotice({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const titleId = useId();
  const region = useRef<HTMLElement>(null);
  const [params, setParams] = useSearchParams();
  const mayEdit = useSessionStore((state) =>
    hasPermission(state.session, "orders.edit"),
  );
  const shown = isTypedHere(detail);
  const { orderNo } = detail;
  useEffect(() => {
    // In an effect: a second run, in strict mode, finds the mark taken.
    if (shown && takeSubmittedFocus(orderNo)) region.current?.focus();
  }, [shown, orderNo]);
  if (!shown) return null;
  return (
    <section
      ref={region}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="grid grid-cols-[1rem_1fr] items-start gap-x-3 gap-y-1 border border-(--info)/30 bg-(--info-surface) px-3.5 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 text-(--info)" />
      <div className="fs-14 min-w-0 space-y-1">
        <h2 id={titleId} className="font-medium text-foreground">
          {t("order.submitted.title")}
        </h2>
        <p className="max-w-prose text-muted-foreground">
          {t("order.submitted.body")}
        </p>
        {mayEdit ? (
          <p className="max-w-prose text-muted-foreground">
            {t("order.submitted.mistake")}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            to="?tab=activity"
            replace
            className="inline-flex items-center rounded-sm text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
            onClick={(event) => {
              // The link only changes the tab in the address; a phone shows the
              // tabs below the status card, so the panel is brought into view.
              event.preventDefault();
              const next = new URLSearchParams(params);
              next.set("tab", "activity");
              setParams(next, { replace: true });
              focusActivityPanel();
            }}
          >
            {t("order.submitted.who")}
          </Link>
          <AuditLink
            entity="Order"
            id={orderNo}
            subject={t("order.submitted.auditSubject", { orderNo })}
            className="pointer-coarse:min-h-11"
          />
        </p>
      </div>
    </section>
  );
}
