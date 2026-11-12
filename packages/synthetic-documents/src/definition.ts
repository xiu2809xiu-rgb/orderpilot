import type { DocumentType } from "@orderpilot/shared";
import type { FieldBook } from "./book.js";
import type { Canvas } from "./canvas.js";
import type { RenderContext } from "./context.js";
import type { BaseFacts } from "./facts-base.js";
import type { Direction, DocumentKind, MistakeKind, Stage } from "./model.js";
import type { Subject, SubjectRef } from "./subject.js";

export interface BuildOptions {
  stage: Stage | null;
  /** A change made at render time. Null for the cases the data itself plants. */
  mistake: MistakeKind | null;
  /** A delivery order only: draws the signature and the stamp. */
  signed: boolean;
}

export type Drawer<F extends BaseFacts> = (
  canvas: Canvas,
  facts: F,
  book: FieldBook,
) => void;

/** Everything the pipeline needs to know about one kind of document. */
export interface DocumentDefinition<F extends BaseFacts = BaseFacts> {
  kind: DocumentKind;
  /** What a classifier would answer: the contract type. A vendor packing list is a PACKING_LIST. */
  type: DocumentType;
  /** The PDF title: "Vendor proforma invoice". */
  title: string;
  /** The README column: "Vendor PI". */
  name: string;
  stemPrefix: string;
  /** What the document hangs on. */
  subject: SubjectRef["kind"];
  direction: Direction;
  /** `[]`, or the stages it may be drawn in. */
  stages: readonly Stage[];
  /** Whether it may be drawn signed. */
  signable?: boolean;
  facts(ctx: RenderContext, subject: Subject, opts: BuildOptions): F;
  fields(facts: F): FieldBook;
  draw: Drawer<F>;
  /** Field ids Mock AI may be unsure of, most doubtful first. A planted field id is never listed. */
  doubtful: readonly string[];
  /** How many of `doubtful` this document gets. Default: none. */
  doubtfulCount?(ctx: RenderContext, subject: Subject, facts: F): number;
}

export type AnyDefinition = DocumentDefinition;

/**
 * Erases the facts type once, here, so the table of kinds holds one type. A
 * definition only ever receives the facts its own `facts` made.
 */
export function defineKind<F extends BaseFacts>(
  definition: DocumentDefinition<F>,
): AnyDefinition {
  return definition as unknown as AnyDefinition;
}
