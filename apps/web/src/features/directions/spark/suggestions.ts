import type { SparkKind } from "./useSparkChat";

/** A question Spark really has a scripted answer for. */
export interface Suggestion {
  kind: Exclude<SparkKind, "other">;
  /** The sales question is only offered to a role that may read sales. */
  needsSales: boolean;
}

const ALL: readonly Suggestion[] = [
  { kind: "stock", needsSales: false },
  { kind: "trend", needsSales: true },
];

/** The questions this role can really be answered, in the order they are offered. */
export function suggestionsFor(mayReadSales: boolean): readonly Suggestion[] {
  return ALL.filter((suggestion) => mayReadSales || !suggestion.needsSales);
}
