import type { Params } from "react-router";

/** The kinds of record that open as a tab. Each has its own icon and words. */
export type RecordKind =
  "order" | "orderSteps" | "spr" | "document" | "item" | "customer" | "vendor";

/**
 * What a record route puts in its `handle`, in one line:
 * `handle: { record: { kind: "item", param: "no" } }`. The kind names the
 * record, and `param` is the URL parameter that holds its number.
 */
export interface RecordHandle {
  record?: { kind: RecordKind; param: string };
}

/** A record page, as the tab strip and the breadcrumbs see it. */
export interface RecordRef {
  /** The record page's path. Two links to the same page are one tab. */
  key: string;
  kind: RecordKind;
  no: string;
  /** The list the record belongs to, where closing its last tab lands. */
  listPath: string;
}

/** The parts of a route match this module reads: `useMatches` and `matchRoutes` both give them. */
export interface MatchLike {
  pathname: string;
  params: Params;
  handle?: unknown;
}

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
