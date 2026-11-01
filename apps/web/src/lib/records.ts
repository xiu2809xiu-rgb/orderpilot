import { matchRoutes, type Params, type RouteObject } from "react-router";

/** The kinds of record that open as a tab. Each has its own icon and words. */
export const RECORD_KINDS = [
  "order",
  "orderSteps",
  "spr",
  "document",
  "item",
  "customer",
  "vendor",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

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

function recordHandle(handle: unknown): RecordHandle["record"] {
  if (typeof handle !== "object" || handle === null) return undefined;
  return (handle as RecordHandle).record;
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** The record the deepest matching route declares, or null for any other page. */
export function recordFromMatches(
  matches: readonly MatchLike[],
): RecordRef | null {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const declared = recordHandle(match?.handle);
    if (!match || !declared) continue;
    const no = match.params[declared.param];
    if (!no) return null;
    const key = trimSlash(match.pathname);
    // The nearest page above the record is its list: /master-data/items for an item.
    const parent = matches
      .slice(0, index)
      .reverse()
      .find((above) => trimSlash(above.pathname) !== key);
    return {
      key,
      kind: declared.kind,
      no,
      listPath: parent ? trimSlash(parent.pathname) : "/",
    };
  }
  return null;
}

let table: RouteObject[] = [];

/** The router hands over its routes once, so a link can find its record without opening it. */
export function setRecordRoutes(routes: RouteObject[]): void {
  table = routes;
}

/** The record a link points at, or null when the address is not a record page. */
export function resolveRecord(to: string): RecordRef | null {
  const pathname = to.split(/[?#]/)[0] ?? to;
  const matches = matchRoutes(table, pathname);
  if (!matches) return null;
  return recordFromMatches(
    matches.map((match) => ({
      pathname: match.pathname,
      params: match.params,
      handle: match.route.handle as unknown,
    })),
  );
}
