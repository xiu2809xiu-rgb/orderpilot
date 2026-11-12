import { PAGE, type Canvas, type Color } from "../canvas.js";
import { JADE } from "./payment-box.js";
import { CONTENT_WIDTH, MARGIN, MUTED, RIGHT, WHITE } from "./kit.js";

/**
 * What a continuation page carries above the repeated heading: the name of the
 * document, that it goes on, and its number. The number is plain text, never a
 * field: the page-one field is the one a reader extracts.
 */
export interface Band {
  /** The y the repeated heading starts at. */
  top: number;
  band: (canvas: Canvas, page: number, pages: number) => void;
}

const pageOf = (page: number, pages: number): string =>
  `Page ${String(page)} of ${String(pages)}`;

/** Spectra's own documents: the jade rule and title of page one, smaller. */
export function houseBand(title: string, number: string): Band {
  return {
    top: 84,
    band: (canvas, page, pages) => {
      canvas.text(`${title}  continued`, MARGIN, 54, {
        font: "sansBold",
        size: 12,
        color: JADE,
      });
      canvas.text(`${number}   ${pageOf(page, pages)}`, RIGHT, 54, {
        font: "sans",
        size: 8.5,
        color: MUTED,
        align: "right",
      });
      canvas.line([MARGIN, 64], [RIGHT, 64], JADE, 1.4);
    },
  };
}

const LEFT = 28;
const DARK: Color = [0.16, 0.17, 0.2];

/** The dense printout: the dark strip and the print line, as on page one. */
export function tableBand(number: string): Band {
  return {
    top: 92,
    band: (canvas, page, pages) => {
      const width = PAGE.width - 2 * LEFT;
      canvas.rect(
        { x: LEFT, y: 30, w: width, h: 26 },
        { fill: DARK, lineWidth: 0 },
      );
      canvas.text("PURCHASE ORDER LISTING  continued", LEFT + 8, 47, {
        font: "sansBold",
        size: 10,
        color: WHITE,
      });
      canvas.text(number, LEFT + width - 8, 47, {
        font: "mono",
        size: 8,
        color: WHITE,
        align: "right",
      });
      canvas.text(`Report PO-LIST-01   ${pageOf(page, pages)}`, LEFT, 70, {
        font: "mono",
        size: 6.6,
        color: MUTED,
      });
      canvas.line([LEFT, 76], [LEFT + width, 76], DARK, 0.8);
    },
  };
}

const FRAME: Color = [0.2, 0.2, 0.24];

/** The boxed form: the title cell of page one, with the number in it. */
export function boxedBand(number: string): Band {
  return {
    top: 100,
    band: (canvas, page, pages) => {
      canvas.rect(
        { x: MARGIN, y: 36, w: CONTENT_WIDTH, h: 44 },
        { stroke: FRAME, lineWidth: 0.9 },
      );
      canvas.text("PURCHASE ORDER  continued", MARGIN + 10, 64, {
        font: "sansBold",
        size: 13,
        color: FRAME,
      });
      canvas.text(`${number}   ${pageOf(page, pages)}`, RIGHT - 10, 64, {
        font: "sans",
        size: 9,
        color: MUTED,
        align: "right",
      });
    },
  };
}
