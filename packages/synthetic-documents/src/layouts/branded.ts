import { PAGE, type Color } from "../canvas.js";
import { drawTable, type Column, type TableLook } from "../table.js";
import {
  CONTENT_WIDTH,
  MARGIN,
  RIGHT,
  WHITE,
  assertFits,
  captioned,
  type CaptionStyle,
  type DrawLayout,
} from "./kit.js";

/** A customer's house colour, from its number, so the same customer always looks the same. */
const COLOURS: readonly Color[] = [
  [0.0, 0.4, 0.43],
  [0.2, 0.24, 0.55],
  [0.5, 0.12, 0.2],
  [0.11, 0.38, 0.2],
  [0.68, 0.36, 0.04],
  [0.24, 0.29, 0.37],
];

const tint = ([r, g, b]: Color, amount: number): Color => [
  r + (1 - r) * amount,
  g + (1 - g) * amount,
  b + (1 - b) * amount,
];

const COLUMNS: Column[] = [
  { id: "no", label: "#", width: 24 },
  { id: "partNumber", label: "Part number", width: 100 },
  { id: "description", label: "Description", width: 180 },
  { id: "quantity", label: "Qty", width: 48, align: "right" },
  { id: "unitPrice", label: "Unit price", width: 80, align: "right" },
  { id: "amount", label: "Amount", width: CONTENT_WIDTH - 432, align: "right" },
];

/** The customer's own look: a colour band with a mark, soft cards, and a coloured table heading. */
export const drawBranded: DrawLayout = (canvas, facts, f) => {
  const brand =
    COLOURS[Number(facts.customerNo.slice(2)) % COLOURS.length] ??
    COLOURS[0] ??
    WHITE;
  const soft = tint(brand, 0.92);
  const caption: CaptionStyle = {
    labelFont: "sans",
    labelSize: 6.8,
    labelColor: brand,
    valueFont: "sansBold",
    valueSize: 9.5,
    gap: 12,
    upper: true,
  };

  canvas.rect(
    { x: 0, y: 0, w: PAGE.width, h: 96 },
    { fill: brand, lineWidth: 0 },
  );
  canvas.rect(
    { x: MARGIN, y: 26, w: 44, h: 44 },
    { fill: WHITE, lineWidth: 0 },
  );
  const initials = facts.buyer.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
  canvas.text(initials, MARGIN + 22, 55, {
    font: "sansBold",
    size: 19,
    color: brand,
    align: "center",
  });
  canvas.put(f.customerName, MARGIN + 58, 46, {
    font: "sansBold",
    size: 16,
    color: WHITE,
  });
  canvas.text("Purchasing and supply", MARGIN + 58, 62, {
    font: "sans",
    size: 8.5,
    color: tint(brand, 0.75),
  });
  canvas.text("PURCHASE ORDER", RIGHT, 44, {
    font: "sansBold",
    size: 19,
    color: WHITE,
    align: "right",
  });
  canvas.text("No.", RIGHT - 76, 66, {
    font: "sans",
    size: 9,
    color: tint(brand, 0.75),
    align: "right",
  });
  canvas.put(f.number, RIGHT, 66, {
    font: "sansBold",
    size: 11.5,
    color: WHITE,
    align: "right",
  });

  const card = (x: number, w: number): void => {
    canvas.rect({ x, y: 114, w, h: 92 }, { fill: soft, lineWidth: 0 });
  };
  const widths = [0.27, 0.31, 0.42].map(
    (share) => share * (CONTENT_WIDTH - 20),
  );
  const xs = [
    MARGIN,
    MARGIN + (widths[0] ?? 0) + 10,
    MARGIN + (widths[0] ?? 0) + (widths[1] ?? 0) + 20,
  ];
  const [x0 = MARGIN, x1 = MARGIN, x2 = MARGIN] = xs;
  xs.forEach((x, i) => {
    card(x, widths[i] ?? 100);
  });
  const small = { ...caption, valueSize: 9, gap: 11 };
  captioned(canvas, f.issueDate, x0 + 10, 130, small);
  if (f.otherDate) captioned(canvas, f.otherDate, x0 + 10, 156, small);
  if (f.contact) captioned(canvas, f.contact, x0 + 10, 182, small);
  if (f.billTo)
    captioned(canvas, f.billTo, x1 + 10, 130, {
      ...small,
      valueFont: "sans",
      valueSize: 8.8,
    });
  captioned(canvas, f.shipTo, x2 + 10, 130, {
    ...small,
    valueFont: "sans",
    valueSize: 8.8,
  });

  const chip = [f.incoterms, f.paymentTerms, f.currency];
  const chipWidths = [0.28, 0.5, 0.22].map(
    (share) => share * (CONTENT_WIDTH - 20),
  );
  let x = MARGIN;
  chip.forEach((field, i) => {
    const cw = chipWidths[i] ?? 100;
    canvas.rect({ x, y: 222, w: cw, h: 38 }, { stroke: brand, lineWidth: 0.9 });
    if (field) captioned(canvas, field, x + 10, 236, small);
    x += cw + 10;
  });

  const look: TableLook = {
    font: "sans",
    bold: "sansBold",
    size: 9,
    headFill: brand,
    headColor: WHITE,
    rule: brand,
    zebra: soft,
    padX: 6,
    padY: 5.5,
  };
  const bottom = drawTable(canvas, MARGIN, 280, COLUMNS, f.lines, look);
  assertFits(bottom + 140, "The branded PO");
  if (f.total) {
    canvas.rect(
      { x: RIGHT - 200, y: bottom + 14, w: 200, h: 40 },
      { fill: brand, lineWidth: 0 },
    );
    captioned(
      canvas,
      f.total,
      RIGHT - 12,
      bottom + 29,
      {
        ...small,
        labelColor: tint(brand, 0.8),
        valueColor: WHITE,
        valueSize: 14,
        gap: 15,
      },
      "right",
    );
  }
  canvas.text(
    "Thank you. Please quote this PO number on every document and carton.",
    MARGIN,
    bottom + 40,
    {
      font: "sans",
      size: 8.5,
      color: brand,
    },
  );
  canvas.rect(
    { x: 0, y: PAGE.height - 46, w: PAGE.width, h: 7 },
    { fill: brand, lineWidth: 0 },
  );
};
