import type { SalesOrderDetail } from "@orderpilot/shared";
import { PackageMinus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQuantity } from "@/lib/format";
import { StatusChip } from "@/components/kit/StatusChip";
import { Amount } from "../orders/Amount";

/**
 * The lines of the order as Business Central holds them: item, quantity, what is
 * still to ship, the prices and, where stock falls short, by how much. Prices
 * and amounts are masked for a role that may not see them, each with the
 * reason, and the total is masked with them.
 */
export function LinesTable({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const currency = detail.currencyCode;
  return (
    <ScrollRegion label={t("order.lines.region")} className="od-lines-scroll">
      <Table className="od-table od-lines">
        <caption className="sr-only">{t("order.lines.caption")}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t("order.lines.line")}</TableHead>
            <TableHead scope="col">{t("order.lines.item")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.quantity")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.toShip")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.unitPrice")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.amount")}
            </TableHead>
            <TableHead scope="col">{t("order.lines.stock")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.lines.map((line) => (
            <TableRow key={line.lineNo}>
              <TableCell className="numeral text-muted-foreground">
                {line.lineNo}
              </TableCell>
              <TableCell>
                <span className="od-customer">
                  <span className="od-customer-name">{line.description}</span>
                  <span className="numeral od-customer-no">{line.itemNo}</span>
                </span>
              </TableCell>
              <TableCell className="numeral text-right">
                {formatQuantity(line.quantity)}
              </TableCell>
              <TableCell className="numeral text-right">
                {formatQuantity(line.qtyToShip)}
              </TableCell>
              <TableCell className="text-right">
                <Amount field={line.unitPrice} currency={currency} />
              </TableCell>
              <TableCell className="text-right">
                <Amount field={line.lineAmount} currency={currency} />
              </TableCell>
              <TableCell>
                {line.shortBy ? (
                  <StatusChip kind="warning" icon={PackageMinus}>
                    {t("cells.short", {
                      quantity: formatQuantity(line.shortBy),
                    })}
                  </StatusChip>
                ) : (
                  <span className="text-muted-foreground">
                    {t("cells.covered")}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="text-right font-medium">
              {t("order.lines.total")}
            </TableCell>
            <TableCell className="text-right">
              <Amount field={detail.amount} currency={currency} />
            </TableCell>
            <TableCell />
          </TableRow>
        </tfoot>
      </Table>
    </ScrollRegion>
  );
}
