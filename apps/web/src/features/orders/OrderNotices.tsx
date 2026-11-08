import { CircleAlert, Info, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/** What the last save learned: a repeated PO number, or a draft that moved on. */
export type OrderNotice =
  | { kind: "duplicate"; orderNo: string; customerNo: string; po: string }
  | { kind: "stale" };

/** Why a page cannot be edited, when it cannot. */
export type ReadOnlyReason = "sample" | "submitted" | "void" | "permission";

interface OrderNoticesProps {
  notice: OrderNotice | null;
  readOnly: ReadOnlyReason | null;
  onReload: () => void;
}

const BOX =
  "flex flex-wrap items-start gap-s2 rounded-md border px-s2 py-s2 text-sm";

/**
 * What the document needs to say before its fields: the order a repeated PO
 * number already belongs to, a draft someone else changed, or why a page is
 * read-only. A field message cannot hold a link, so the duplicate is here.
 */
export function OrderNotices({
  notice,
  readOnly,
  onReload,
}: OrderNoticesProps) {
  const { t } = useTranslation("orders");
  if (!notice && !readOnly) return null;
  return (
    <div className="space-y-s1">
      {notice?.kind === "duplicate" ? (
        <div role="alert" className={BOX}>
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 basis-48 space-y-1">
            <p className="font-medium">{t("form.notices.duplicateTitle")}</p>
            <p className="text-muted-foreground">
              {t("form.notices.duplicateBody", { orderNo: notice.orderNo })}
            </p>
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
      ) : null}
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
