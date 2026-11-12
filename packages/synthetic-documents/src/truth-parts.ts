import type { PlantedRecord } from "./facts-base.js";
import type { PlacedField } from "./model.js";
import type { ExpectedFrom, PlanEntry } from "./plan/entry.js";
import type { PlantedMistake, TruthLine } from "./truth.js";

/**
 * The planted entry of the ground truth, from what the renderer printed. A
 * plan that names another mistake than the document prints is a bug in the
 * plan, so it is refused here, where the two meet.
 */
export function plantedOf(
  entry: PlanEntry,
  record: PlantedRecord | null,
): PlantedMistake[] {
  if ((record?.kind ?? null) !== entry.planted) {
    throw new Error(
      `${entry.stem} is planned as ${String(entry.planted)} but prints ${String(record?.kind ?? null)}`,
    );
  }
  if (!record) return [];
  const sourceOf = (fieldId: string): ExpectedFrom => {
    const declared = entry.expectedFrom[fieldId];
    if (declared) return declared;
    if (fieldId === record.primaryFieldId) {
      throw new Error(`${entry.stem} names no source for ${fieldId}`);
    }
    // An amount that follows a wrong price is right when the price is.
    return { source: "derived", fieldId: record.primaryFieldId };
  };
  return [
    {
      id: `${entry.stem}#${record.kind}`,
      kind: record.kind,
      primaryFieldId: record.primaryFieldId,
      lineIndex: record.lineIndex,
      values: record.values.map((v) => ({
        ...v,
        expectedFrom: sourceOf(v.fieldId),
      })),
      twin: entry.twin,
    },
  ];
}

/** One entry for each line of the document, from the cells its fields hold. */
export function linesOf(fields: readonly PlacedField[]): TruthLine[] {
  const lines = new Map<number, TruthLine>();
  for (const f of fields) {
    if (f.lineIndex === null) continue;
    const line = lines.get(f.lineIndex) ?? {
      lineIndex: f.lineIndex,
      page: f.page,
      values: {},
    };
    line.page = Math.min(line.page, f.page);
    line.values[f.key.replace(/^lines\./, "")] = f.value;
    lines.set(f.lineIndex, line);
  }
  return [...lines.values()].sort((a, b) => a.lineIndex - b.lineIndex);
}
