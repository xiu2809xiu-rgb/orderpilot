import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "@/components/common";

const WHEN = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

interface PrintViewProps<Row> {
  title: string;
  /** The applied filters in words, as the chips show them. */
  filters: readonly string[];
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** Called when the print dialog closes. */
  onDone: () => void;
}

/**
 * The page as paper wants it: the title, the filters, the date, the demo label
 * and every row the filter shows, in the columns on screen. It sits beside the
 * app in the document, hidden on screen, and the print stylesheet hides the
 * app instead (styles/index.css). It opens the browser's print dialog once.
 */
export function PrintView<Row>({
  title,
  filters,
  columns,
  rows,
  onDone,
}: PrintViewProps<Row>) {
  const { t } = useTranslation("list-page");
  const { t: tc } = useTranslation("components");
  const printable = columns.filter((column) => column.exportValue);

  useEffect(() => {
    window.addEventListener("afterprint", onDone, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", onDone);
    };
  }, [onDone]);

  return createPortal(
    <div
      data-print-view=""
      className="hidden bg-white p-0 text-xs text-black print:block"
    >
      <header className="mb-3 space-y-1 border-b border-black pb-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p>
          {filters.length > 0
            ? t("print.filters", { filters: filters.join("; ") })
            : t("print.noFilters")}
        </p>
        <p>
          {t("print.printedOn", { when: WHEN.format(new Date()) })}
          {" - "}
          {t("print.rows", { count: rows.length })}
          {" - "}
          <strong>{tc("badges.synthetic")}</strong>
        </p>
      </header>
      <table className="w-full border-collapse">
        <thead className="table-header-group">
          <tr>
            {printable.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="border border-black px-1.5 py-1 text-left font-semibold"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="break-inside-avoid">
              {printable.map((column) => (
                <td key={column.id} className="border border-black px-1.5 py-1">
                  {String(column.exportValue?.(row) ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
