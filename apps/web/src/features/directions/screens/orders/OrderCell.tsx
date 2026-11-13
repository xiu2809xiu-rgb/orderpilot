import { Ban, FileCheck, FilePen, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Badge } from "@/components/kit/Badge";
import { StatusChip } from "@/components/kit/StatusChip";
import type { OrderRow } from "./orderRow";

const ENTRY_ICON = { draft: FilePen, submitted: FileCheck, void: Ban } as const;

/**
 * The order's number, as a link to its page, with the count of open
 * exceptions beside it and, for an order entered here, its entry state. A
 * sample carries no tag: nearly every order is one, and the Source column and
 * filter say so for anyone who needs it.
 */
export function OrderCell({ row, href }: { row: OrderRow; href: string }) {
  const { t } = useTranslation("directions-orders");
  return (
    <span className="inline-flex items-center gap-2">
      <Link
        to={href}
        className="numeral text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {row.orderNo}
      </Link>
      {row.openExceptions > 0 ? (
        <Badge
          variant="destructive"
          size="sm"
          aria-label={t("cells.exceptions", { count: row.openExceptions })}
        >
          <TriangleAlert aria-hidden="true" />
          {row.openExceptions}
        </Badge>
      ) : null}
      {row.source === "stored" && row.captureState ? (
        <StatusChip kind="info" icon={ENTRY_ICON[row.captureState]}>
          {t(`entry.${row.captureState}`)}
        </StatusChip>
      ) : null}
    </span>
  );
}
