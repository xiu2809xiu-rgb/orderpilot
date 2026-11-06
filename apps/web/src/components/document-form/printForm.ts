import { printer } from "@/components/list-page/printDocument";
import type { DocumentPrint } from "./types";

/** The words a printed form needs besides its own: already translated. */
export interface PrintFormWords {
  /** "Synthetic demo data". */
  demo: string;
  /** "Printed 5 Nov 2026, 10:04 am". */
  printedOn: string;
}

const STYLES = `
@page { margin: 14mm 12mm 16mm; }
html { background: #fff; color: #000; font: 9pt/1.4 system-ui, sans-serif; }
body { margin: 0; }
h1 { font-size: 13pt; margin: 0 0 2pt; }
p { margin: 0 0 6pt; font-size: 8pt; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2pt 10pt; margin: 8pt 0; }
dt { font-weight: 600; }
dd { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 0.75pt solid #000; padding: 2pt 4pt; text-align: left; vertical-align: top; }
th { font-weight: 600; }
`;

function list(
  doc: Document,
  entries: readonly { label: string; value: string }[],
): HTMLElement {
  const dl = doc.createElement("dl");
  for (const entry of entries) {
    const dt = doc.createElement("dt");
    dt.textContent = entry.label;
    const dd = doc.createElement("dd");
    dd.textContent = entry.value;
    dl.append(dt, dd);
  }
  return dl;
}

function table(
  doc: Document,
  lines: NonNullable<DocumentPrint["lines"]>,
): HTMLElement {
  const element = doc.createElement("table");
  const head = element.createTHead().insertRow();
  for (const column of lines.columns) {
    const cell = doc.createElement("th");
    cell.scope = "col";
    cell.textContent = column;
    head.append(cell);
  }
  const body = element.createTBody();
  for (const row of lines.rows) {
    const line = body.insertRow();
    for (const value of row) line.insertCell().textContent = value;
  }
  return element;
}

/** The wait before a browser that does not hold print() open loses the frame. */
const LAST_CHANCE_MS = 60_000;

/**
 * The browser's print view for one document, written as text only from a
 * hidden frame of its own, so the app's page, its menus and its tabs never
 * print. Until generated documents arrive (B-3) this is the Print or PDF of
 * a form: the print dialog offers "Save as PDF". The frame goes when the
 * dialog closes.
 */
export async function printForm(
  spec: DocumentPrint,
  words: PrintFormWords,
): Promise<void> {
  const holder = document.createElement("iframe");
  holder.title = spec.title;
  holder.tabIndex = -1;
  holder.setAttribute("aria-hidden", "true");
  holder.className = "fixed right-0 bottom-0 size-0 border-0";
  document.body.append(holder);
  try {
    const win = holder.contentWindow;
    const doc = holder.contentDocument;
    if (!win || !doc) throw new Error("The print frame did not open");
    doc.documentElement.lang = "en";
    doc.title = spec.title;
    const style = doc.createElement("style");
    style.textContent = STYLES;
    doc.head.append(style);
    const heading = doc.createElement("h1");
    heading.textContent = spec.title;
    const note = doc.createElement("p");
    note.textContent = `${words.demo} - ${words.printedOn}`;
    doc.body.append(heading, note, list(doc, spec.fields));
    if (spec.lines) doc.body.append(table(doc, spec.lines));
    if (spec.totals) doc.body.append(list(doc, spec.totals));
    const closed = new Promise<void>((resolve) => {
      win.addEventListener("afterprint", () => {
        resolve();
      });
    });
    printer.print(win);
    await Promise.race([
      closed,
      new Promise<void>((resolve) => setTimeout(resolve, LAST_CHANCE_MS)),
    ]);
  } finally {
    holder.remove();
  }
}
