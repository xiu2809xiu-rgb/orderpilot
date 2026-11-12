import { addDecimal } from "@orderpilot/shared";
import { Canvas, PAGE, type DrawOp } from "../canvas.js";
import type { RenderContext } from "../context.js";
import type { BaseFacts } from "../facts-base.js";
import { inkExtent } from "../fonts.js";
import type { DraftField, DocumentKind } from "../model.js";
import { definitionOf } from "../registry.js";
import { resolve, type Subject } from "../subject.js";

/**
 * The lowest y a page may be drawn to. Written out here, and not read from the
 * layouts' own constant, so a test that moves that constant is caught.
 */
export const PRINTABLE = PAGE.height - 50;

export function longSubject(ctx: RenderContext, no: string): Subject {
  return resolve(ctx, { kind: "long-order", no });
}

/** The same long order cut down to its first `count` lines. */
export function withLines(subject: Subject, count: number): Subject {
  const { order } = subject;
  if (!order) throw new Error("A long order is an order");
  const lines = order.lines.slice(0, count);
  const cut = {
    ...order,
    lines,
    total: lines.reduce((sum, l) => addDecimal(sum, l.lineAmount), "0.00"),
  };
  return { ...subject, order: cut, pinnedOrder: cut };
}

export interface Drawn {
  canvas: Canvas;
  facts: BaseFacts;
  fields: DraftField[];
}

/** A document drawn onto a canvas and not written out: fast enough to sweep. */
export function drawn(
  ctx: RenderContext,
  subject: Subject,
  kind: DocumentKind,
): Drawn {
  const definition = definitionOf(kind);
  const facts = definition.facts(ctx, subject, {
    stage: null,
    mistake: null,
    signed: false,
  });
  const canvas = new Canvas();
  definition.draw(canvas, facts, definition.fields(facts));
  return { canvas, facts, fields: canvas.fields };
}

/** How far down a mark reaches: a letter to its descender, a box to its edge. */
export function reach(op: DrawOp): number {
  if (op.kind === "text") {
    return op.y + inkExtent(op.font, op.text, op.size).fall;
  }
  if (op.kind === "rect") return op.box.y + op.box.h;
  return Math.max(op.from[1], op.to[1]);
}

export const lowest = (pages: readonly (readonly DrawOp[])[]): number =>
  Math.max(...pages.flatMap((ops) => ops.map(reach)));

/** The page a line's fields sit on, by line, from 1. */
export function pageOfLines(
  fields: readonly Pick<DraftField, "key" | "lineIndex" | "page">[],
): number[] {
  const pages: number[] = [];
  for (const f of fields) {
    if (f.key === "lines.partNumber" && f.lineIndex !== null) {
      pages[f.lineIndex] = f.page;
    }
  }
  return pages;
}
