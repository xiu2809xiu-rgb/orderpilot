import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toCsv } from "./export/csv";
import { CSV_MIME, XLSX_MIME, downloadFile } from "./export/download";
import type { DataTableColumn } from "./types";

// A byte order mark makes Excel read the CSV as UTF-8.
const BOM = String.fromCodePoint(0xfeff);

export interface ExportOptions<Row> {
  /** Without extension, for example "orders". */
  fileName: string;
  /**
   * Fetches every row that matches the current view. Without it, an export
   * holds the rows on screen, and the menu says so.
   */
  loadRows?: () => Promise<readonly Row[]>;
}

interface ExportMenuProps<Row> extends ExportOptions<Row> {
  columns: readonly DataTableColumn<Row>[];
  /** The rows on this page. */
  rows: readonly Row[];
}

/** CSV and Excel export of the shown columns. Excel's library loads on first use. */
export function ExportMenu<Row>({
  columns,
  rows,
  fileName,
  loadRows,
}: ExportMenuProps<Row>) {
  const { t } = useTranslation("components");
  const [message, setMessage] = useState("");

  async function run(format: "csv" | "xlsx") {
    setMessage(t("table.exporting"));
    try {
      const data = loadRows ? await loadRows() : rows;
      if (format === "csv") {
        downloadFile(
          `${fileName}.csv`,
          `${BOM}${toCsv(columns, data)}`,
          CSV_MIME,
        );
      } else {
        const { toXlsx } = await import("./export/excel");
        downloadFile(
          `${fileName}.xlsx`,
          await toXlsx(columns, data, fileName),
          XLSX_MIME,
        );
      }
      setMessage(t("table.exportDone"));
    } catch {
      setMessage(t("table.exportFailed"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download aria-hidden="true" />
            {t("table.export")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {loadRows ? null : (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("table.exportPageNote")}
            </DropdownMenuLabel>
          )}
          <DropdownMenuItem
            onSelect={() => {
              void run("csv");
            }}
          >
            {t("table.exportCsv")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void run("xlsx");
            }}
          >
            {t("table.exportExcel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
