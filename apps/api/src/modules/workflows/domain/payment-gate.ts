import {
  compareDecimal,
  sumDecimal,
  type PaymentType,
} from "@orderpilot/shared";

/** The payment types the gate counts. A deposit or a balance never opens it. */
export const GATE_TYPES: readonly PaymentType[] = [
  "prepayment",
  "full-payment",
];

/** Everything confirmed against the gate: prepayments and full payments only. */
export function gateTotal(
  payments: readonly { paymentType: PaymentType; amount: string }[],
): string {
  return sumDecimal(
    payments
      .filter((paid) => GATE_TYPES.includes(paid.paymentType))
      .map((paid) => paid.amount),
  );
}

/** Whether this much, confirmed against the gate, covers the prepayment due. */
export function covers(total: string, due: string | null): boolean {
  return due !== null && compareDecimal(total, due) >= 0;
}
