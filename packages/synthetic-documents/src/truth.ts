import { CONFIDENCE_HIGH, type DocumentType } from "@orderpilot/shared";
import { PAGE } from "./canvas.js";
import {
  DEMO_LABEL,
  type Direction,
  type DocumentKind,
  type Issuer,
  type MistakeKind,
  type PlacedField,
  type Stage,
} from "./model.js";
import type { ExpectedFrom, PlanEntry } from "./plan/entry.js";
import { linesOf, plantedOf } from "./truth-parts.js";
import { definitionOf } from "./registry.js";
import type { RenderedDocument } from "./render.js";
import { tiltOf } from "./scan.js";

export type ExpectedValue = ExpectedFrom;

/** A field of the ground truth: `planted` is true where the document is wrong on purpose. */
export interface TruthField extends PlacedField {
  planted: boolean;
}

export interface TruthLine {
  lineIndex: number;
  page: number;
  /** Keyed by the part of the field key after "lines.": partNumber, quantity, unitPrice. */
  values: Record<string, string>;
}

export interface PlantedMistake {
  /** `${stem}#${kind}` */
  id: string;
  kind: MistakeKind;
  /** The field a person would fix. The others in `values` follow from it. */
  primaryFieldId: string;
  lineIndex: number | null;
  values: {
    fieldId: string;
    printed: string;
    expected: string;
    expectedFrom: ExpectedValue;
  }[];
  /** The stem of the unplanted control. */
  twin: string | null;
}

export interface GroundTruth {
  // Today's keys, in their order, unchanged.
  label: typeof DEMO_LABEL;
  file: string;
  /** The contract's type. `kind` below is the renderer's id. */
  documentType: DocumentType;
  documentNumber: string;
  layout: string;
  /** "image" when the file has no text in it, so a reader can only see it. */
  readable: "text" | "image";
  /** Null on a vendor document. */
  orderNo: string | null;
  customerNo: string | null;
  purpose: string;
  pageCount: number;
  /** Page size in points: boxes are fractions of it, from the top-left corner. */
  page: { width: number; height: number };
  /** A field below this is uncertain. It is the shared constant, not a copy. */
  confidenceThreshold: number;
  uncertainFieldCount: number;
  /** Set on the packing list that disagrees with its PO. Derived from the quantity case in `planted`. */
  mismatch: {
    lineIndex: number;
    partNumber: string;
    ordered: string;
    packed: string;
  } | null;
  fields: TruthField[];
  // New in version 2.
  schemaVersion: 2;
  stem: string;
  kind: DocumentKind;
  stage: Stage | null;
  issuer: Issuer;
  issuerName: string;
  direction: Direction;
  scan: { dpi: 100; pages: number; tiltDegrees: number[] } | null;
  pages: { page: number; width: number; height: number }[];
  links: {
    vendorNo: string | null;
    purchaseOrderNo: string | null;
    sprRecordNo: string | null;
    paymentReference: string | null;
    poNumber: string | null;
    /** "bundle-air" or "bundle-sea" on a document of a complete bundle. */
    bundle: string | null;
    related: {
      stem: string;
      relation: "draft-of" | "final-of" | "twin-of" | "expected-from";
    }[];
  };
  lines: TruthLine[];
  /** Zero or one entry: a document is a case of one mistake. */
  planted: PlantedMistake[];
  counts: {
    fieldCount: number;
    uncertainFieldCount: number;
    plantedCount: number;
    lineCount: number;
  };
}

/**
 * The ground truth of one document: what it says, where, how sure Mock AI is,
 * what it is tied to and what is wrong with it on purpose. `plan` is the set
 * the document belongs to, so a stem it names must be in it.
 */
export function groundTruth(
  entry: PlanEntry,
  rendered: RenderedDocument,
  plan: readonly PlanEntry[],
): GroundTruth {
  const { facts, subject } = rendered;
  const planted = plantedOf(entry, facts.planted);
  const plantedIds = new Set(
    planted.flatMap((p) => p.values.map((v) => v.fieldId)),
  );
  const related: GroundTruth["links"]["related"] = [
    ...entry.pairs.map((p) => ({ stem: p.stem, relation: p.relation })),
    ...(entry.twin ? [{ stem: entry.twin, relation: "twin-of" as const }] : []),
    ...planted
      .flatMap((p) => p.values.map((v) => v.expectedFrom))
      .flatMap((from) =>
        from.source === "document"
          ? [{ stem: from.stem, relation: "expected-from" as const }]
          : [],
      )
      .filter((r, i, all) => all.findIndex((o) => o.stem === r.stem) === i),
  ];
  for (const { stem } of related) {
    if (!plan.some((e) => e.stem === stem)) {
      throw new Error(`${entry.stem} names ${stem}, which is not in the plan`);
    }
  }
  const quantity = planted.find((p) => p.kind === "quantity");
  const line = facts.lines[0];
  const primary = quantity?.values[0];
  const fields: TruthField[] = rendered.fields.map((f) => ({
    ...f,
    planted: plantedIds.has(f.id),
  }));
  const lines = linesOf(rendered.fields);
  const uncertain = rendered.fields.filter((f) => f.uncertain).length;
  return {
    label: DEMO_LABEL,
    file: `${entry.stem}.pdf`,
    documentType: definitionOf(entry.kind).type,
    documentNumber: facts.number,
    layout: rendered.layout,
    readable: entry.scanned ? "image" : "text",
    orderNo: facts.orderNo,
    customerNo: facts.customerNo,
    purpose: entry.purpose,
    pageCount: rendered.pageCount,
    page: { width: PAGE.width, height: PAGE.height },
    confidenceThreshold: CONFIDENCE_HIGH,
    uncertainFieldCount: uncertain,
    mismatch:
      quantity && primary && line
        ? {
            lineIndex: 0,
            partNumber: line.partNumber,
            ordered: primary.expected,
            packed: primary.printed,
          }
        : null,
    fields,
    schemaVersion: 2,
    stem: entry.stem,
    kind: entry.kind,
    stage: rendered.stage,
    issuer: facts.issuer.kind,
    issuerName: facts.issuer.name,
    direction: definitionOf(entry.kind).direction,
    scan: entry.scanned
      ? {
          dpi: 100,
          pages: rendered.pageCount,
          tiltDegrees: Array.from(
            { length: rendered.pageCount },
            (_, i) => tiltOf(i + 1).degrees,
          ),
        }
      : null,
    pages: Array.from({ length: rendered.pageCount }, (_, i) => ({
      page: i + 1,
      width: PAGE.width,
      height: PAGE.height,
    })),
    links: {
      vendorNo: facts.vendorNo,
      purchaseOrderNo: subject.purchaseOrder?.no ?? null,
      sprRecordNo: subject.spr?.recordNo ?? null,
      paymentReference: subject.payment?.reference ?? null,
      poNumber: facts.poNumber,
      bundle: entry.bundle,
      related,
    },
    lines,
    planted,
    counts: {
      fieldCount: fields.length,
      uncertainFieldCount: uncertain,
      plantedCount: planted.length,
      lineCount: lines.length,
    },
  };
}
