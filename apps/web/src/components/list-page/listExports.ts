import { allPages, rowPages, type ExportOptions } from "@/components/common";
import type { RowPage } from "@/components/common/data-table/useUrlQuery";
import { onePage } from "./printDocument";
import type { LoadPage } from "./types";

/**
 * What Export and Print read. With `loadPage`, Export collects every page and
 * Print streams them one at a time. A screen's own `loadRows` still works,
 * and Print then takes its rows as one page. With neither, both use the rows
 * on screen.
 */
export function exportsOf<Row>(
  fileName: string,
  loadPage: LoadPage<Row> | undefined,
  given: ExportOptions<Row> | undefined,
): {
  exportOptions: ExportOptions<Row>;
  pages: (() => AsyncIterable<RowPage<Row>>) | undefined;
} {
  const exportOptions: ExportOptions<Row> = {
    fileName,
    ...(loadPage ? { loadRows: () => allPages(loadPage) } : {}),
    ...given,
  };
  const { loadRows } = exportOptions;
  const pages = loadPage
    ? () => rowPages(loadPage)
    : loadRows
      ? async function* () {
          yield* onePage(await loadRows());
        }
      : undefined;
  return { exportOptions, pages };
}
