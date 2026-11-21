import type { DataOrigin } from "@orderpilot/shared";

/**
 * Where the data Spark reads came from, as the destination check is told. The
 * gateway believes what it is told (ADR 0059), so this is the one place that
 * says it, and it fails closed: only the exact word "synthetic" is synthetic.
 * Anything else, an unreadable setting, an unknown word or no answer at all,
 * is real, and the policy then refuses every provider it does not trust with
 * real data.
 *
 * The question a person types goes to the provider too, and it is not
 * synthetic just because the orders are. The same switch covers it: a
 * deployment that holds real data says so once, in DATA_ORIGIN.
 */
export function originOfSetting(setting: unknown): DataOrigin {
  return setting === "synthetic" ? "synthetic" : "real";
}

/** The reader of the setting, so that a setting that throws counts as real too. */
export function declaredOrigin(read: () => unknown): DataOrigin {
  try {
    return originOfSetting(read());
  } catch {
    return "real";
  }
}
