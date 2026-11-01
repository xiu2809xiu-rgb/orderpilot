import { matchRoutes } from "react-router";
import { recordRoutes } from "./recordRoutes";
import type { MatchLike, RecordHandle, RecordRef } from "./records";

/** Drops a trailing slash, but never the root's own. */
const trimSlash = (path: string): string => path.replace(/(.)\/+$/, "$1");

/** The record the deepest matching route declares, or null for any other page. */
export function recordFromMatches(
  matches: readonly MatchLike[],
): RecordRef | null {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const declared = (match?.handle as RecordHandle | null | undefined)?.record;
    if (!match || !declared) continue;
    const no = match.params[declared.param];
    if (!no) return null;
    const key = trimSlash(match.pathname);
    // The nearest page above the record is its list: /master-data/items for an item.
    const parent = matches
      .slice(0, index)
      .findLast((above) => trimSlash(above.pathname) !== key);
    return {
      key,
      kind: declared.kind,
      no,
      listPath: parent ? trimSlash(parent.pathname) : "/",
    };
  }
  return null;
}

/**
 * The record a link points at, or null when the address is not a record page.
 * Its own module, so the entry bundle (which only reads the page on screen)
 * does not carry it: only the tab logic, which loads on the first open, does.
 */
export function resolveRecord(to: string): RecordRef | null {
  const pathname = to.split(/[?#]/)[0] ?? to;
  const matches = matchRoutes(recordRoutes(), pathname);
  if (!matches) return null;
  return recordFromMatches(
    matches.map((match) => ({
      pathname: match.pathname,
      params: match.params,
      handle: match.route.handle as unknown,
    })),
  );
}
