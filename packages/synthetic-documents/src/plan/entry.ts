import type { DemoFile } from "../demo.js";
import type { DocumentKind, MistakeKind, Stage } from "../model.js";
import type { SubjectRef } from "../subject.js";

/**
 * Where the right value of a planted field comes from: the field of another
 * document of the set, a record of the data, or the primary field of the same
 * mistake (an amount follows its price, so it is "derived").
 */
export type ExpectedFrom =
  | { source: "document"; stem: string; fieldId: string }
  | {
      source: "record";
      record: "vendorBankAccounts" | "orders";
      key: string;
      property: string;
    }
  | { source: "derived"; fieldId: string };

/** One document of a set: what to render, and what it is for. */
export interface PlanEntry {
  /** The file name without its extension. Unique in a plan. */
  stem: string;
  kind: DocumentKind;
  subject: SubjectRef;
  stage: Stage | null;
  scanned: boolean;
  signed: boolean;
  /** A change the renderer makes. Null for the cases the data plants itself. */
  mistake: MistakeKind | null;
  /** What the document is a case of, whoever plants it. */
  planted: MistakeKind | null;
  /** By field id: where the right value of the primary planted field comes from. */
  expectedFrom: Readonly<Record<string, ExpectedFrom>>;
  /** The stem of the unplanted control. */
  twin: string | null;
  pairs: { stem: string; relation: "draft-of" | "final-of" }[];
  /** "bundle-air" or "bundle-sea" on a document of a complete bundle. */
  bundle: string | null;
  /** One of the twelve in apps/web/public/demo-documents. */
  committed: boolean;
  purpose: string;
}

type Extra = Partial<
  Pick<
    PlanEntry,
    "planted" | "expectedFrom" | "twin" | "pairs" | "bundle" | "mistake"
  >
>;

/** Lifts one of the twelve demo files: an order's document, with no stage. */
export function asEntry(file: DemoFile, extra: Extra = {}): PlanEntry {
  return {
    stem: file.stem,
    kind: file.kind,
    subject: { kind: "order", orderNo: file.orderNo },
    stage: null,
    scanned: file.scanned,
    signed: false,
    mistake: null,
    planted: null,
    expectedFrom: {},
    twin: null,
    pairs: [],
    bundle: null,
    committed: true,
    purpose: file.purpose,
    ...extra,
  };
}
