import type { CheckResult, SalesOrderDetail } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { formatQuantity } from "@/lib/format";

export interface StatusInput {
  /** The order's shortage, if the data names one. */
  detail: Pick<SalesOrderDetail, "shortage" | "shortageCount" | "lines"> | null;
  /** The checks the tracker ran on the order. A failed one is what holds it. */
  checks: readonly CheckResult[];
  /**
   * The order is held by no team, so a shortage is stock information and not
   * the reason it is held: it is worded as one, and no check is read.
   */
  asStock?: boolean;
}

/**
 * The words for a failed rule, by the rule's id. The ids are the sample rules
 * of the tracker's mock; a rule this does not know is still said, by its own
 * label, so a new rule never makes the page silent about a hold.
 */
const CHECK_WORDS: Readonly<Record<string, string>> = {
  "mock.sample-quantity": "quantity",
  "mock.sample-price": "price",
};

/**
 * Why a failed check holds the order, or null when no check failed. The
 * first failed check speaks; a second is not guessed at, and the Checks tab
 * lists every one.
 */
function whyFailed(
  t: TFunction,
  checks: readonly CheckResult[],
): string | null {
  const failed = checks.find((check) => check.outcome === "fail");
  if (!failed) return null;
  const words = CHECK_WORDS[failed.ruleId];
  return words
    ? t(`order.status.why.check.${words}`)
    : t("order.status.why.checkOther", { label: failed.ruleLabel });
}

/**
 * The shortage in words, or null when the order's data names none. `scope` is
 * the group of keys: "why" says it as the reason for a hold, "stock" says it as
 * a fact about stock that no team is acting on.
 */
function whyShort(
  t: TFunction,
  detail: StatusInput["detail"],
  scope: "why" | "stock" = "why",
): string | null {
  const gap = detail?.shortage;
  if (!detail || !gap) return null;
  // Items are matched on their Navision number, never on a name.
  const line = detail.lines.find(
    (candidate) => candidate.itemNo === gap.itemNo,
  );
  const values = {
    quantity: formatQuantity(gap.shortBy),
    item: line?.description ?? gap.itemNo,
  };
  return detail.shortageCount > 1
    ? t(`order.status.${scope}.shortMore`, {
        ...values,
        count: detail.shortageCount - 1,
      })
    : t(`order.status.${scope}.short`, values);
}

/**
 * The one reason the order is held, when the data gives one: a shortage, or
 * else the first failed check. Current Stage and Held at are the page's own
 * facts already, so this says only what they do not. With no reason there is
 * nothing left for it to add, so it says nothing.
 */
export function statusSentence(t: TFunction, input: StatusInput): string {
  // The stock sentence is whole: it already says that no team holds the order.
  if (input.asStock) return whyShort(t, input.detail, "stock") ?? "";
  const why = whyShort(t, input.detail) ?? whyFailed(t, input.checks);
  return why ? t("order.status.whyOnly", { why }) : "";
}
