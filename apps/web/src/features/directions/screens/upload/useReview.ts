import { useCallback, useMemo, useState } from "react";
import type { DemoDocument, DemoField } from "./demoDocument";

/** What a person has done with one field: confirmed it as read, or changed it. */
export interface FieldState {
  confirmed: boolean;
  /** The text as the person edited it; null while it is as Spark read it. */
  edited: string | null;
}

export const FRESH: FieldState = { confirmed: false, edited: null };

/**
 * The fields as the list shows them: the ones Spark was unsure of first, then
 * the sure ones, each in the order of the document. A line field remembers
 * which line it is on, since the list is not grouped by line.
 */
export interface FieldSplit {
  unsure: DemoField[];
  sure: DemoField[];
}

export function splitFields(fields: readonly DemoField[]): FieldSplit {
  return {
    unsure: fields.filter((field) => field.uncertain),
    sure: fields.filter((field) => !field.uncertain),
  };
}

/** "Line 2" for a field of the second line, null for a header or totals field. */
export function lineNumber(field: DemoField): number | null {
  return field.group === "lines" ? (field.lineIndex ?? 0) + 1 : null;
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

  const split = useMemo(() => splitFields(doc.fields), [doc]);
  const waiting = split.unsure.filter((field) => !stateOf(field.id).confirmed);
  // What the person did, in the terms the end of the review reports it:
  // fields they confirmed as read, fields they corrected, and the fields the
  // reader was sure of that they left alone.
  const corrected = doc.fields.filter(
    (field) => stateOf(field.id).edited !== null,
  ).length;
  const confirmed = split.unsure.filter((field) => {
    const state = stateOf(field.id);
    return state.confirmed && state.edited === null;
  }).length;
  const readAlone = split.sure.filter(
    (field) => stateOf(field.id).edited === null,
  ).length;
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
    uncertainCount: split.unsure.length,
    done: { confirmed, corrected, readAlone },
    waitingCount: waiting.length,
    /** The first uncertain field nobody has confirmed yet, for the Next button. */
    nextWaiting: waiting[0] ?? null,
    /** The first one still waiting once the field just dealt with is set aside. */
    nextWaitingAfter: (id: string) =>
      waiting.find((field) => field.id !== id) ?? null,
    split,
  };
}
