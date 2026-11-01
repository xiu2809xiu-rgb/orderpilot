import type { DocumentKind } from "../model.js";
import { drawTable, type Column, type TableLook } from "../table.js";
import { JADE, drawPaymentBox } from "./payment-box.js";
import {
  CONTENT_WIDTH,
  MARGIN,
  MUTED,
  PAPER_GREY,
  RIGHT,
  RULE,
  WHITE,
  assertFits,
  captioned,
  sellerBlock,
  type CaptionStyle,
  type DrawLayout,
} from "./kit.js";

const TITLES: Record<DocumentKind, string> = {
  CUSTOMER_PO: "PURCHASE ORDER",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  PACKING_LIST: "PACKING LIST",
  SALES_INVOICE: "COMMERCIAL INVOICE",
};

const PRICED: Column[] = [
  { id: "no", label: "#", width: 24 },
  { id: "partNumber", label: "Part number", width: 104 },
  { id: "description", label: "Description", width: 188 },
  { id: "quantity", label: "Qty", width: 50, align: "right" },
  { id: "unitPrice", label: "Unit price", width: 76, align: "right" },
  { id: "amount", label: "Amount", width: CONTENT_WIDTH - 442, align: "right" },
];

const PACKED: Column[] = [
  { id: "no", label: "#", width: 24 },
  { id: "partNumber", label: "Part number", width: 112 },
  { id: "description", label: "Description", width: 212 },
  { id: "quantity", label: "Qty", width: 56, align: "right" },
  { id: "cartons", label: "Cartons", width: 56, align: "right" },
  {
    id: "grossWeight",
    label: "Gross kg",
    width: CONTENT_WIDTH - 460,
    align: "right",
  },
];

const LOOK: TableLook = {
  font: "sans",
  bold: "sansBold",
  size: 8.8,
  headFill: PAPER_GREY,
  headColor: [0.1, 0.1, 0.12],
  rule: [0.3, 0.3, 0.33],
  rowRule: true,
  padX: 5,
  padY: 5,
};

const CAPTION: CaptionStyle = {
  labelFont: "sans",
  labelSize: 6.8,
  valueFont: "sans",
  valueSize: 9,
  gap: 12,
  upper: true,
};

/** Spectra's own documents: a PI, a packing list or an invoice, in one clean house style. */
export const drawHouse: DrawLayout = (canvas, facts, f) => {
  const packing = facts.kind === "PACKING_LIST";
  canvas.rect({ x: MARGIN, y: 34, w: 34, h: 34 }, { fill: JADE, lineWidth: 0 });
  canvas.text("S", MARGIN + 17, 58, {
    font: "sansBold",
    size: 21,
    color: WHITE,
    align: "center",
  });
  sellerBlock(canvas, facts, MARGIN + 46, 46, {
    bold: "sansBold",
    font: "sans",
    size: 8.5,
  });
  canvas.text(TITLES[facts.kind], RIGHT, 52, {
    font: "sansBold",
    size: 18,
    color: JADE,
    align: "right",
  });
  [f.number, f.issueDate, f.otherDate, f.poRef].forEach((field, i) => {
    if (!field) return;
    const y = 72 + i * 12;
    canvas.text(field.label, RIGHT - 96, y, {
      font: "sans",
      size: 8,
      color: MUTED,
      align: "right",
    });
    canvas.put(field, RIGHT, y, { font: "sansBold", size: 9, align: "right" });
  });
  canvas.line([MARGIN, 128], [RIGHT, 128], JADE, 1.4);

  const half = CONTENT_WIDTH / 2;
  canvas.text(packing ? "CONSIGNEE" : "BILL TO", MARGIN, 152, {
    font: "sans",
    size: 6.8,
    color: MUTED,
  });
  canvas.put(f.customerName, MARGIN, 165, { font: "sansBold", size: 10 });
  if (f.billTo)
    canvas.putLines(f.billTo, MARGIN, 178, 12, { font: "sans", size: 9 });
  captioned(canvas, f.shipTo, MARGIN + half, 152, CAPTION);

  let y = 244;
  const terms = [f.incoterms, f.paymentTerms, f.currency];
  terms.forEach((field, i) => {
    const at = [0, 0.25, 0.8][i] ?? 0;
    if (field)
      captioned(canvas, field, MARGIN + at * CONTENT_WIDTH, y, CAPTION);
  });
  if (!f.incoterms) y -= 30;
  const bottom = drawTable(
    canvas,
    MARGIN,
    y + 32,
    packing ? PACKED : PRICED,
    f.lines,
    LOOK,
  );
  assertFits(bottom + 230, `The ${facts.kind} document`);

  const sumRow = (
    label: string,
    field: typeof f.total,
    at: number,
    bold = false,
  ) => {
    if (!field) return;
    canvas.text(label, RIGHT - 110, at, {
      font: "sans",
      size: 9,
      color: MUTED,
      align: "right",
    });
    canvas.put(field, RIGHT - 4, at, {
      font: bold ? "sansBold" : "sans",
      size: bold ? 11 : 9.5,
      align: "right",
    });
  };
  if (packing) {
    sumRow("Total quantity", f.totalQuantity, bottom + 20);
    sumRow("Total cartons", f.totalCartons, bottom + 36);
    sumRow("Total gross weight (kg)", f.totalGrossWeight, bottom + 52, true);
    ["Packed by", "Checked by"].forEach((label, i) => {
      const x = MARGIN + i * (half + 10);
      canvas.line([x, bottom + 120], [x + half - 20, bottom + 120], RULE, 0.6);
      canvas.text(label, x, bottom + 132, {
        font: "sans",
        size: 8,
        color: MUTED,
      });
    });
    return;
  }
  sumRow("Total (USD)", f.total, bottom + 22, true);
  sumRow("Due now", f.amountDue, bottom + 40);
  sumRow("Balance before shipment", f.balanceDue, bottom + 56);

  if (f.bank) drawPaymentBox(canvas, facts, f.bank, bottom + 84, CAPTION);
};
