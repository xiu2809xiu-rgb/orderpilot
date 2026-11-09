import { isUncertain } from "@orderpilot/shared";
import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import { PAGE } from "./canvas.js";
import {
  fieldId,
  type BoxFractions,
  type DocumentKind,
  type DraftField,
  type PlacedField,
} from "./model.js";

/**
 * The fields a reader is least sure of, most doubtful first. A PO whose task
 * says "Confirm the 3 uncertain fields" has the first three of these, so the
 * same task always names the same fields.
 */
const DOUBTFUL = [
  "shipTo",
  "paymentTerms",
  "lines.unitPrice[0]",
  "incoterms",
] as const;

const COUNT_IN_TITLE = /^Confirm the (\d+) uncertain fields$/;

/**
 * The ids of the fields Mock AI is unsure of on this order's PO. The order's
 * own task says how many, so the documents can never disagree with the inbox.
 * Only a PO is read by Mock AI here. The other documents are made or checked
 * inside Spectra, so they carry no uncertain fields even where the set still
 * lists one as to confirm.
 */
export function uncertainIds(
  dataset: SyntheticDataset,
  orderNo: string,
  kind: DocumentKind,
): ReadonlySet<string> {
  if (kind !== "CUSTOMER_PO") return new Set();
  const task = dataset.tasks.find(
    (t) => t.orderNo === orderNo && t.kind === "REVIEW_FIELDS",
  );
  const count = COUNT_IN_TITLE.exec(task?.title ?? "")?.[1];
  if (count) {
    if (Number(count) > DOUBTFUL.length) {
      throw new RangeError(
        `Task for ${orderNo} names ${count} uncertain fields`,
      );
    }
    return new Set(DOUBTFUL.slice(0, Number(count)));
  }
  return new Set();
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
  orderNo: string;
  kind: DocumentKind;
  uncertain: ReadonlySet<string>;
  /** A scan is read from pixels, so nothing on it is better than a guess. */
  scanned: boolean;
}

function confidenceOf(plan: ConfidencePlan, id: string): number {
  const f = hashFraction(plan.orderNo, plan.kind, id);
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
