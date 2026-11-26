import type { TFunction } from "i18next";
import { ALL_DONE, isTypedHere, type OrderRow } from "./orderRow";

/**
 * What "Held at" says for an order, one answer for the list, the peek and the
 * page. A team holds it while the tracker names one and the order is not done.
 * A submitted order that no team holds is held by nobody, which is not the
 * same as a value that is not set: a draft, a void order, a sample the tracker
 * has no row for, and a stored order a team holds but the tracker does not
 * name are all "not set".
 */
export type HeldAt =
  | { kind: "team"; role: NonNullable<OrderRow["ownerRole"]> }
  | { kind: "done" }
  | { kind: "nobody" }
  | { kind: "notSet" };

export function heldAtOf(row: OrderRow): HeldAt {
  if (row.ownerRole !== null) {
    return row.step === ALL_DONE
      ? { kind: "done" }
      : { kind: "team", role: row.ownerRole };
  }
  return isTypedHere(row) ? { kind: "nobody" } : { kind: "notSet" };
}

export function heldAtWords(
  held: HeldAt,
  t: TFunction,
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string,
): string {
  switch (held.kind) {
    case "team":
      return roleLabel(held.role);
    case "done":
      return t("cells.done");
    case "nobody":
      return t("cells.heldNobody");
    case "notSet":
      return t("cells.notSet");
  }
}
