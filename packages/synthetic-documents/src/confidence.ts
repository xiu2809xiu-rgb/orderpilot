import { isUncertain } from "@orderpilot/shared";
import { PAGE } from "./canvas.js";
import {
  fieldId,
  type BoxFractions,
  type DocumentKind,
  type DraftField,
  type PlacedField,
  type Stage,
} from "./model.js";

/**
 * The fields a reader is least sure of on a customer's PO, most doubtful
 * first. A PO whose task says "Confirm the 3 uncertain fields" has the first
 * three of these, so the same task always names the same fields.
 */
export const DOUBTFUL: readonly string[] = [
  "shipTo",
  "paymentTerms",
  "lines.unitPrice[0]",
  "incoterms",
];

const COUNT_IN_TITLE = /^Confirm the (\d+) uncertain fields$/;

/**
 * How many of `DOUBTFUL` the order's review task names, or none when it has no
 * such task. The task says how many, so the documents can never disagree with
 * the inbox. Only a PO is read by Mock AI here: the other documents are made
 * or checked inside Spectra.
 */
export function reviewCount(
  orderNo: string,
  taskTitle: string | undefined,
): number {
  const count = COUNT_IN_TITLE.exec(taskTitle ?? "")?.[1];
  if (count === undefined) return 0;
  if (Number(count) > DOUBTFUL.length) {
    throw new RangeError(`Task for ${orderNo} names ${count} uncertain fields`);
  }
  return Number(count);
}

/** FNV-1a over the parts, as a fraction in [0, 1). A pure function of its input: no seed, no state. */
function hashFraction(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join("|")) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash / 2 ** 32;
}

const hundredths = (n: number): number => Math.round(n * 100) / 100;

export interface ConfidencePlan {
  /** The record the document hangs on: an order number for the original four kinds. */
  ref: string;
  kind: DocumentKind;
  stage: Stage | null;
  uncertain: ReadonlySet<string>;
  /** A scan is read from pixels, so nothing on it is better than a guess. */
  scanned: boolean;
}

function confidenceOf(plan: ConfidencePlan, id: string): number {
  // A null stage keeps the kind alone, so the files made before stages existed do not move.
  const kind = plan.stage ? `${plan.kind}:${plan.stage}` : plan.kind;
  const f = hashFraction(plan.ref, kind, id);
  if (plan.scanned) return hundredths(0.62 + f * 0.27);
  if (plan.uncertain.has(id)) return hundredths(0.55 + f * 0.31);
  return hundredths(0.935 + f * 0.06);
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Turns drawn fields into the contract's shape: boxes as fractions, and a confidence each. */
export function placeFields(
  fields: readonly DraftField[],
  plan: ConfidencePlan,
  toPage: (field: DraftField) => DraftField["box"] = (f) => f.box,
): PlacedField[] {
  return fields.map((field) => {
    const id = fieldId(field.key, field.lineIndex);
    const box = toPage(field);
    const fractions: BoxFractions = [
      round4(box.x / PAGE.width),
      round4(box.y / PAGE.height),
      round4(box.w / PAGE.width),
      round4(box.h / PAGE.height),
    ];
    const confidence = confidenceOf(plan, id);
    return {
      ...field,
      id,
      box: fractions,
      confidence,
      uncertain: isUncertain(confidence),
    };
  });
}
