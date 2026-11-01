import { PAGE } from "../canvas.js";
import { textWidth } from "../fonts.js";
import { drawTable, type Column, type TableLook } from "../table.js";
import { MUTED, RULE, assertFits, type DrawLayout } from "./kit.js";

const LEFT = 58;
const RIGHT_EDGE = PAGE.width - LEFT;

const COLUMNS: Column[] = [
  { id: "no", label: "Item", width: 30 },
  { id: "partNumber", label: "Part number", width: 96 },
  { id: "description", label: "Description", width: 166 },
  { id: "quantity", label: "Qty", width: 44, align: "right" },
  { id: "unitPrice", label: "Unit price", width: 70, align: "right" },
  {
    id: "amount",
    label: "Amount",
    width: RIGHT_EDGE - LEFT - 406,
    align: "right",
  },
];

const LOOK: TableLook = {
  font: "serif",
  bold: "serifBold",
  size: 9.5,
  headColor: [0.1, 0.1, 0.12],
  rule: [0.3, 0.3, 0.33],
  rowRule: false,
  padX: 4,
  padY: 4.5,
};

/** A plain letter: a letterhead, a few lines of terms, a table with no boxes, and a signature. */
export const drawLetter: DrawLayout = (canvas, facts, f) => {
  canvas.put(f.customerName, LEFT, 76, { font: "serifBold", size: 17 });
  if (f.billTo) {
    canvas.putLines(f.billTo, LEFT, 94, 12.5, {
      font: "serif",
      size: 9.5,
      color: MUTED,
    });
  }
  canvas.text("Date:", RIGHT_EDGE - 118, 76, {
    font: "serif",
    size: 10,
    color: MUTED,
  });
  canvas.put(f.issueDate, RIGHT_EDGE, 76, {
    font: "serif",
    size: 10.5,
    align: "right",
  });
  canvas.line([LEFT, 136], [RIGHT_EDGE, 136], RULE, 0.8);

  canvas.text("To:", LEFT, 170, { font: "serif", size: 10, color: MUTED });
  canvas.text(facts.seller.name, LEFT + 28, 170, {
    font: "serifBold",
    size: 11,
  });
  facts.seller.address.forEach((line, i) =>
    canvas.text(line, LEFT + 28, 184 + i * 13, { font: "serif", size: 10 }),
  );

  const subject = "Purchase order no. ";
  canvas.text(subject, LEFT, 232, { font: "serifBold", size: 13 });
  canvas.put(f.number, LEFT + textWidth("serifBold", subject, 13), 232, {
    font: "serifBold",
    size: 13,
  });
  canvas.line([LEFT, 238], [LEFT + 218, 238], [0.3, 0.3, 0.33], 0.6);

  canvas.text("Dear Sirs,", LEFT, 266, { font: "serif", size: 10.5 });
  const intro = canvas.wrap(
    "Please supply the goods listed below against this order, on the terms set out here. Kindly confirm the delivery date by return.",
    RIGHT_EDGE - LEFT,
    "serif",
    10.5,
  );
  canvas.lines(intro, LEFT, 285, 14.5, { font: "serif", size: 10.5 });

  const terms: [string, typeof f.otherDate][] = [
    ["Required by", f.otherDate],
    ["Delivery terms", f.incoterms],
    ["Payment terms", f.paymentTerms],
    ["Currency", f.currency],
  ];
  let y = 330;
  for (const [label, field] of terms) {
    canvas.text(`${label}:`, LEFT, y, {
      font: "serif",
      size: 10,
      color: MUTED,
    });
    if (field) canvas.put(field, LEFT + 96, y, { font: "serif", size: 10.5 });
    y += 16;
  }
  canvas.text("Deliver to:", LEFT, y, {
    font: "serif",
    size: 10,
    color: MUTED,
  });
  canvas.putLines(f.shipTo, LEFT + 96, y, 13.5, { font: "serif", size: 10.5 });

  const bottom = drawTable(canvas, LEFT, y + 74, COLUMNS, f.lines, LOOK);
  if (f.total) {
    canvas.text("Total (USD)", RIGHT_EDGE - 110, bottom + 20, {
      font: "serifBold",
      size: 10.5,
      align: "right",
    });
    canvas.put(f.total, RIGHT_EDGE - 4, bottom + 20, {
      font: "serifBold",
      size: 11,
      align: "right",
    });
  }
  const close = bottom + 70;
  assertFits(close + 90, "The letter PO");
  canvas.text("Yours faithfully,", LEFT, close, { font: "serif", size: 10.5 });
  canvas.line(
    [LEFT, close + 46],
    [LEFT + 150, close + 46],
    [0.3, 0.3, 0.33],
    0.6,
  );
  if (f.contact)
    canvas.put(f.contact, LEFT, close + 60, { font: "serifBold", size: 10.5 });
  canvas.text("Purchasing Department", LEFT, close + 73, {
    font: "serif",
    size: 10,
    color: MUTED,
  });
};
