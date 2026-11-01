import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import { Canvas } from "./canvas.js";
import {
  placeFields,
  uncertainIds,
  type ConfidencePlan,
} from "./confidence.js";
import { buildFacts, type DocumentFacts } from "./facts.js";
import { fieldsOf } from "./build-fields.js";
import { allSpecs } from "./fields.js";
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
import { stamp } from "./stamp.js";

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
