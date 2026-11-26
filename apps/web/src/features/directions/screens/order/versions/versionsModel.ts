import type { SalesOrderDetail } from "@orderpilot/shared";

/** The two PO versions a comparison sets side by side. */
export interface VersionPair {
  from: number;
  to: number;
}

/** The previous PO version against the current one; one version has nothing to compare. */
export function defaultPair(current: number): VersionPair {
  return { from: Math.max(1, current - 1), to: current };
}

/** The earlier version can be any but the current one. */
export function fromOptions(current: number): number[] {
  return Array.from({ length: Math.max(0, current - 1) }, (_, i) => i + 1);
}

/** The later version is above the earlier one, up to the current one. */
export function toOptions(from: number, current: number): number[] {
  return Array.from(
    { length: Math.max(0, current - from) },
    (_, i) => from + i + 1,
  );
}

/**
 * Applies one choice to the pair. Choosing an earlier version at or above the
 * later one moves the later one to the next number, so the pair never inverts.
 */
export function movePair(
  pair: VersionPair,
  choice: Partial<VersionPair>,
  current: number,
): VersionPair {
  const from = Math.min(choice.from ?? pair.from, current - 1);
  const to = choice.to ?? pair.to;
  return { from, to: to > from ? Math.min(to, current) : from + 1 };
}

/** True when a pair a person chose is still inside the versions that exist. */
export function pairFits(pair: VersionPair, current: number): boolean {
  return pair.from >= 1 && pair.from < pair.to && pair.to <= current;
}

/**
 * The sentence that says nobody was told about the current PO version: only
 * when no team holds the order (it has no stage) and the number is above one.
 * Once a team holds it, the page says nothing of teams: what happened to the
 * order is on the Activity tab.
 */
export function whoHasIt(
  detail: Pick<SalesOrderDetail, "workflowStatus" | "poVersionNo">,
): "noTask" | null {
  const current = detail.poVersionNo;
  return detail.workflowStatus === null && current !== null && current > 1
    ? "noTask"
    : null;
}
