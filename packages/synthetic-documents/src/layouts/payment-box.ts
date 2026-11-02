import type { Canvas } from "../canvas.js";
import type { DocumentFacts } from "../facts.js";
import type { Fields } from "../fields.js";
import {
  CONTENT_WIDTH,
  MARGIN,
  MUTED,
  RIGHT,
  captioned,
  type CaptionStyle,
} from "./kit.js";
import type { Color } from "../canvas.js";

export const JADE: Color = [0.07, 0.4, 0.33];

/**
 * Where Spectra's bank details sit on a PI. The wording says in plain words that
 * the account is not real, because the data rules ask for details that cannot
 * be mistaken for a real account.
 */
export function drawPaymentBox(
  canvas: Canvas,
  facts: DocumentFacts,
  bank: NonNullable<Fields["bank"]>,
  top: number,
  caption: CaptionStyle,
): void {
  canvas.rect(
    { x: MARGIN, y: top, w: CONTENT_WIDTH, h: 84 },
    { stroke: JADE, lineWidth: 1 },
  );
  canvas.text("PAYMENT DETAILS", MARGIN + 10, top + 15, {
    font: "sansBold",
    size: 8,
    color: JADE,
  });
  canvas.text(
    "Demo bank details for this synthetic document. Not a real account: do not pay.",
    RIGHT - 10,
    top + 15,
    { font: "sans", size: 7.5, color: MUTED, align: "right" },
  );
  const cell = CONTENT_WIDTH / 2;
  const mono = { ...caption, valueFont: "mono" } as const;
  captioned(canvas, bank.beneficiary, MARGIN + 10, top + 34, caption);
  captioned(canvas, bank.bankName, MARGIN + 10 + cell, top + 34, caption);
  captioned(canvas, bank.accountNo, MARGIN + 10, top + 62, mono);
  captioned(canvas, bank.swiftCode, MARGIN + 10 + cell, top + 62, mono);
  canvas.text(
    `Please quote ${facts.number} as the payment reference.`,
    MARGIN,
    top + 102,
    { font: "sans", size: 8, color: MUTED },
  );
}
