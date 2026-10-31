import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizes: readonly number[];
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}

/** Page buttons, the page size, and a spoken "Showing 1 to 10 of 42". */
export function Pagination({
  page,
  pageSize,
  total,
  pageSizes,
  onPage,
  onPageSize,
}: PaginationProps) {
  const { t } = useTranslation("components");
  const sizeId = useId();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-s2 text-sm">
      <p role="status" className="text-muted-foreground" data-numeric>
        {total === 0
          ? t("table.rangeNone")
          : t("table.range", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-s2">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-muted-foreground">
            {t("table.pageSize")}
          </label>
          <select
            id={sizeId}
            value={pageSize}
            onChange={(event) => {
              onPageSize(Number(event.target.value));
            }}
            className="h-8 rounded-md border border-input bg-background px-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("table.previous")}
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span data-numeric>{t("table.page", { page, pages })}</span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("table.next")}
            disabled={page >= pages}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
