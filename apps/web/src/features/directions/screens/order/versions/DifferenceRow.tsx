import type { LineDifferenceView } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatQuantity } from "@/lib/format";
import { changeText } from "./differenceText";
import { PriceCell } from "./PriceCell";
import { StatusCell } from "./StatusCell";

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
        <StatusCell
          status={line.status}
          moved={line.moved}
          pricesCompared={pricesCompared}
        />
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
