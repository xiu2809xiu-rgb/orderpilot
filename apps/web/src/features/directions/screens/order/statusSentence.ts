import type {
  CheckResult,
  OrderCaptureState,
  Role,
  SalesOrderDetail,
} from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { formatQuantity } from "@/lib/format";
import { ALL_DONE } from "../orders/orderRow";
import type { Journey } from "./journeyModel";

export interface StatusInput {
  /** Null when the tracker does not know the order, or the role may not read it. */
  journey: Journey | null;
  /** The team the tracker says holds the order: the page's "Held at". */
  heldBy: Role | null;
  /** The stage as the page shows it. */
  stage: string;
  entry: OrderCaptureState | null;
  detail: Pick<SalesOrderDetail, "shortage" | "shortageCount" | "lines"> | null;
  /** The checks the tracker ran on the order. A failed one is what holds it. */
  checks: readonly CheckResult[];
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
 * Why a failed check holds the order, or null when no check failed. The failed
 * check is the signal rather than the tracker's status code, because a status
 * is a label the mock writes for one stage, while a check is what actually
 * found the difference and stays the same when area 3's engine replaces the
 * mock. The first failed check speaks; a second is not guessed at.
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

/** The shortage in words, or null when the order's data names none. */
function whyShort(t: TFunction, detail: StatusInput["detail"]): string | null {
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
    ? t("order.status.why.shortMore", {
        ...values,
        count: detail.shortageCount - 1,
      })
    : t("order.status.why.short", values);
}

/**
 * What happens next, in words: the step after the page's own journey step. The
 * last step has nothing next.
 */
function nextWords(
  t: TFunction,
  team: (role: Role) => string,
  journey: Journey,
): string | null {
  const here = journey.steps.find((step) => step.state === "now");
  if (!here) return null;
  const after = journey.steps[here.position];
  if (!after) return null;
  return t(`order.status.next.${after.id}`, { team: team(after.team) });
}

/**
 * The one sentence under the title: who has the order, why when the data says
 * why, and what comes next. Who has it and the stage are the page's own facts,
 * so the sentence never disagrees with them; the next step is the one after the
 * page's own journey step.
 */
export function statusSentence(
  t: TFunction,
  team: (role: Role) => string,
  input: StatusInput,
): string {
  const { journey, heldBy } = input;
  const why = whyShort(t, input.detail);
  if (input.entry === "draft") return t("order.status.draft");
  if (input.entry === "void") return t("order.status.void");
  if (journey && journey.current >= ALL_DONE) return t("order.status.done");
  if (!journey || !heldBy) {
    return why
      ? t("order.status.stageWhy", { stage: input.stage, why })
      : t("order.status.stage", { stage: input.stage });
  }
  const values = { team: team(heldBy), why };
  // ADR 0049, decision 2: a short order is held and the customer is asked to
  // revise the PO, so it raises no request to buy. The page's journey has no
  // approval step either, so the sentence names no next step for it.
  const here = journey.steps.find((step) => step.state === "now");
  if (why && here?.id === "stock") return t("order.status.held", values);
  // A failed check holds the order where it is: who has it and why, and no next
  // step, because the order does not go on until the difference is settled.
  const failed = whyFailed(t, input.checks);
  if (failed) return t("order.status.held", { team: values.team, why: failed });
  const next = nextWords(t, team, journey);
  if (next === null) {
    return t(why ? "order.status.lastWhy" : "order.status.last", values);
  }
  return t(why ? "order.status.openWhy" : "order.status.open", {
    ...values,
    next,
  });
}
