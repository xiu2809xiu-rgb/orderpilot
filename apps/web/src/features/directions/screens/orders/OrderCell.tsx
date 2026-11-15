import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Badge } from "@/components/kit/Badge";
import { EntryChip } from "./EntryChip";
import type { OrderRow } from "./orderRow";

/**
 * The order's number, as a link to its page, with the count of open
 * exceptions beside it and, for an order entered here, its entry state. A
 * sample carries no tag: nearly every order is one, and the Source column and
 * filter say so for anyone who needs it. The number is never cut: a long one
 * (an order entered here is numbered by its date) keeps the first line, and
 * its chips move under it.
 */
export function OrderCell({ row, href }: { row: OrderRow; href: string }) {
  const { t } = useTranslation("directions-orders");
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        to={href}
        className="numeral text-foreground underline-offset-4 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
        <EntryChip state={row.captureState} />
      ) : null}
    </span>
  );
}
