import { z } from "zod";

/** A record a lookup can pick: its Business Central number, its name, and one detail. */
export interface LookupOption {
  number: string;
  name: string;
  /** A short extra, such as the country or the stock on hand. */
  detail?: string;
  /**
   * A look-alike name the search did not find by its text: shown under its own
   * heading, and never picked by Tab or Enter on the typed text. Only a click,
   * or the arrows and then Enter, picks it.
   */
  possible?: boolean;
}

/**
 * What a lookup field holds. The number is what a save sends, because records
 * are matched on their numbers and never on names; the name is kept so the
 * field can show both without asking again.
 */
export const lookupValueSchema = z.object({
  number: z.string().min(1),
  name: z.string(),
});
export type LookupValue = z.infer<typeof lookupValueSchema>;

/**
 * Searches for records. It must stop when `signal` aborts, since a newer search
 * has replaced it. A lookup knows nothing else about where records come from.
 */
export type LookupSearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly LookupOption[]>;

/** A lookup that must be filled in, with the page's own words for when it is not. */
export function requiredLookup(message: string) {
  return lookupValueSchema.nullable().transform((value, context) => {
    if (value !== null) return value;
    context.addIssue({ code: "custom", message });
    return z.NEVER;
  });
}

/** How a picked record reads in the field: its number, then its name. */
export function lookupText(value: LookupValue | null): string {
  return value === null ? "" : `${value.number}  ${value.name}`;
}
