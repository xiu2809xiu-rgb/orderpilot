import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import type { OrderNotice } from "./OrderNotices";
import type { RevisionOffer } from "./usePoRevision";
import type { ExistingOrder } from "./useExistingOrder";

type Duplicate = Extract<OrderNotice, { kind: "duplicate" }>;

const BOX =
  "flex flex-wrap items-start gap-s2 rounded-md border px-s2 py-s2 text-sm";

/**
 * The sentence that says what the order a repeated PO number belongs to is, and
 * what can be done with it. Only a refused create reads the order, so a draft
 * edited onto another order's PO number has none. Once the form changes after
 * the refusal, the sentences about a submitted order go: they were about the
 * body that was refused.
 */
function stateSentence(
  t: (key: string, values?: Record<string, unknown>) => string,
  notice: Duplicate,
  existing: ExistingOrder | null,
  moved: boolean,
  mayEdit: boolean,
): string | null {
  if (!notice.fromCreate || existing === null) return null;
  const { orderNo } = notice;
  switch (existing.kind) {
    case "reading":
      return moved ? null : t("form.notices.duplicateReading", { orderNo });
    case "draft":
      return t("form.notices.duplicateDraft", { orderNo });
    case "void":
      return t("form.notices.duplicateVoid", { orderNo });
    case "unknown":
      return t("form.notices.duplicateUnknown", { orderNo });
    case "submitted":
      if (moved) return null;
      return mayEdit
        ? t("form.notices.duplicateSubmitted", {
            orderNo,
            orderDate: existing.orderDate ? formatDay(existing.orderDate) : "",
            count: existing.lineCount,
            current: existing.current,
            next: existing.next,
          })
        : t("form.notices.duplicateSubmittedRead", { orderNo });
  }
}

/**
 * A repeated PO number: the order it already belongs to, with a link, and what
 * can be done. The title and the fixed body are the alert; the state sentence is
 * its own polite status, so that it changing from "reading" to "ready" is not
 * announced as a second alert. A field message cannot hold a link, so the
 * notice does.
 */
export function DuplicateNotice({
  notice,
  existing,
  offer,
  moved,
  mayEdit,
}: {
  notice: Duplicate;
  existing: ExistingOrder | null;
  offer: RevisionOffer | null;
  moved: boolean;
  mayEdit: boolean;
}) {
  const { t } = useTranslation("orders");
  const sentence = stateSentence(t, notice, existing, moved, mayEdit);
  return (
    <div className={BOX}>
      <CircleAlert
        className="mt-0.5 size-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 basis-48 space-y-s1">
        <div role="alert" className="space-y-1">
          <p className="font-medium">{t("form.notices.duplicateTitle")}</p>
          <p className="text-muted-foreground">
            {t("form.notices.duplicateBody", { orderNo: notice.orderNo })}
          </p>
        </div>
        <p
          role="status"
          aria-busy={existing?.kind === "reading"}
          className="max-w-[70ch] text-muted-foreground"
        >
          {sentence}
        </p>
        {offer ? (
          <Button
            ref={offer.buttonRef}
            type="button"
            variant="outline"
            size="sm"
            className="pointer-coarse:h-11"
            aria-expanded={offer.expanded}
            onClick={offer.onOpen}
          >
            {t("form.notices.duplicateRevise", { orderNo: notice.orderNo })}
          </Button>
        ) : null}
      </div>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="pointer-coarse:h-11"
      >
        <Link to={`/orders/${notice.orderNo}`}>
          {t("form.notices.duplicateOpen", { orderNo: notice.orderNo })}
        </Link>
      </Button>
    </div>
  );
}
