import type { CreateSalesOrderBody } from "@orderpilot/shared";
import { CircleAlert, Info, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DuplicateNotice } from "./DuplicateNotice";
import type { usePoRevision } from "./usePoRevision";

/**
 * What the last save learned: a repeated PO number, or a draft that moved on. A
 * repeated PO number keeps the body that was refused and a key of the form, but
 * only a create can become a revision: an update of a draft has no body.
 */
export type OrderNotice =
  | {
      kind: "duplicate";
      orderNo: string;
      customerNo: string;
      po: string;
      fromCreate: boolean;
      body: CreateSalesOrderBody | null;
      formKey: string;
    }
  | { kind: "stale" };

/** Why a page cannot be edited, when it cannot. */
export type ReadOnlyReason = "sample" | "submitted" | "void" | "permission";

interface OrderNoticesProps {
  notice: OrderNotice | null;
  readOnly: ReadOnlyReason | null;
  onReload: () => void;
  /** What the repeated PO number leads to: the state of the order, the offer and the panel. */
  revision: ReturnType<typeof usePoRevision>;
}

const BOX =
  "flex flex-wrap items-start gap-s2 rounded-md border px-s2 py-s2 text-sm";

/**
 * What the document needs to say before its fields: the order a repeated PO
 * number already belongs to, and the panel that adds a revised PO to it, a draft
 * someone else changed, or why a page is read-only.
 */
export function OrderNotices({
  notice,
  readOnly,
  onReload,
  revision,
}: OrderNoticesProps): ReactNode {
  const { t } = useTranslation("orders");
  // The panel of a saved confirmation outlives the notice that opened it.
  if (!notice && !readOnly && !revision.node) return null;
  return (
    <div className="space-y-s1">
      {notice?.kind === "duplicate" ? (
        <DuplicateNotice
          notice={notice}
          existing={revision.existing}
          offer={revision.offer}
          moved={revision.moved}
          mayEdit={revision.mayEdit}
        />
      ) : null}
      {revision.node}
      {notice?.kind === "stale" ? (
        <div role="alert" className={BOX}>
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 basis-48 space-y-1">
            <p className="font-medium">{t("form.notices.staleTitle")}</p>
            <p className="max-w-[70ch] text-muted-foreground">
              {t("form.notices.staleBody")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pointer-coarse:h-11"
            onClick={onReload}
          >
            <RefreshCw aria-hidden="true" />
            {t("form.notices.reload")}
          </Button>
        </div>
      ) : null}
      {readOnly ? (
        <div role="status" className={BOX}>
          <Info
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 basis-48 space-y-1">
            <p className="font-medium">{t("form.notices.readOnlyTitle")}</p>
            <p className="max-w-[70ch] text-muted-foreground">
              {t(`form.notices.readOnly.${readOnly}`)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
