import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { traceIdOf } from "@/lib/api/errors";
import type { PaletteRecords } from "./paletteSearch";

interface PaletteNoticesProps {
  query: string;
  /** True from two characters: the records are being looked up. */
  lookedUp: boolean;
  records: PaletteRecords;
  /** Rows listed, of every kind. */
  count: number;
}

/**
 * What the list cannot say: that it is still looking, that nothing matches,
 * that the search failed. They sit below the list, not in it, because a
 * listbox holds options only. A polite status line tells a screen reader how
 * many results there are, and says nothing while the list is settling.
 */
export function PaletteNotices({
  query,
  lookedUp,
  records,
  count,
}: PaletteNoticesProps) {
  const { t } = useTranslation("common");
  const { searching, failed, error, retry } = records;
  const nothing = lookedUp && !searching && !failed && count === 0;
  const traceId = traceIdOf(error);

  let announced = "";
  if (query && searching) announced = t("palette.searching");
  else if (query && nothing) announced = t("palette.emptyRecords", { query });
  else if (query) announced = t("palette.resultsCount", { count });

  return (
    <>
      <div role="status" className="sr-only">
        {announced}
      </div>
      {query && !lookedUp && count === 0 ? (
        <p className="px-s2 py-s3 text-sm text-muted-foreground">
          {t("palette.empty")}
        </p>
      ) : null}
      {lookedUp && searching && count === 0 ? (
        <p
          aria-hidden="true"
          className="px-s2 py-s3 text-sm text-muted-foreground"
        >
          {t("palette.searching")}
        </p>
      ) : null}
      {nothing ? (
        <p
          aria-hidden="true"
          className="px-s2 py-s3 text-sm text-muted-foreground"
        >
          {t("palette.emptyRecords", { query })}
        </p>
      ) : null}
      {failed ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-s2 border-t px-s2 py-s2 text-sm"
        >
          <span>
            {traceId
              ? t("palette.failedTrace", { traceId })
              : t("palette.failed")}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            {t("palette.retry")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
