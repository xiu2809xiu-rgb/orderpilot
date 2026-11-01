import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import { Canvas, PAGE, type DrawOp } from "./canvas.js";
import {
  placeFields,
  uncertainIds,
  type ConfidencePlan,
} from "./confidence.js";
import { buildFacts, type DocumentFacts } from "./facts.js";
import { allSpecs, fieldsOf } from "./fields.js";
import { LAYOUTS } from "./layouts/index.js";
import {
  DEMO_LABEL,
  fieldId,
  type DocumentKind,
  type LayoutId,
  type PlacedField,
} from "./model.js";
import { writeTextPdf, type PdfMeta } from "./pdf.js";
import { scanPages } from "./scan.js";

export interface RenderOptions {
  /** Make it look like a photocopy: an image of the page, tilted, grey and speckled. */
  scanned?: boolean;
}

export interface RenderedDocument {
  kind: DocumentKind;
  layout: LayoutId;
  scanned: boolean;
  pageCount: number;
  bytes: Uint8Array;
  fields: PlacedField[];
  facts: DocumentFacts;
}

const TITLES: Record<DocumentKind, string> = {
  CUSTOMER_PO: "Customer purchase order",
  PROFORMA_INVOICE: "Proforma invoice",
  PACKING_LIST: "Packing list",
  SALES_INVOICE: "Commercial invoice",
};

/** Every page says what it is, however it is cut out of the file. */
function stamp(pages: DrawOp[][]): void {
  pages.forEach((ops, i) => {
    const y = PAGE.height - 24;
    const style = { font: "sans", size: 7, color: [0.4, 0.4, 0.42] } as const;
    ops.push(
      {
        kind: "line",
        from: [36, y - 10],
        to: [PAGE.width - 36, y - 10],
        color: [0.8, 0.8, 0.82],
        lineWidth: 0.4,
      },
      {
        kind: "text",
        ...style,
        x: 36,
        y,
        text: `${DEMO_LABEL}. Fictional companies, prices in USD, demo bank details. Not a real document.`,
      },
      {
        kind: "text",
        ...style,
        x: PAGE.width - 36 - 38,
        y,
        text: `Page ${String(i + 1)} of ${String(pages.length)}`,
      },
    );
  });
}

/**
 * Renders one order's document of one kind to a real PDF, and says where each
 * field sits. Pure: the same inputs give the same bytes, on any day.
 */
export async function renderDocument(
  dataset: SyntheticDataset,
  orderNo: string,
  kind: DocumentKind,
  options: RenderOptions = {},
): Promise<RenderedDocument> {
  const scanned = options.scanned ?? false;
  const facts = buildFacts(dataset, orderNo, kind);
  const fields = fieldsOf(facts);
  const canvas = new Canvas();
  LAYOUTS[facts.layout](canvas, facts, fields);

  const missing = allSpecs(fields)
    .map((s) => fieldId(s.key, s.lineIndex))
    .filter(
      (id) => !canvas.fields.some((f) => fieldId(f.key, f.lineIndex) === id),
    );
  if (missing.length > 0) {
    throw new Error(
      `The ${facts.layout} layout left out ${missing.join(", ")}`,
    );
  }
  stamp(canvas.pages);

  const meta: PdfMeta = {
    title: `${TITLES[kind]} ${facts.number}`,
    subject: `${DEMO_LABEL}. ${TITLES[kind]} for ${orderNo}.`,
    keywords: [DEMO_LABEL, kind, orderNo],
  };
  const plan: ConfidencePlan = {
    orderNo,
    kind,
    uncertain: uncertainIds(dataset, orderNo, kind),
    scanned,
  };
  if (scanned) {
    const scan = await scanPages(canvas.pages, meta);
    return {
      kind,
      layout: facts.layout,
      scanned,
      pageCount: canvas.pages.length,
      bytes: scan.bytes,
      fields: placeFields(canvas.fields, plan, (f) => scan.moveBox(f.box)),
      facts,
    };
  }
  return {
    kind,
    layout: facts.layout,
    scanned,
    pageCount: canvas.pages.length,
    bytes: await writeTextPdf(canvas.pages, meta),
    fields: placeFields(canvas.fields, plan),
    facts,
  };
}
