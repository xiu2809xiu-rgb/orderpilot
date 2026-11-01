import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import {
  AS_OF,
  createSyntheticDataset,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { PAGE } from "./canvas.js";
import { renderDocument, type RenderedDocument } from "./render.js";
import { DEMO_LABEL, type DocumentKind, type PlacedField } from "./model.js";

/** One of the twelve files the demo offers, and the order it is tied to. */
export interface DemoFile {
  /** The file name without its extension. */
  stem: string;
  orderNo: string;
  kind: DocumentKind;
  scanned: boolean;
  purpose: string;
}

/**
 * The twelve demo files. Each is tied to an order in the synthetic set, picked
 * for the task or scenario it has, so a file and the screens never disagree.
 */
export const DEMO_FILES: readonly DemoFile[] = [
  {
    stem: "po-boxed-so-0115",
    orderNo: "SO-0115",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A boxed form, two pages, with the payment terms overleaf. Its task says to confirm 3 uncertain fields.",
  },
  {
    stem: "po-letter-so-0101",
    orderNo: "SO-0101",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A plain letter. Its task says to confirm 4 uncertain fields, one of them the price on line 1.",
  },
  {
    stem: "po-table-so-0114",
    orderNo: "SO-0114",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A dense table printout. Its task says to confirm 2 uncertain fields, the one to try in the sales pilot.",
  },
  {
    stem: "po-branded-so-0112",
    orderNo: "SO-0112",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "The customer's own look. Line 1 is printed 1.50 under the price list, and that price is the one uncertain field.",
  },
  {
    stem: "po-table-so-0120-scanned",
    orderNo: "SO-0120",
    kind: "CUSTOMER_PO",
    scanned: true,
    purpose:
      "A scan: slightly tilted, grey paper, speckled, and an image with no text in it. What Mock AI does with a file it can only see.",
  },
  {
    stem: "po-letter-so-0041",
    orderNo: "SO-0041",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "The PO that the packing list pl-so-0041-mismatch is checked against.",
  },
  {
    stem: "pl-so-0041-mismatch",
    orderNo: "SO-0041",
    kind: "PACKING_LIST",
    scanned: false,
    purpose:
      "The mismatch for end-to-end test 1: line 1 packs fewer pieces than the PO orders.",
  },
  {
    stem: "pl-so-0026",
    orderNo: "SO-0026",
    kind: "PACKING_LIST",
    scanned: false,
    purpose: "A packing list that agrees with its order.",
  },
  {
    stem: "pi-so-0097",
    orderNo: "SO-0097",
    kind: "PROFORMA_INVOICE",
    scanned: false,
    purpose:
      "A PI for a 30% deposit, with Spectra's demo bank details to pay into.",
  },
  {
    stem: "pi-so-0079",
    orderNo: "SO-0079",
    kind: "PROFORMA_INVOICE",
    scanned: false,
    purpose: "A PI for a 50% advance on a single line.",
  },
  {
    stem: "pi-so-0063",
    orderNo: "SO-0063",
    kind: "PROFORMA_INVOICE",
    scanned: false,
    purpose: "A PI for payment in full before shipment.",
  },
  {
    stem: "invoice-so-0005",
    orderNo: "SO-0005",
    kind: "SALES_INVOICE",
    scanned: false,
    purpose: "A commercial invoice on 30-day terms, with its due date.",
  },
];

export interface GroundTruth {
  label: typeof DEMO_LABEL;
  file: string;
  documentType: DocumentKind;
  documentNumber: string;
  layout: string;
  /** "image" when the file has no text in it, so a reader can only see it. */
  readable: "text" | "image";
  orderNo: string;
  customerNo: string;
  purpose: string;
  pageCount: number;
  /** Page size in points: boxes are fractions of it, from the top-left corner. */
  page: { width: number; height: number };
  /** A field below this is uncertain. It is the shared constant, not a copy. */
  confidenceThreshold: number;
  uncertainFieldCount: number;
  /** Set on the packing list that disagrees with its PO. */
  mismatch: {
    lineIndex: number;
    partNumber: string;
    ordered: string;
    packed: string;
  } | null;
  fields: PlacedField[];
}

export function groundTruth(
  file: DemoFile,
  dataset: SyntheticDataset,
  rendered: RenderedDocument,
): GroundTruth {
  const scenario = dataset.orders.find(
    (o) => o.header.no === file.orderNo,
  )?.scenario;
  const line = rendered.facts.lines[0];
  return {
    label: DEMO_LABEL,
    file: `${file.stem}.pdf`,
    documentType: file.kind,
    documentNumber: rendered.facts.number,
    layout: rendered.layout,
    readable: file.scanned ? "image" : "text",
    orderNo: file.orderNo,
    customerNo: rendered.facts.customerNo,
    purpose: file.purpose,
    pageCount: rendered.pageCount,
    page: { width: PAGE.width, height: PAGE.height },
    confidenceThreshold: CONFIDENCE_HIGH,
    uncertainFieldCount: rendered.fields.filter((f) => f.uncertain).length,
    mismatch:
      file.kind === "PACKING_LIST" &&
      scenario?.kind === "packing-list-mismatch" &&
      line
        ? {
            lineIndex: 0,
            partNumber: line.partNumber,
            ordered: scenario.ordered,
            packed: scenario.packed,
          }
        : null,
    fields: rendered.fields,
  };
}

/** The reference date the demo files are made on, whatever day it is now. */
export const DEMO_REFERENCE_DATE = AS_OF;

export async function renderDemoFile(
  file: DemoFile,
  dataset: SyntheticDataset = createSyntheticDataset({
    referenceDate: DEMO_REFERENCE_DATE,
  }),
): Promise<{ pdf: Uint8Array; truth: GroundTruth }> {
  const rendered = await renderDocument(dataset, file.orderNo, file.kind, {
    scanned: file.scanned,
  });
  return { pdf: rendered.bytes, truth: groundTruth(file, dataset, rendered) };
}
