import type {
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
 * What happens next, in words. A step that is short of stock goes to a
 * Management approver as a request to buy, unless the approver already holds
 * the order: then the sentence would say the same team twice, so it moves on to
 * the step after. The last step has nothing next.
 */
function nextWords(
  t: TFunction,
  team: (role: Role) => string,
  input: StatusInput,
  journey: Journey,
): string | null {
  const here = journey.steps.find((step) => step.state === "now");
  if (!here) return null;
  const short = Boolean(input.detail?.shortage);
  if (here.id === "stock" && short && input.heldBy !== "APPROVER") {
    return t("order.status.next.approval", { team: team("APPROVER") });
  }
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
  const next = nextWords(t, team, input, journey);
  if (next === null) {
    return t(why ? "order.status.lastWhy" : "order.status.last", values);
  }
  return t(why ? "order.status.openWhy" : "order.status.open", {
    ...values,
    next,
  });
}
