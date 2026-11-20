import type { TFunction } from "i18next";
import { formatQuantity } from "@/lib/format";
import { isHeldUp, positionOf, type OrderRow } from "./orderRow";

const PAYMENT_STEP = positionOf("payment");

/**
 * Why a held order is held, as far as the row itself can say, in the order a
 * person would fix them: stock, payment, then the open exceptions. It reads
 * only what the list already carries (the shortage figures, the step the status
 * belongs to, the exception count), so it costs no request. It says nothing
 * for an order that is not held up, and nothing where the row cannot tell: a
 * guess would send a person after the wrong thing.
 */
export function heldReasons(row: OrderRow, t: TFunction): string[] {
  if (!isHeldUp(row)) return [];
  const reasons: string[] = [];
  if (row.shortage) {
    reasons.push(
      t("cells.whyShort", { quantity: formatQuantity(row.shortage.shortBy) }),
    );
  }
  // The payment step is the one where the order waits for Finance to confirm.
  if (PAYMENT_STEP !== null && row.step === PAYMENT_STEP) {
    reasons.push(t("cells.whyPayment"));
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
