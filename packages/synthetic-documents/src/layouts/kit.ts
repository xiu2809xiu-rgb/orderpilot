import {
  BLACK,
  PAGE,
  type Box,
  type Canvas,
  type Color,
  type TextStyle,
} from "../canvas.js";
import type { DocumentFacts } from "../facts.js";
import type { Fields } from "../fields.js";
import type { FieldSpec } from "../model.js";

export const MUTED: Color = [0.4, 0.4, 0.42];
export const RULE: Color = [0.72, 0.72, 0.74];
export const WHITE: Color = [1, 1, 1];
export const PAPER_GREY: Color = [0.95, 0.95, 0.96];

export const MARGIN = 36;
export const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;
export const RIGHT = PAGE.width - MARGIN;

/** A layout places already-built fields. It never decides what a document says. */
export type DrawLayout = (
  canvas: Canvas,
  facts: DocumentFacts,
  fields: Fields,
) => void;

export interface CaptionStyle {
  labelFont: TextStyle["font"];
  labelSize: number;
  labelColor?: Color;
  valueFont: TextStyle["font"];
  valueSize: number;
  valueColor?: Color;
  /** Distance from the label's baseline to the value's. */
  gap: number;
  upper?: boolean;
}

/** A small label with its value under it, the unit of every form. */
export function captioned(
  canvas: Canvas,
  field: FieldSpec,
  x: number,
  y: number,
  style: CaptionStyle,
  align: "left" | "right" = "left",
): Box {
  const label = style.upper ? field.label.toUpperCase() : field.label;
  canvas.text(label, x, y, {
    font: style.labelFont,
    size: style.labelSize,
    color: style.labelColor ?? MUTED,
    align,
  });
  const valueStyle: TextStyle = {
    font: style.valueFont,
    size: style.valueSize,
    color: style.valueColor ?? BLACK,
    align,
  };
  return field.text.includes("\n")
    ? canvas.putLines(
        field,
        x,
        y + style.gap,
        style.valueSize * 1.3,
        valueStyle,
      )
    : canvas.put(field, x, y + style.gap, valueStyle);
}

/** A name over its address, for Spectra's own block, which is not a field. */
export function sellerBlock(
  canvas: Canvas,
  facts: DocumentFacts,
  x: number,
  y: number,
  style: {
    bold: TextStyle["font"];
    font: TextStyle["font"];
    size: number;
    align?: "left" | "right";
  },
): void {
  const align = style.align ?? "left";
  canvas.text(facts.seller.name, x, y, {
    font: style.bold,
    size: style.size + 1,
    align,
  });
  facts.seller.address.forEach((line, i) => {
    canvas.text(line, x, y + (style.size + 3) * (i + 1), {
      font: style.font,
      size: style.size,
      color: MUTED,
      align,
    });
  });
}

/** The lowest y a page's content may reach: the stamp line sits just under it. */
export const FLOOR = PAGE.height - 50;

/** Throws when something was drawn below the printable area. */
export function assertFits(y: number, what: string): void {
  if (y > FLOOR) {
    throw new Error(
      `${what} does not fit on the page (reaches y=${y.toFixed(0)})`,
    );
  }
}
