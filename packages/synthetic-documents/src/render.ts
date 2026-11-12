import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import { Canvas } from "./canvas.js";
import { placeFields, type ConfidencePlan } from "./confidence.js";
import { contextFor, type RenderContext } from "./context.js";
import type { BaseFacts } from "./facts-base.js";
import { applyMistake } from "./mistakes/index.js";
import {
  DEMO_LABEL,
  fieldId,
  type DocumentKind,
  type LayoutId,
  type MistakeKind,
  type PlacedField,
  type Stage,
} from "./model.js";
import { writeTextPdf, type PdfMeta } from "./pdf.js";
import { definitionOf } from "./registry.js";
import { scanPages } from "./scan.js";
import { stamp } from "./stamp.js";
import { resolve, type Subject, type SubjectRef } from "./subject.js";

export interface RenderOptions {
  /** Make it look like a photocopy: an image of the page, tilted, grey and speckled. */
  scanned?: boolean;
  /** A draft or a final, for the kinds that have them. */
  stage?: Stage | null;
  /** A change made at render time, so that a check has something to find. */
  mistake?: MistakeKind | null;
  /** A delivery order only: with its signature and stamp. */
  signed?: boolean;
}

export interface RenderedDocument {
  kind: DocumentKind;
  layout: LayoutId;
  stage: Stage | null;
  scanned: boolean;
  pageCount: number;
  bytes: Uint8Array;
  fields: PlacedField[];
  facts: BaseFacts;
  subject: Subject;
}

/**
 * Renders a document of one kind for a subject already looked up. The seam a
 * subject outside the dataset (a long order) goes through. Pure: the same
 * inputs give the same bytes, on any day.
 */
export async function renderResolved(
  ctx: RenderContext,
  subject: Subject,
  kind: DocumentKind,
  options: RenderOptions = {},
): Promise<RenderedDocument> {
  const definition = definitionOf(kind);
  const scanned = options.scanned ?? false;
  const stage = options.stage ?? null;
  const signed = options.signed ?? false;
  const mistake = options.mistake ?? null;
  if (
    stage === null
      ? definition.stages.length > 0
      : !definition.stages.includes(stage)
  ) {
    throw new RangeError(`A ${kind} cannot be drawn as ${String(stage)}`);
  }
  if (signed && !definition.signable) {
    throw new RangeError(`A ${kind} cannot be signed`);
  }
  const facts = applyMistake(
    kind,
    definition.facts(ctx, subject, { stage, mistake, signed }),
    mistake,
  );
  const book = definition.fields(facts);
  const canvas = new Canvas();
  definition.draw(canvas, facts, book);

  const missing = book.specs
    .map((s) => fieldId(s.key, s.lineIndex))
    .filter(
      (id) => !canvas.fields.some((f) => fieldId(f.key, f.lineIndex) === id),
    );
  if (missing.length > 0) {
    throw new Error(
      `The ${facts.layout} layout left out ${missing.join(", ")}`,
    );
  }
  stamp(canvas.pages);

  // A scan exists to show what a reader does with pixels alone, so its
  // metadata must not hand over the number, the kind or the order.
  const meta: PdfMeta = scanned
    ? {
        title: "Scanned document",
        subject: `${DEMO_LABEL}. Scanned document.`,
        keywords: [DEMO_LABEL],
      }
    : {
        title: `${definition.title} ${facts.number}`,
        subject: `${DEMO_LABEL}. ${definition.title} for ${subject.ref}.`,
        keywords: [DEMO_LABEL, kind, subject.ref],
      };
  const count = definition.doubtfulCount?.(ctx, subject, facts) ?? 0;
  const plan: ConfidencePlan = {
    ref: subject.ref,
    kind,
    stage: facts.stage,
    uncertain: new Set(definition.doubtful.slice(0, count)),
    scanned,
  };
  const shared = {
    kind,
    layout: facts.layout,
    stage: facts.stage,
    scanned,
    pageCount: canvas.pages.length,
    facts,
    subject,
  };
  if (scanned) {
    const scan = await scanPages(canvas.pages, meta);
    return {
      ...shared,
      bytes: scan.bytes,
      fields: placeFields(canvas.fields, plan, (f) =>
        scan.moveBox(f.box, f.page),
      ),
    };
  }
  return {
    ...shared,
    bytes: await writeTextPdf(canvas.pages, meta),
    fields: placeFields(canvas.fields, plan),
  };
}

/** Renders a document of one kind for whatever it hangs on. */
export async function renderSubject(
  dataset: SyntheticDataset,
  ref: SubjectRef,
  kind: DocumentKind,
  options: RenderOptions = {},
): Promise<RenderedDocument> {
  definitionOf(kind);
  const ctx = contextFor(dataset);
  return renderResolved(ctx, resolve(ctx, ref), kind, options);
}

/**
 * Renders one order's document of one kind to a real PDF, and says where each
 * field sits.
 */
export async function renderDocument(
  dataset: SyntheticDataset,
  orderNo: string,
  kind: DocumentKind,
  options: RenderOptions = {},
): Promise<RenderedDocument> {
  return renderSubject(dataset, { kind: "order", orderNo }, kind, options);
}
