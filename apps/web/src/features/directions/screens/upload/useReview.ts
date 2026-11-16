import { useCallback, useMemo, useState } from "react";
import type { DemoDocument, DemoField } from "./demoDocument";

/** What a person has done with one field: confirmed it as read, or changed it. */
export interface FieldState {
  confirmed: boolean;
  /** The text as the person edited it; null while it is as Spark read it. */
  edited: string | null;
}

export const FRESH: FieldState = { confirmed: false, edited: null };

/** The fields grouped as the list shows them: header, each line, totals. */
export interface FieldGroups {
  header: DemoField[];
  lines: { number: number; fields: DemoField[] }[];
  totals: DemoField[];
}

export function groupFields(fields: readonly DemoField[]): FieldGroups {
  const lines = new Map<number, DemoField[]>();
  for (const field of fields) {
    if (field.group !== "lines") continue;
    const index = field.lineIndex ?? 0;
    lines.set(index, [...(lines.get(index) ?? []), field]);
  }
  return {
    header: fields.filter((field) => field.group === "header"),
    lines: [...lines.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, group]) => ({ number: index + 1, fields: group })),
    totals: fields.filter((field) => field.group === "totals"),
  };
}

/**
 * The review of one document: which field is selected (the box on the page and
 * the row in the list light together), what the person has confirmed or
 * edited, and what is still waiting. A field Spark was unsure of stays
 * "Requires approval" until a person confirms it or saves a correction.
 */
export function useReview(doc: DemoDocument) {
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [states, setStates] = useState<Record<string, FieldState>>({});
  const [finished, setFinished] = useState(false);

  const stateOf = useCallback(
    (id: string): FieldState => states[id] ?? FRESH,
    [states],
  );
  const select = useCallback((field: DemoField) => {
    setSelected(field.id);
    setPage(field.page);
  }, []);
  const confirm = useCallback((id: string) => {
    setStates((all) => ({
      ...all,
      [id]: { edited: all[id]?.edited ?? null, confirmed: true },
    }));
  }, []);
  const edit = useCallback((id: string, text: string) => {
    setStates((all) => ({ ...all, [id]: { edited: text, confirmed: true } }));
  }, []);

  const uncertain = useMemo(
    () => doc.fields.filter((field) => field.uncertain),
    [doc],
  );
  const waiting = uncertain.filter((field) => !stateOf(field.id).confirmed);
  return {
    selected,
    page,
    setPage,
    select,
    confirm,
    edit,
    stateOf,
    finished,
    finish: () => {
      setFinished(true);
    },
    uncertainCount: uncertain.length,
    waitingCount: waiting.length,
    /** The first uncertain field nobody has confirmed yet, for the Next button. */
    nextWaiting: waiting[0] ?? null,
    groups: useMemo(() => groupFields(doc.fields), [doc]),
  };
}
