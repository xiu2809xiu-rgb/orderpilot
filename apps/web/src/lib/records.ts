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

const declared = (match: MatchLike | undefined) =>
  (match?.handle as RecordHandle | null | undefined)?.record;

/**
 * The record number the breadcrumbs end with, from the deepest route that
 * declares one. It is all the entry bundle needs: the tab logic that reads
 * the rest (list, key) loads on the first open, from `resolveRecord`.
 */
export function recordCrumb(
  matches: readonly MatchLike[],
): { path: string; no: string } | null {
  const match = matches.findLast(declared);
  const param = declared(match)?.param;
  const no = match && param ? match.params[param] : undefined;
  return match && no ? { path: match.pathname, no } : null;
}
