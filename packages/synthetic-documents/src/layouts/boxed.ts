import { BLACK } from "../canvas.js";
import { drawTable, type Column, type TableLook } from "../table.js";
import {
  CONTENT_WIDTH,
  MARGIN,
  MUTED,
  PAPER_GREY,
  RIGHT,
  assertFits,
  captioned,
  type CaptionStyle,
  type DrawLayout,
} from "./kit.js";

const FRAME = [0.2, 0.2, 0.24] as const;

const CAPTION: CaptionStyle = {
  labelFont: "sans",
  labelSize: 6.5,
  valueFont: "sansBold",
  valueSize: 10,
  gap: 13,
  upper: true,
};

const COLUMNS: Column[] = [
  { id: "no", label: "No.", width: 24 },
  { id: "partNumber", label: "PART NUMBER", width: 100 },
  { id: "description", label: "DESCRIPTION", width: 180 },
  { id: "quantity", label: "QTY", width: 48, align: "right" },
  { id: "unitPrice", label: "UNIT PRICE", width: 80, align: "right" },
  { id: "amount", label: "AMOUNT", width: 91.28, align: "right" },
];

const LOOK: TableLook = {
  font: "sans",
  bold: "sansBold",
  size: 8.5,
  headFill: PAPER_GREY,
  headColor: BLACK,
  rule: FRAME,
  grid: true,
  padX: 5,
  padY: 4,
};

const TERMS = [
  "Goods must match the part numbers and quantities above. We do not accept substitutions or part shipments unless we agree in writing.",
  "Quote our PO number on the packing list, the invoice and the airway bill or bill of lading.",
  "Each carton is marked with the PO number, the part number and the quantity inside it.",
  "We inspect goods within seven days of arrival and report any shortage or damage in writing.",
  "Prices are fixed in US dollars and include packing for export.",
];

/** A boxed form: a ruled grid of small labelled cells, with the terms on the back. */
export const drawBoxed: DrawLayout = (canvas, facts, f) => {
  const stroke = { stroke: FRAME, lineWidth: 0.9 };
  const cell = (x: number, y: number, w: number, h: number): void => {
    canvas.rect({ x, y, w, h }, stroke);
  };

  cell(MARGIN, 36, CONTENT_WIDTH, 44);
  canvas.put(f.customerName, MARGIN + 10, 64, { font: "sansBold", size: 14 });
  canvas.text("PURCHASE ORDER", RIGHT - 10, 64, {
    font: "sansBold",
    size: 15,
    align: "right",
    color: FRAME,
  });

  const quarter = CONTENT_WIDTH / 4;
  [f.number, f.issueDate, f.otherDate, f.currency].forEach((field, i) => {
    cell(MARGIN + i * quarter, 80, quarter, 38);
    if (field) captioned(canvas, field, MARGIN + i * quarter + 7, 93, CAPTION);
  });

  const widths = [0.3, 0.34, 0.36].map((share) => share * CONTENT_WIDTH);
  const starts = [
    MARGIN,
    MARGIN + (widths[0] ?? 0),
    MARGIN + (widths[0] ?? 0) + (widths[1] ?? 0),
  ];
  widths.forEach((w, i) => {
    cell(starts[i] ?? MARGIN, 118, w, 70);
  });
  const [vendorX = MARGIN, billX = MARGIN, shipX = MARGIN] = starts;
  canvas.text("VENDOR", vendorX + 7, 131, {
    font: "sans",
    size: 6.5,
    color: MUTED,
  });
  canvas.text(facts.seller.name, vendorX + 7, 144, {
    font: "sansBold",
    size: 8.5,
  });
  facts.seller.address.forEach((line, i) =>
    canvas.text(line, vendorX + 7, 156 + i * 11, { font: "sans", size: 8.5 }),
  );
  if (f.billTo) {
    captioned(canvas, f.billTo, billX + 7, 131, {
      ...CAPTION,
      valueFont: "sans",
      valueSize: 8.5,
    });
  }
  captioned(canvas, f.shipTo, shipX + 7, 131, {
    ...CAPTION,
    valueFont: "sans",
    valueSize: 8.5,
  });

  const third = CONTENT_WIDTH / 3;
  [f.contact, f.incoterms].forEach((field, i) => {
    cell(MARGIN + i * third, 206, third, 38);
    if (field) captioned(canvas, field, MARGIN + i * third + 7, 219, CAPTION);
  });
  cell(MARGIN + 2 * third, 206, third, 38);
  canvas.text("PAYMENT TERMS", MARGIN + 2 * third + 7, 219, {
    font: "sans",
    size: 6.5,
    color: MUTED,
  });
  canvas.text("See terms of purchase, page 2", MARGIN + 2 * third + 7, 232, {
    font: "sans",
    size: 9,
  });

  const bottom = drawTable(canvas, MARGIN, 262, COLUMNS, f.lines, LOOK);
  assertFits(bottom + 120, "The boxed PO");
  if (f.total) {
    cell(RIGHT - 190, bottom + 10, 190, 34);
    captioned(
      canvas,
      f.total,
      RIGHT - 8,
      bottom + 22,
      { ...CAPTION, valueSize: 12 },
      "right",
    );
  }
  const sign = bottom + 76;
  cell(MARGIN, sign, CONTENT_WIDTH * 0.6, 70);
  canvas.text("AUTHORISED SIGNATURE", MARGIN + 7, sign + 13, {
    font: "sans",
    size: 6.5,
    color: MUTED,
  });
  cell(MARGIN + CONTENT_WIDTH * 0.6, sign, CONTENT_WIDTH * 0.4, 70);
  canvas.text("DATE", MARGIN + CONTENT_WIDTH * 0.6 + 7, sign + 13, {
    font: "sans",
    size: 6.5,
    color: MUTED,
  });
  canvas.text(
    "Please confirm receipt of this order and the delivery date.",
    MARGIN,
    sign + 90,
    { font: "sans", size: 8, color: MUTED },
  );

  canvas.newPage();
  cell(MARGIN, 36, CONTENT_WIDTH, 44);
  canvas.text("TERMS OF PURCHASE", MARGIN + 10, 64, {
    font: "sansBold",
    size: 15,
    color: FRAME,
  });
  canvas.text(facts.number, RIGHT - 10, 64, {
    font: "sans",
    size: 9,
    align: "right",
    color: MUTED,
  });
  cell(MARGIN, 80, CONTENT_WIDTH, 300);
  canvas.text("1.  Payment terms", MARGIN + 10, 102, {
    font: "sansBold",
    size: 9,
  });
  if (f.paymentTerms)
    canvas.put(f.paymentTerms, MARGIN + 34, 118, { font: "sans", size: 9.5 });
  let y = 144;
  TERMS.forEach((clause, i) => {
    canvas.text(
      `${String(i + 2)}.  ${i === 0 ? "Goods" : i === 1 ? "References" : i === 2 ? "Marking" : i === 3 ? "Inspection" : "Prices"}`,
      MARGIN + 10,
      y,
      { font: "sansBold", size: 9 },
    );
    const wrapped = canvas.wrap(clause, CONTENT_WIDTH - 60, "sans", 8.5);
    canvas.lines(wrapped, MARGIN + 34, y + 14, 11.5, {
      font: "sans",
      size: 8.5,
    });
    y += 20 + wrapped.length * 11.5 + 8;
  });
};
