import type { LookupOption } from "./lookup";
import type { LookupState } from "./useLookupSearch";

/**
 * The record that typed text stands for, once the search for that very text has
 * answered: the one whose number is the text, or the only one found. A Navision
 * user types a number and presses Enter or Tab, and expects that record. Anything
 * less certain is left for the person to pick from the list.
 */
export function resolveTyped(
  state: LookupState,
  typed: string,
): LookupOption | undefined {
  const text = typed.trim();
  if (text === "" || state.status !== "done") return undefined;
  if (state.query.trim() !== text) return undefined;
  const exact = state.options.find(
    (option) => option.number.toLowerCase() === text.toLowerCase(),
  );
  if (exact) return exact;
  return state.options.length === 1 ? state.options[0] : undefined;
}
