import { PAGE, type DrawOp, type TextOp } from "./canvas.js";
import { DEMO_LABEL } from "./model.js";

/** The baseline of the line every page carries at its foot. */
export const STAMP_BASELINE = PAGE.height - 24;

const STYLE = { font: "sans", size: 7, color: [0.4, 0.4, 0.42] } as const;

export const STAMP_TEXT = `${DEMO_LABEL}. Fictional companies, prices in USD, demo bank details. Not a real document.`;

export function stampOps(page: number, pages: number): DrawOp[] {
  const label: TextOp = {
    kind: "text",
    ...STYLE,
    x: 36,
    y: STAMP_BASELINE,
    text: STAMP_TEXT,
  };
  return [
    {
      kind: "line",
      from: [36, STAMP_BASELINE - 10],
      to: [PAGE.width - 36, STAMP_BASELINE - 10],
      color: [0.8, 0.8, 0.82],
      lineWidth: 0.4,
    },
    label,
    {
      kind: "text",
      ...STYLE,
      x: PAGE.width - 36 - 38,
      y: STAMP_BASELINE,
      text: `Page ${String(page)} of ${String(pages)}`,
    },
  ];
}

/** Every page says what it is, however it is cut out of the file. */
export function stamp(pages: DrawOp[][]): void {
  pages.forEach((ops, i) => {
    ops.push(...stampOps(i + 1, pages.length));
  });
}
