import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import { atHour } from "./dates.js";
import type { Journey } from "./journey.js";
import { syntheticId } from "./records.js";
import {
  SAMPLE_SCREEN_STATES,
  type SampleOrder,
  type SamplePayment,
} from "./types.js";

/**
 * The payments each order has by now, from its terms and how far it has come:
 * the prepayment (or deposit) is expected while the order waits for it and
 * confirmed from then on; the balance (or the whole sum, on credit terms) is
 * expected once the invoice is out and confirmed when the order is closed.
 */
export function makePayments(
  orders: readonly SampleOrder[],
  journeys: readonly Journey[],
): SamplePayment[] {
  const payments: SamplePayment[] = [];
  let n = 0;
  orders.forEach((order, index) => {
    const journey = journeys[index];
    if (!journey) return;
    const rank = SAMPLE_SCREEN_STATES.indexOf(order.sampleScreenState);
    const { header, owners } = order;
    const percent = Number(header.prepaymentPercent);
    const upfront =
      percent > 0
        ? multiplyDecimal(order.total, (percent / 100).toFixed(4))
        : "0.00";
    const base = {
      orderNo: header.no,
      customerNo: header.sellToCustomerNo,
      currencyCode: "USD" as const,
    };
    const suffix = header.no.slice(3);

    if (percent > 0 && rank >= 5) {
      const paidOn = rank === 5 ? null : (journey.done.paid ?? null);
      payments.push({
        ...base,
        id: syntheticId(3, ++n),
        paymentType: percent === 30 ? "deposit" : "prepayment",
        amount: upfront,
        status: paidOn ? "confirmed" : "expected",
        dueOn: journey.dueOn ?? journey.enteredOn,
        reference: paidOn ? `TT-${suffix}-PRE` : null,
        paidOn,
        confirmedAt: paidOn ? atHour(paidOn, 6) : null,
        confirmedBy: paidOn ? owners.finance : null,
      });
    }
    if (percent < 100 && rank >= 10) {
      const paidOn = rank === 11 ? (journey.done.closed ?? null) : null;
      payments.push({
        ...base,
        id: syntheticId(3, ++n),
        paymentType: percent > 0 ? "balance" : "full-payment",
        amount: addDecimal(order.total, `-${upfront}`),
        status: paidOn ? "confirmed" : "expected",
        dueOn: journey.dueOn ?? journey.enteredOn,
        reference: paidOn ? `TT-${suffix}-BAL` : null,
        paidOn,
        confirmedAt: paidOn ? atHour(paidOn, 7) : null,
        confirmedBy: paidOn ? owners.finance : null,
      });
    }
  });
  return payments;
}
