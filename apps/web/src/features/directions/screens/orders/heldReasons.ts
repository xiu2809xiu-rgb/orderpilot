import type { TFunction } from "i18next";
import { formatQuantity } from "@/lib/format";
import { isHeldUp, type OrderRow } from "./orderRow";

/**
 * Why a held order is held, as far as the row itself can say, in the order a
 * person would fix them: stock, then the open exceptions. It reads only what
 * the list already carries (the shortage figures and the exception count), so
 * it costs no request. It says nothing for an order that is not held up, and
 * nothing where the row cannot tell: a guess would send a person after the
 * wrong thing. It says nothing about a payment: the row holds no payment, only
 * the step its status belongs to, and that step can still read "payment" after
 * Finance has confirmed one (the order's state moves on its own clock). The
 * stage beside the line already says "Waiting for payment".
 */
export function heldReasons(row: OrderRow, t: TFunction): string[] {
  if (!isHeldUp(row)) return [];
  const reasons: string[] = [];
  if (row.shortage) {
    reasons.push(
      t("cells.whyShort", { quantity: formatQuantity(row.shortage.shortBy) }),
    );
  }
  if (row.openExceptions > 0) {
    reasons.push(t("cells.exceptions", { count: row.openExceptions }));
  }
  return reasons;
}

/** The first reason, and how many more there are, as one line. The tooltip lists them all. */
export function heldLine(reasons: readonly string[], t: TFunction): string {
  const [first = "", ...rest] = reasons;
  return rest.length > 0
    ? t("cells.whyMore", { reason: first, count: rest.length })
    : first;
}
