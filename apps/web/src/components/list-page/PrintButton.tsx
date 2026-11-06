import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "@/components/common";
import type { RowPage } from "@/components/common/data-table/useUrlQuery";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { onePage, printRows, type PrintWords } from "./printDocument";

const WHEN = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

interface PrintButtonProps<Row> {
  label: string;
  title: string;
  filters: readonly string[];
  columns: readonly DataTableColumn<Row>[];
  /** The rows on screen. */
  rows: readonly Row[];
  /** Every row the filter shows, a page at a time. Without it the print holds the rows on screen. */
  pages?: (() => AsyncIterable<RowPage<Row>>) | undefined;
}

/**
 * Print: streams every row the filter shows into a print document of its own,
 * saying how far it has got, then opens the browser's print dialog.
 */
export function PrintButton<Row>({
  label,
  title,
  filters,
  columns,
  rows,
  pages,
}: PrintButtonProps<Row>) {
  const { t } = useTranslation("list-page");
  const { t: tc } = useTranslation("components");
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const running = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      running.current?.abort();
    },
    [],
  );

  async function start() {
    const controller = new AbortController();
    running.current = controller;
    setProgress({ done: 0, total: 0 });
    const words: PrintWords = {
      title,
      filters:
        filters.length > 0
          ? t("print.filters", { filters: filters.join("; ") })
          : t("print.noFilters"),
      printedOn: t("print.printedOn", { when: WHEN.format(new Date()) }),
      demo: tc("badges.synthetic"),
      pageOf: t("print.pageOf", { page: "{{page}}", pages: "{{pages}}" }),
      rows: (count) => t("print.rows", { count }),
    };
    try {
      await printRows({
        words,
        columns: columns.filter((column) => column.exportValue),
        pages: pages ? pages() : onePage(rows),
        signal: controller.signal,
        onProgress: (done, total) => {
          setProgress({ done, total });
        },
      });
    } catch {
      if (!controller.signal.aborted) toast.failed(t("print.failed"));
    } finally {
      if (!controller.signal.aborted) setProgress(undefined);
      running.current = null;
    }
  }

  const preparing = progress
    ? progress.total > 0
      ? t("print.preparingCount", progress)
      : t("print.preparing")
    : "";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="pointer-coarse:h-11"
        aria-disabled={progress ? true : undefined}
        onClick={() => {
          if (!progress) void start();
        }}
      >
        <Printer aria-hidden="true" />
        {progress ? preparing : label}
      </Button>
      <span role="status" className="sr-only">
        {preparing}
      </span>
    </>
  );
}
