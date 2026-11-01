import { PAGE, type Color } from "../canvas.js";
import { printDate } from "../format.js";
import { drawTable, type Column, type TableLook } from "../table.js";
import {
  MUTED,
  WHITE,
  assertFits,
  captioned,
  type CaptionStyle,
  type DrawLayout,
} from "./kit.js";

const LEFT = 28;
const WIDTH = PAGE.width - 2 * LEFT;
const DARK: Color = [0.16, 0.17, 0.2];

const COLUMNS: Column[] = [
  { id: "no", label: "LN", width: 20 },
  { id: "partNumber", label: "PART NO.", width: 90 },
  { id: "description", label: "DESCRIPTION", width: 150 },
  { id: "uom", label: "UOM", width: 28 },
  { id: "quantity", label: "QTY", width: 40, align: "right" },
  { id: "unitPrice", label: "UNIT PRICE", width: 54, align: "right" },
  { id: "discount", label: "DISC%", width: 32, align: "right" },
  { id: "amount", label: "LINE AMOUNT", width: 62, align: "right" },
  { id: "delivery", label: "DEL. DATE", width: WIDTH - 476, align: "right" },
];

const LOOK: TableLook = {
  font: "mono",
  bold: "sansBold",
  size: 7.2,
  headFill: DARK,
  headColor: WHITE,
  rule: DARK,
  rowRule: true,
  zebra: [0.95, 0.95, 0.96],
  padX: 3,
  padY: 3,
};

const CAPTION: CaptionStyle = {
  labelFont: "mono",
  labelSize: 6.4,
  valueFont: "mono",
  valueSize: 7.8,
  gap: 9,
  upper: true,
};

/** A dense ERP printout: monospaced, tiny, a heading strip of keys and values and a many-column table. */
export const drawTableLayout: DrawLayout = (canvas, facts, f) => {
  canvas.rect(
    { x: LEFT, y: 30, w: WIDTH, h: 26 },
    { fill: DARK, lineWidth: 0 },
  );
  canvas.put(f.customerName, LEFT + 8, 47, {
    font: "sansBold",
    size: 11,
    color: WHITE,
  });
  canvas.text("PURCHASE ORDER LISTING", PAGE.width - LEFT - 8, 47, {
    font: "sansBold",
    size: 10,
    color: WHITE,
    align: "right",
  });
  canvas.text(
    `Printed ${printDate(facts.issueDate)} 09:14 by PURCH01   Report PO-LIST-01   Page 1 of 1`,
    LEFT,
    70,
    { font: "mono", size: 6.6, color: MUTED },
  );
  canvas.line([LEFT, 76], [LEFT + WIDTH, 76], DARK, 0.8);

  const col = [LEFT, LEFT + 190, LEFT + 380];
  const [c0 = LEFT, c1 = LEFT, c2 = LEFT] = col;
  const row1 = [f.number, f.issueDate, f.otherDate];
  const row2 = [f.contact, f.currency, f.incoterms];
  row1.forEach(
    (field, i) =>
      field && captioned(canvas, field, col[i] ?? LEFT, 90, CAPTION),
  );
  row2.forEach(
    (field, i) =>
      field && captioned(canvas, field, col[i] ?? LEFT, 116, CAPTION),
  );
  if (f.paymentTerms) captioned(canvas, f.paymentTerms, c0, 142, CAPTION);
  canvas.text("VENDOR", c2, 142, { font: "mono", size: 6.4, color: MUTED });
  canvas.lines([facts.seller.name, ...facts.seller.address], c2, 151, 9, {
    font: "mono",
    size: 6.8,
  });
  if (f.billTo) captioned(canvas, f.billTo, c0, 184, CAPTION);
  captioned(canvas, f.shipTo, c1, 184, CAPTION);
  canvas.text("REMARKS", c2, 184, { font: "mono", size: 6.4, color: MUTED });
  canvas.lines(
    ["Deliver complete.", "Quote PO no. on all papers.", "No substitutions."],
    c2,
    193,
    9,
    {
      font: "mono",
      size: 7.2,
    },
  );
  canvas.line([LEFT, 238], [LEFT + WIDTH, 238], DARK, 0.5);

  const delivery = f.otherDate?.text ?? "";
  const bottom = drawTable(canvas, LEFT, 248, COLUMNS, f.lines, LOOK, {
    uom: "PCS",
    discount: "0.00",
    delivery,
  });
  assertFits(bottom + 60, "The table PO");
  canvas.text("TOTAL USD", LEFT + WIDTH - 90, bottom + 16, {
    font: "sansBold",
    size: 8,
    align: "right",
  });
  if (f.total) {
    canvas.put(f.total, LEFT + WIDTH - 4, bottom + 16, {
      font: "mono",
      size: 9,
      align: "right",
    });
  }
  canvas.line([LEFT, bottom + 24], [LEFT + WIDTH, bottom + 24], DARK, 0.5);
  canvas.text("*** END OF LISTING ***", LEFT + WIDTH / 2, bottom + 40, {
    font: "mono",
    size: 7,
    color: MUTED,
    align: "center",
  });
};
