import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { formatDay, formatMoney } from "@/lib/format";
import { KitSection } from "./KitSection";

/** The five latest orders from the tracker, with its loading, empty and error states. */
export function TableSection() {
  const { t } = useTranslation("directions-kit");
  const list = useTrackerList({ pageSize: 5 });
  const rows = list.data?.data ?? [];
  return (
    <KitSection title={t("sections.table")} className="lg:col-span-2">
      {list.isPending ? (
        <div
          className="space-y-2"
          role="status"
          aria-label={t("table.caption")}
        >
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-9" />
          ))}
        </div>
      ) : list.isError ? (
        <div className="fs-14 flex items-center gap-3" role="alert">
          <span>{t("table.error")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void list.refetch();
            }}
          >
            <RotateCw aria-hidden="true" />
            {t("table.retry")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="fs-14 text-muted-foreground">{t("table.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="fs-12 pb-2 text-left text-muted-foreground">
              {t("table.caption")}. {t("table.synthetic")}.
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead className="fs-12">{t("table.order")}</TableHead>
                <TableHead className="fs-12">{t("table.customer")}</TableHead>
                <TableHead className="fs-12">{t("table.stage")}</TableHead>
                <TableHead className="fs-12 text-right">
                  {t("table.ship")}
                </TableHead>
                <TableHead className="fs-12 text-right">
                  {t("table.value")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.orderNo}>
                  <TableCell className="fs-14 numeral">{row.orderNo}</TableCell>
                  <TableCell className="fs-14">{row.customerName}</TableCell>
                  <TableCell className="fs-14">{row.status.label}</TableCell>
                  <TableCell className="fs-14 numeral text-right">
                    {row.shipmentDate
                      ? formatDay(row.shipmentDate)
                      : t("table.noDate")}
                  </TableCell>
                  <TableCell className="fs-14 numeral text-right">
                    {row.amount
                      ? formatMoney(row.amount, row.currencyCode)
                      : t("table.hidden")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </KitSection>
  );
}
