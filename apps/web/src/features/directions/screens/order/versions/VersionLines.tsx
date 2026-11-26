import { useTranslation } from "react-i18next";
import { ErrorPanel, ScrollRegion } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatQuantity } from "@/lib/format";
import { usePoVersionsOne } from "@/lib/api/generated/endpoints/orders/orders";
import { Amount } from "../../orders/Amount";
import { VersionsLoading } from "./VersionsLoading";

/**
 * The lines of one PO version, read when a person opens it. A superseded
 * version stays readable as it was, with the prices masked for a role that may
 * not see them, each with the reason.
 */
export function VersionLines({
  orderNo,
  poVersionNo,
  currency,
}: {
  orderNo: string;
  poVersionNo: number;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  const version = usePoVersionsOne(orderNo, poVersionNo);
  if (version.isPending) {
    return (
      <VersionsLoading label={t("order.versions.linesLoading")} height="h-16" />
    );
  }
  if (version.isError) {
    return (
      <ErrorPanel
        error={version.error}
        onRetry={() => {
          void version.refetch();
        }}
      />
    );
  }
  return (
    <ScrollRegion label={t("order.versions.viewLabel", { n: poVersionNo })}>
      <Table className="od-table od-lines">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t("order.lines.line")}</TableHead>
            <TableHead scope="col">{t("order.lines.item")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.quantity")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.unitPrice")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("order.lines.amount")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {version.data.data.lines.map((line) => (
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
              <TableCell className="text-right">
                <Amount field={line.unitPrice} currency={currency} />
              </TableCell>
              <TableCell className="text-right">
                <Amount field={line.lineAmount} currency={currency} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollRegion>
  );
}
