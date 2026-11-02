import {
  Ban,
  Plus,
  Pencil,
  ListChecks,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { TFunction } from "i18next";
import { hasPermission } from "@/stores/session";
import type { Session } from "@orderpilot/shared";
import {
  ACTION_KINDS,
  needsOf,
  type ActionKind,
  type ListAction,
} from "./types";

/** New, Edit, Void, Disable and batch actions: they get a row of their own. */
export const LEFT_KINDS: readonly ActionKind[] = [
  "new",
  "edit",
  "void",
  "disable",
  "batch",
];

export function hasLeftActions<Row>(actions: readonly ListAction<Row>[]) {
  return actions.some((action) => LEFT_KINDS.includes(action.kind));
}

/** The icon an action wears when the screen names none. */
export const KIND_ICONS: Record<ActionKind, LucideIcon | null> = {
  new: Plus,
  edit: Pencil,
  void: Ban,
  disable: Ban,
  batch: ListChecks,
  import: Upload,
  export: null,
  print: null,
};

export function labelOf<Row>(action: ListAction<Row>, t: TFunction): string {
  return action.label ?? t(`actions.${action.kind}`);
}

/**
 * The actions this role may use, in the bar's order: New, Edit, Void or
 * Disable, batch, Import, Export, Print. An action the role lacks the
 * permission for is not here at all, so no button is drawn for it.
 */
export function usableActions<Row>(
  actions: readonly ListAction<Row>[],
  session: Session | null,
): ListAction<Row>[] {
  return actions
    .filter((action) => hasPermission(session, action.permission))
    .toSorted(
      (a, b) => ACTION_KINDS.indexOf(a.kind) - ACTION_KINDS.indexOf(b.kind),
    );
}

/** Why an action cannot run yet, or undefined when it can. */
export function blockedReason<Row>(
  action: ListAction<Row>,
  selected: number,
  t: TFunction,
): string | undefined {
  const needs = needsOf(action);
  if (needs === "one" && selected !== 1) return t("actions.needsOne");
  if (needs === "many" && selected === 0) return t("actions.needsMany");
  return undefined;
}
