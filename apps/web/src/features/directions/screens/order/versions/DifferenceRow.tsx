import type { LineDifferenceView, PriceDifference } from "@orderpilot/shared";
import { Minus, PenLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { StatusChip } from "@/components/kit/StatusChip";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatMoney, formatQuantity } from "@/lib/format";
import { changeText } from "./differenceText";

/** A unit price or a total: a mask with the role's reason, or the figure and its change. */
export function PriceCell({
  price,
  currency,
}: {
  price: PriceDifference;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  if (price.masked) {
    return <MaskedValue masked reason={t(`mask.${price.reason}`)} />;
  }
  return (
    <span className="numeral">
      {changeText(t, price, (value) => formatMoney(value, currency))}
    </span>
  );
}

/** The chip of a line's status: a word and an icon, and quiet when nothing changed. */
function StatusCell({
  status,
  pricesCompared,
}: {
  status: LineDifferenceView["status"];
  pricesCompared: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  if (status === "added") {
    return (
      <StatusChip kind="success" icon={Plus}>
        {t("order.versions.status.added")}
      </StatusChip>
    );
  }
  if (status === "removed") {
    return (
      <StatusChip kind="destructive" icon={Minus}>
        {t("order.versions.status.removed")}
      </StatusChip>
    );
  }
  if (status === "changed") {
    return (
      <StatusChip kind="warning" icon={PenLine}>
        {t("order.versions.status.changed")}
      </StatusChip>
    );
  }
  return (
    <Badge variant="outline" radius="full" className="text-muted-foreground">
      {t(
        pricesCompared
          ? "order.versions.status.unchanged"
          : "order.versions.status.unchangedMasked",
      )}
    </Badge>
  );
}

/**
 * One line of the differences: the item, its status, and the quantity and the
 * price as "from to to". A change also carries its full phrase for a screen
 * reader, and a line that only moved says where from and to.
 */
export function DifferenceRow({
  line,
  currency,
  pricesCompared,
}: {
  line: LineDifferenceView;
  currency: string;
  pricesCompared: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const quantity = changeText(t, line.quantity, formatQuantity);
  const quantityFull =
    line.quantity.changed &&
    line.quantity.from !== null &&
    line.quantity.to !== null
      ? t("order.versions.changedFull", {
          what: t("order.versions.col.quantity"),
          from: formatQuantity(line.quantity.from),
          to: formatQuantity(line.quantity.to),
        })
      : null;
  return (
    <TableRow>
      <TableCell>
        <span className="od-customer">
          <span className="od-customer-name">{line.description}</span>
          <span className="numeral od-customer-no">{line.itemNo}</span>
        </span>
        {line.moved ? (
          <span className="fs-12 block text-muted-foreground">
            {t("order.versions.moved", {
              from: line.fromLineNo,
              to: line.toLineNo,
            })}
          </span>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusCell status={line.status} pricesCompared={pricesCompared} />
      </TableCell>
      <TableCell className="text-right">
        <span className="numeral" aria-hidden={quantityFull ? true : undefined}>
          {quantity}
        </span>
        {quantityFull ? <span className="sr-only">{quantityFull}</span> : null}
      </TableCell>
      <TableCell className="text-right">
        <PriceCell price={line.unitPrice} currency={currency} />
      </TableCell>
    </TableRow>
  );
}
