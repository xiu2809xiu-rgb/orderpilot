import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorPanel, PermissionDenied } from "../states";
import { usePrimaryActionStore } from "../primaryAction";
import { cellClass } from "./cells";
import { alignsEnd, type DataTableColumn } from "./types";

export type TableStatus = "ready" | "loading" | "error" | "forbidden";

interface DataTableBodyProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  status: TableStatus;
  pageSize: number;
  error?: unknown;
  onRetry?: () => void;
  /** Shown when the table is empty and no search or filter is set. */
  empty?: { title?: string; description?: string; action?: ReactNode };
  filtered: boolean;
  onClearFilters: () => void;
}

/** One cell-wide row that holds a state message in place of the data. */
function StateRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={span} className="p-s3">
        {children}
      </TableCell>
    </TableRow>
  );
}

/**
 * The rows, or the state that stands in for them. Placeholder rows do not
 * pulse: tables are never animated while in use.
 */
export function DataTableBody<Row>({
  columns,
  rows,
  rowKey,
  status,
  pageSize,
  error,
  onRetry,
  empty,
  filtered,
  onClearFilters,
}: DataTableBodyProps<Row>) {
  const { t } = useTranslation("components");
  const span = Math.max(1, columns.length);
  // An empty list offers its page's primary action ("New order") as the next step.
  const primary = usePrimaryActionStore((state) => state.current);
  const PrimaryIcon = primary?.icon ?? Plus;
  const primaryButton =
    primary && !primary.disabled ? (
      <Button onClick={primary.run}>
        <PrimaryIcon aria-hidden="true" />
        {primary.label}
      </Button>
    ) : undefined;

  if (status === "loading") {
    return (
      <TableBody>
        {Array.from({ length: Math.min(pageSize, 8) }, (_, index) => (
          <TableRow key={index} className="group/row hover:bg-transparent">
            {columns.map((column, position) => (
              <TableCell
                key={column.id}
                className={cellClass(column, position === 0)}
              >
                <Skeleton
                  className={`h-5 animate-none ${alignsEnd(column) ? "ml-auto w-16" : "w-3/4"}`}
                  aria-hidden="true"
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  }
  if (status === "error") {
    return (
      <TableBody>
        <StateRow span={span}>
          <ErrorPanel error={error} onRetry={onRetry} />
        </StateRow>
      </TableBody>
    );
  }
  if (status === "forbidden") {
    return (
      <TableBody>
        <StateRow span={span}>
          <PermissionDenied />
        </StateRow>
      </TableBody>
    );
  }
  if (rows.length === 0) {
    return (
      <TableBody>
        <StateRow span={span}>
          {filtered ? (
            <EmptyState
              title={t("states.noMatchesTitle")}
              description={t("states.noMatchesDescription")}
              action={
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-sm text-primary underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t("states.clearFilters")}
                </button>
              }
            />
          ) : (
            <EmptyState {...empty} action={empty?.action ?? primaryButton} />
          )}
        </StateRow>
      </TableBody>
    );
  }
  return (
    <TableBody>
      {rows.map((row) => (
        <TableRow key={rowKey(row)} className="group/row hover:bg-muted">
          {columns.map((column, position) => (
            <TableCell
              key={column.id}
              className={cellClass(column, position === 0)}
              data-numeric={alignsEnd(column) ? "" : undefined}
            >
              {column.cell(row)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
