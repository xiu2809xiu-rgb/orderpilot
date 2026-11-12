import {
  AS_OF,
  createSyntheticDataset,
  type SampleOrder,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { layoutForCustomer } from "./facts-data.js";
import {
  PO_LAYOUTS,
  type DocumentKind,
  type LayoutId,
  type PoLayout,
} from "./model.js";
import type { PlanEntry } from "./plan/entry.js";
import { twelvePlan } from "./plan/twelve.js";
import { renderSubject } from "./render.js";
import { groundTruth, type GroundTruth } from "./truth.js";

export type { GroundTruth } from "./truth.js";

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
 * for the task or scenario it has by `pickDemoFiles`, which a test keeps equal
 * to this list, so a change to the data cannot leave a file behind. Lines, prices, customers and the PO, packing
 * list and invoice numbers read the same on any day. A file's dates and a PI's
 * number are those of 2 Nov 2026, so the screens show other dates, and other PI
 * numbers, after that day.
 */
export const DEMO_FILES: readonly DemoFile[] = [
  {
    stem: "po-boxed-so-0102",
    orderNo: "SO-0102",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A boxed form, two pages, with the payment terms overleaf. Its task says to confirm 2 uncertain fields, the one to try in the sales pilot.",
  },
  {
    stem: "po-letter-so-0119",
    orderNo: "SO-0119",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A plain letter. Mock AI has not read it yet, so its task says to check the fields.",
  },
  {
    stem: "po-table-so-0115",
    orderNo: "SO-0115",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "A dense table printout. Its task says to confirm 3 uncertain fields.",
  },
  {
    stem: "po-branded-so-0101",
    orderNo: "SO-0101",
    kind: "CUSTOMER_PO",
    scanned: false,
    purpose:
      "The customer's own look. Its task says to confirm 4 uncertain fields.",
  },
  {
    stem: "po-letter-so-0120-scanned",
    orderNo: "SO-0120",
    kind: "CUSTOMER_PO",
    scanned: true,
    purpose:
      "A scan: slightly tilted, grey paper, speckled, and an image with no text in it. What Mock AI does with a file it can only see.",
  },
  {
    stem: "po-table-so-0041",
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
    stem: "pi-so-0075",
    orderNo: "SO-0075",
    kind: "PROFORMA_INVOICE",
    scanned: false,
    purpose:
      "A PI for a 30% deposit, with Spectra's demo bank details to pay into.",
  },
  {
    stem: "pi-so-0051",
    orderNo: "SO-0051",
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
    stem: "invoice-so-0001",
    orderNo: "SO-0001",
    kind: "SALES_INVOICE",
    scanned: false,
    purpose: "A commercial invoice on 30-day terms, with its due date.",
  },
];

const REVIEW_TASK = /^Confirm the (\d+) uncertain fields$/;

const LOOK: Record<PoLayout, string> = {
  boxed: "A boxed form, two pages, with the payment terms overleaf.",
  letter: "A plain letter.",
  table: "A dense table printout.",
  branded: "The customer's own look.",
};

const digitsOf = (no: string): string => no.slice(no.indexOf("-") + 1);

const stemOf = (kind: string, order: SampleOrder, tail = ""): string =>
  `${kind}-so-${digitsOf(order.header.no)}${tail}`;

function need<T>(found: T | undefined, what: string): T {
  if (found === undefined) throw new Error(`The data has no ${what}`);
  return found;
}

/**
 * Picks the twelve files from the data by state and trait, so that a change
 * to the data fails the `DEMO_FILES` test instead of leaving a file tied to an
 * order that has lost its trait. "First" is the lowest SO number and "newest"
 * the highest. It never renders: a boxed form is the two-page layout, and a
 * scan needs a one-page one.
 */
export function pickDemoFiles(dataset: SyntheticDataset): DemoFile[] {
  const orders = [...dataset.orders].sort((a, b) =>
    a.header.no.localeCompare(b.header.no),
  );
  const customers = new Map(dataset.customers.map((c) => [c.no, c]));
  const layoutOf = (o: SampleOrder): LayoutId =>
    layoutForCustomer(o.header.sellToCustomerNo);
  const has = (o: SampleOrder, kind: DocumentKind): boolean =>
    o.documents.some((d) => d.type === kind);
  const named = (o: SampleOrder): number | null => {
    const task = dataset.tasks.find(
      (t) => t.orderNo === o.header.no && t.kind === "REVIEW_FIELDS",
    );
    const n = REVIEW_TASK.exec(task?.title ?? "")?.[1];
    return n ? Number(n) : null;
  };
  const percent = (o: SampleOrder): number =>
    Number(o.header.prepaymentPercent);

  const review = orders.filter(
    (o) => o.sampleScreenState === "sample-extracted-awaiting-review",
  );
  const received = orders.filter(
    (o) => o.sampleScreenState === "sample-po-received",
  );
  const scanned = need(
    received.filter((o) => layoutOf(o) !== "boxed").at(-1),
    "single-page PO that was just received",
  );
  // The PO to try in the sales pilot: the first that names two fields to confirm.
  const pilot = need(
    review.find((o) => named(o) === 2),
    "PO with two uncertain fields to confirm",
  );
  const poFor = (layout: PoLayout): SampleOrder =>
    layoutOf(pilot) === layout
      ? pilot
      : need(
          review.find((o) => layoutOf(o) === layout) ??
            received
              .filter((o) => o !== scanned && layoutOf(o) === layout)
              .at(-1),
          `${layout} PO to read`,
        );
  const poFile = (layout: PoLayout): DemoFile => {
    const order = poFor(layout);
    const n = named(order);
    const task =
      n === null
        ? "Mock AI has not read it yet, so its task says to check the fields."
        : `Its task says to confirm ${String(n)} uncertain fields${
            order === pilot ? ", the one to try in the sales pilot" : ""
          }.`;
    return {
      stem: stemOf(`po-${layout}`, order),
      orderNo: order.header.no,
      kind: "CUSTOMER_PO",
      scanned: false,
      purpose: `${LOOK[layout]} ${task}`,
    };
  };

  const mismatch = need(
    orders.find(
      (o) => o.scenario.kind === "packing-list-mismatch" && o.lines.length >= 2,
    ),
    "packing list that disagrees with its PO",
  );
  const mismatchStem = stemOf("pl", mismatch, "-mismatch");
  const matching = need(
    orders.find(
      (o) =>
        o.sampleScreenState === "sample-shipped" &&
        o.scenario.kind === "none" &&
        has(o, "PACKING_LIST") &&
        o.lines.length >= 2,
    ),
    "packing list that agrees with its order",
  );
  // The planted PI that disagrees with its PO is a case of its own, not a sample file.
  const proformas = orders.filter(
    (o) =>
      has(o, "PROFORMA_INVOICE") &&
      (o.sampleScreenState === "sample-pi-to-send" ||
        o.sampleScreenState === "sample-awaiting-payment") &&
      o.scenario.kind !== "pi-price-mismatch",
  );
  const deposit = need(
    proformas.find((o) => percent(o) === 30),
    "PI for a 30% deposit",
  );
  const advance = need(
    proformas.find((o) => percent(o) === 50 && o.lines.length === 1),
    "PI for a 50% advance on one line",
  );
  const full = need(
    proformas.find((o) => percent(o) === 100),
    "PI for payment in full",
  );
  const invoiced = need(
    orders.find(
      (o) =>
        has(o, "SALES_INVOICE") &&
        customers.get(o.header.sellToCustomerNo)?.paymentTermsCode ===
          "30 DAYS",
    ),
    "invoice on 30-day terms",
  );

  const file = (
    kind: DocumentKind,
    stem: string,
    order: SampleOrder,
    purpose: string,
  ): DemoFile => ({
    stem,
    orderNo: order.header.no,
    kind,
    scanned: false,
    purpose,
  });
  return [
    ...PO_LAYOUTS.map(poFile),
    {
      ...file(
        "CUSTOMER_PO",
        stemOf(`po-${layoutOf(scanned)}`, scanned, "-scanned"),
        scanned,
        "A scan: slightly tilted, grey paper, speckled, and an image with no text in it. What Mock AI does with a file it can only see.",
      ),
      scanned: true,
    },
    file(
      "CUSTOMER_PO",
      stemOf(`po-${layoutOf(mismatch)}`, mismatch),
      mismatch,
      `The PO that the packing list ${mismatchStem} is checked against.`,
    ),
    file(
      "PACKING_LIST",
      mismatchStem,
      mismatch,
      "The mismatch for end-to-end test 1: line 1 packs fewer pieces than the PO orders.",
    ),
    file(
      "PACKING_LIST",
      stemOf("pl", matching),
      matching,
      "A packing list that agrees with its order.",
    ),
    file(
      "PROFORMA_INVOICE",
      stemOf("pi", deposit),
      deposit,
      "A PI for a 30% deposit, with Spectra's demo bank details to pay into.",
    ),
    file(
      "PROFORMA_INVOICE",
      stemOf("pi", advance),
      advance,
      "A PI for a 50% advance on a single line.",
    ),
    file(
      "PROFORMA_INVOICE",
      stemOf("pi", full),
      full,
      "A PI for payment in full before shipment.",
    ),
    file(
      "SALES_INVOICE",
      stemOf("invoice", invoiced),
      invoiced,
      "A commercial invoice on 30-day terms, with its due date.",
    ),
  ];
}

/** The reference date the demo files are made on, whatever day it is now. */
export const DEMO_REFERENCE_DATE = AS_OF;

/** Renders one planned document and builds its ground truth. */
export async function renderEntry(
  entry: PlanEntry,
  dataset: SyntheticDataset,
  plan: readonly PlanEntry[],
): Promise<{ pdf: Uint8Array; truth: GroundTruth }> {
  const rendered = await renderSubject(dataset, entry.subject, entry.kind, {
    scanned: entry.scanned,
    stage: entry.stage,
    mistake: entry.mistake,
    signed: entry.signed,
  });
  return { pdf: rendered.bytes, truth: groundTruth(entry, rendered, plan) };
}

export async function renderDemoFile(
  file: DemoFile,
  dataset: SyntheticDataset = createSyntheticDataset({
    referenceDate: DEMO_REFERENCE_DATE,
  }),
): Promise<{ pdf: Uint8Array; truth: GroundTruth }> {
  const plan = twelvePlan(dataset, DEMO_FILES);
  const entry = plan.find((e) => e.stem === file.stem);
  if (!entry) throw new Error(`${file.stem} is not one of the demo files`);
  return renderEntry(entry, dataset, plan);
}
