import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { isTypedHere, stageWordKey } from "../orders/orderRow";

/**
 * The status card's two facts. The tracker's own words lead, then area 2's
 * label from the Orders API (a role the tracker refuses still has it), then
 * the word for an order with no stage at all. A submitted order that no team
 * holds is held by nobody, which is not the same as a value that is not set.
 */
export function stageFactsOf(input: {
  t: TFunction;
  /** The `common` namespace, for the team's name. */
  tc: TFunction;
  order: OrderTimeline | undefined;
  found: SalesOrderDetail | undefined;
}): { stageLabel: string; heldAt: string } {
  const { t, tc, order, found } = input;
  const stageLabel =
    order?.status.label ??
    found?.workflowStatus ??
    t(found ? stageWordKey(found) : "cells.notStarted");
  let heldAt = t("cells.notSet");
  if (order) heldAt = tc(`roles.${order.ownerRole}`);
  else if (found && isTypedHere(found)) heldAt = t("cells.heldNobody");
  return { stageLabel, heldAt };
}
