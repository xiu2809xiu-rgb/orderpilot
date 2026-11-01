import { matchRoutes } from "react-router";
import { recordRoutes } from "./recordRoutes";
import { recordFromMatches, type RecordRef } from "./records";

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
