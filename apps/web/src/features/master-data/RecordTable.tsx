import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ScrollRegion, type ColumnKind } from "@/components/common";
import { cellClass, headClass } from "@/components/common/data-table/cells";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import "./record.css";

export interface RecordColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  kind?: ColumnKind;
  /** Lets a sentence wrap instead of pushing the table wider than its card. */
  wrap?: boolean;
}

interface RecordTableProps<Row> {
  caption: string;
  columns: readonly RecordColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Says why there are no rows, and what that means. */
  emptyText: string;
}

/**
 * A short list inside a record's page, with the same dense cells as the data
 * table but no toolbar: everything it has is on screen. It scrolls inside its
 * own box on a narrow screen, with the first column kept in view.
 */
export function RecordTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  emptyText,
}: RecordTableProps<Row>) {
  const { t } = useTranslation("master-data");
  const captionId = useId();
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ScrollRegion label={t("table.scroll", { name: caption })}>
      <Table aria-labelledby={captionId} className="rec-table">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column, position) => (
              <TableHead
                key={column.id}
                className={headClass(column, position === 0)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className="group/row hover:bg-transparent"
            >
              {columns.map((column, position) => (
                <TableCell
                  key={column.id}
                  className={cellClass(column, position === 0)}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollRegion>
  );
}
