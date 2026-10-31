import { useTranslation } from "react-i18next";
import type { Kpi } from "@orderpilot/shared";
import { ScrollRegion } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The five measures as a table: the full alternative to the charts. */
export function KpiTable({ measures }: { measures: readonly Kpi[] }) {
  const { t } = useTranslation("insights");
  return (
    <ScrollRegion label={t("kpi.tableCaption")}>
      <Table>
        <caption className="sr-only">{t("kpi.tableCaption")}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t("kpi.colMeasure")}</TableHead>
            <TableHead scope="col">{t("kpi.colUnit")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("kpi.manual")}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {t("kpi.withOrderPilot")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {measures.map((kpi) => (
            <TableRow key={kpi.id}>
              <TableCell className="font-medium">{kpi.label}</TableCell>
              <TableCell>{kpi.unit}</TableCell>
              <TableCell className="text-right tabular-nums">
                {kpi.manual}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {kpi.withOrderPilot}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollRegion>
  );
}
