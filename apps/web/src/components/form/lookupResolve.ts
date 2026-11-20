import type { LookupOption } from "./lookup";
import type { LookupState } from "./useLookupSearch";

/**
 * The record that typed text stands for, once the search for that very text has
 * answered: the one whose number is the text, or the only one found. A Business Central
 * user types a number and presses Enter or Tab, and expects that record. Anything
 * less certain is left for the person to pick from the list. A possible match
 * is a guess at what was meant, so it is never the record the text stands for.
 */
export function resolveTyped(
  state: LookupState,
  typed: string,
): LookupOption | undefined {
  const text = typed.trim();
  if (text === "" || state.status !== "done") return undefined;
  if (state.query.trim() !== text) return undefined;
  const found = state.options.filter((option) => option.possible !== true);
  const exact = found.find(
    (option) => option.number.toLowerCase() === text.toLowerCase(),
  );
  if (exact) return exact;
  return found.length === 1 ? found[0] : undefined;
}
