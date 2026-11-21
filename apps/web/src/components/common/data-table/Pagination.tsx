import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { clampPage, pageCount } from "@/lib/paging";
import { NativeSelect } from "./Field";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizes: readonly number[];
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
  /** Says nothing about the count: the rows have not arrived, or could not. */
  quiet?: boolean;
}

/** Page buttons, the page size, and a spoken "Showing 1 to 10 of 42". */
export function Pagination({
  page,
  pageSize,
  total,
  pageSizes,
  onPage,
  onPageSize,
  quiet = false,
}: PaginationProps) {
  const { t } = useTranslation("components");
  const sizeId = useId();
  const pages = pageCount(total, pageSize);
  // A page past the end is shown as the last one: the screens open that page,
  // and until they do this never says "Page 99 of 5" or a range that ends
  // before it starts.
  const shown = clampPage(page, total, pageSize);
  const from = total === 0 ? 0 : (shown - 1) * pageSize + 1;
  const to = Math.min(total, shown * pageSize);

  return (
    <div className="dt-foot">
      <p role="status" className="text-muted-foreground" data-numeric>
        {quiet
          ? ""
          : total === 0
            ? t("table.rangeNone")
            : t("table.range", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-s2">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-muted-foreground">
            {t("table.pageSize")}
          </label>
          <NativeSelect
            compact
            id={sizeId}
            value={pageSize}
            onChange={(event) => {
              onPageSize(Number(event.target.value));
            }}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label={t("table.previous")}
            disabled={shown <= 1}
            onClick={() => {
              onPage(shown - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span data-numeric>{t("table.page", { page: shown, pages })}</span>
          <Button
            variant="outline"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label={t("table.next")}
            disabled={shown >= pages}
            onClick={() => {
              onPage(shown + 1);
            }}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
