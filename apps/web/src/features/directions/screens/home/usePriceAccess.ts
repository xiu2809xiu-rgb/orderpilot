import { useOrdersList } from "@/lib/api/generated/endpoints/orders/orders";
import type { MaskableAmount } from "../orders/Amount";

/** Who may see prices does not change while a person works, so one answer serves the page. */
const FIVE_MINUTES = 5 * 60_000;

/**
 * What the page knows about prices:
 * - `visible`: the server shows this role an order's amount;
 * - `masked`: the server hides it, and `reason` is its reason code;
 * - `unknown`: no answer yet, it failed, or there is no order to ask about.
 */
export type PriceAccess =
  | { state: "visible" }
  | { state: "masked"; reason: MaskableAmount["reason"] }
  | { state: "unknown" };

const UNKNOWN: PriceAccess = { state: "unknown" };

/**
 * Whether the signed-in role may see money. The permission list holds no
 * price permission: the masking rule lives on the server and answers with the
 * amount itself, masked or not, on every order. So Home asks for one order and
 * reads that answer, the same one the Orders pages draw their masks from,
 * instead of keeping a list of role names that would drift from the rule.
 * Unknown while the answer is on its way, or when it failed or there is no
 * order to ask about: a figure a role may not see must never appear first and
 * be taken back, and a mask must not be drawn on a guess.
 */
export function usePriceAccess(): PriceAccess {
  const probe = useOrdersList(
    { pageSize: 1 },
    { query: { staleTime: FIVE_MINUTES } },
  );
  const amount = probe.data?.data[0]?.amount;
  if (amount === undefined) return UNKNOWN;
  if (amount.masked) return { state: "masked", reason: amount.reason };
  return amount.value === null ? UNKNOWN : { state: "visible" };
}
