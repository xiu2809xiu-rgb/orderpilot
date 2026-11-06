import {
  alignsEnd,
  type DataTableColumn,
} from "@/components/common/data-table/types";
import type { RowPage } from "@/components/common/data-table/useUrlQuery";

/** The words a printed list needs, already translated. */
export interface PrintWords {
  title: string;
  /** "Filters: Brand: Quillon", or "Filters: none". */
  filters: string;
  /** "Printed 5 Nov 2026, 10:04 am". */
  printedOn: string;
  /** "Synthetic demo data". */
  demo: string;
  /** "{{page}}" and "{{pages}}" mark where the numbers go: "Page {{page}} of {{pages}}". */
  pageOf: string;
  /** "1 row", "4,800 rows". */
  rows: (count: number) => string;
}

export interface PrintJob<Row> {
  words: PrintWords;
  /** The columns on screen that have an export value. */
  columns: readonly DataTableColumn<Row>[];
  /** The rows, a page at a time, as they arrive. */
  pages: AsyncIterable<RowPage<Row>>;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** The browser's print dialog for a frame. A seam, so a test can watch it. */
export const printer = {
  print(frame: Window): void {
    frame.focus();
    frame.print();
  },
};

/** A text as a CSS string: the page counter's words are translated, so they are quoted. */
function cssString(text: string): string {
  return `"${text.replace(/["\\]/g, "\\$&").replace(/\n/g, "\\a ")}"`;
}

/** "Page {{page}} of {{pages}}" as the content of a page margin box. */
export function pageCounter(template: string): string {
  return template
    .split(/(\{\{page\}\}|\{\{pages\}\})/)
    .filter((part) => part !== "")
    .map((part) =>
      part === "{{page}}"
        ? "counter(page)"
        : part === "{{pages}}"
          ? "counter(pages)"
          : cssString(part),
    )
    .join(" ");
}

function styles(words: PrintWords): string {
  return `
@page { margin: 14mm 12mm 16mm; @bottom-right { content: ${pageCounter(words.pageOf)}; font: 8pt system-ui, sans-serif; } }
html { background: #fff; color: #000; font: 8.5pt/1.35 system-ui, sans-serif; }
body { margin: 0; }
p { margin: 0 0 3pt; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 0.75pt solid #000; padding: 2pt 4pt; text-align: left; vertical-align: top; }
th { font-weight: 600; }
td[data-end] { text-align: right; font-variant-numeric: tabular-nums; }
th.title { border: 0; border-bottom: 1.5pt solid #000; padding: 0 0 3pt; font-size: 11pt; }
th.title span { float: right; font-size: 8pt; }
`;
}

/** The document's head and the table's frame: the title row repeats on every printed page. */
function frame<Row>(
  doc: Document,
  job: PrintJob<Row>,
): HTMLTableSectionElement {
  const { words, columns } = job;
  doc.documentElement.lang = "en";
  doc.title = words.title;
  const style = doc.createElement("style");
  style.textContent = styles(words);
  doc.head.append(style);

  const filters = doc.createElement("p");
  filters.textContent = words.filters;
  const printed = doc.createElement("p");
  printed.dataset.printed = "";
  printed.textContent = words.printedOn;

  const table = doc.createElement("table");
  const head = table.createTHead();
  const title = doc.createElement("th");
  title.className = "title";
  title.colSpan = Math.max(1, columns.length);
  title.scope = "colgroup";
  title.textContent = words.title;
  const demo = doc.createElement("span");
  demo.textContent = words.demo;
  title.append(demo);
  head.insertRow().append(title);
  const names = head.insertRow();
  for (const column of columns) {
    const cell = doc.createElement("th");
    cell.scope = "col";
    cell.textContent = column.header;
    names.append(cell);
  }
  doc.body.append(filters, printed, table);
  return table.createTBody();
}

/** One page of rows, as text only: nothing a row holds is read as markup. */
function append<Row>(
  doc: Document,
  body: HTMLTableSectionElement,
  columns: readonly DataTableColumn<Row>[],
  rows: readonly Row[],
): void {
  const fragment = doc.createDocumentFragment();
  for (const row of rows) {
    const line = doc.createElement("tr");
    for (const column of columns) {
      const cell = doc.createElement("td");
      if (alignsEnd(column)) cell.dataset.end = "";
      cell.textContent = String(column.exportValue?.(row) ?? "");
      line.append(cell);
    }
    fragment.append(line);
  }
  body.append(fragment);
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
const nextFrame = () => wait(0);

/** If the frame never says its dialog closed, it is removed after this. */
const LAST_CHANCE_MS = 60_000;

/** The rows a screen has whole (the page on screen, or all it loaded) as one streamed page. */
export async function* onePage<Row>(
  rows: readonly Row[],
): AsyncGenerator<RowPage<Row>> {
  await Promise.resolve();
  yield { rows, total: rows.length };
}

/**
 * Prints a list from a hidden frame of its own, never from the app's page: the
 * rows are written into the frame a page at a time as they arrive, so the
 * app's page and its memory never hold the whole list, and the app stays
 * responsive while a long list is prepared. The frame's table repeats its title
 * row on every printed page, and each page's margin carries its number. The
 * frame is removed when the print dialog closes.
 */
export async function printRows<Row>(job: PrintJob<Row>): Promise<void> {
  const holder = document.createElement("iframe");
  holder.title = job.words.title;
  holder.tabIndex = -1;
  holder.setAttribute("aria-hidden", "true");
  holder.className = "fixed right-0 bottom-0 size-0 border-0";
  document.body.append(holder);
  try {
    const win = holder.contentWindow;
    const doc = holder.contentDocument;
    if (!win || !doc) throw new Error("The print frame did not open");
    const body = frame(doc, job);
    let done = 0;
    let total = 0;
    for await (const page of job.pages) {
      job.signal?.throwIfAborted();
      append(doc, body, job.columns, page.rows);
      done += page.rows.length;
      total = Math.max(page.total, done);
      job.onProgress?.(done, total);
      await nextFrame();
    }
    job.signal?.throwIfAborted();
    const printed = doc.querySelector("[data-printed]");
    if (printed) {
      printed.textContent = `${job.words.printedOn} - ${job.words.rows(done)}`;
    }
    const closed = new Promise<void>((resolve) => {
      win.addEventListener("afterprint", () => {
        resolve();
      });
    });
    printer.print(win);
    // Chrome waits in print() until its dialog closes. A browser whose dialog
    // does not wait has copied the document by now, so the frame can go.
    await Promise.race([closed, wait(LAST_CHANCE_MS)]);
  } finally {
    holder.remove();
  }
}
