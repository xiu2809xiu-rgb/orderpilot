import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

/**
 * The earlier duties a caller reports, by name. Raising an SPR is not among
 * them: who raised it is the request's own requester, so it cannot be named
 * twice and disagree.
 */
export type EarlierDuty =
  "vendor-payment.approve" | "vendor-bank.change" | "payment-hold.verify";

/** Who did each earlier duty on the record, by user id. */
export type EarlierDuties = Readonly<Partial<Record<EarlierDuty, string>>>;

interface DutyPair {
  readonly earlier: EarlierDuty | "spr.raise";
  readonly later: readonly string[];
}

/**
 * The duties kept apart: whoever did the earlier one never does a later one on
 * the same record. Configuration until Spectra confirms them. F-4 started with
 * raising and approving an SPR, approving a vendor payment and clearing its
 * hold, and changing a vendor's bank details against paying that vendor. F-5
 * adds the two people a hold needs: whoever changed the details does neither
 * step, and whoever verified a hold does not also clear it.
 */
export const SEGREGATED_DUTIES: readonly DutyPair[] = [
  { earlier: "spr.raise", later: ["spr.approve"] },
  { earlier: "vendor-payment.approve", later: ["payment-hold.clear"] },
  {
    earlier: "vendor-bank.change",
    later: [
      "payment-hold.verify",
      "payment-hold.clear",
      "vendor-payment.approve",
      "vendor-payment.release",
    ],
  },
  { earlier: "payment-hold.verify", later: ["payment-hold.clear"] },
];

/** The actor did none of the earlier duties kept apart from this action. */
export class SegregationOfDutiesRule implements PolicyRule {
  readonly name = "segregation-of-duties";

  constructor(
    private readonly duties: readonly DutyPair[] = SEGREGATED_DUTIES,
  ) {}

  refusal({
    actor,
    action,
    requesterUserId,
    earlierDuties,
  }: PolicyContext): string | null {
    for (const pair of this.duties) {
      if (!pair.later.includes(action)) continue;
      const doneBy =
        pair.earlier === "spr.raise"
          ? requesterUserId
          : earlierDuties?.[pair.earlier];
      if (doneBy === actor.userId) {
        return `${pair.earlier} and ${action} are done by different people`;
      }
    }
    return null;
  }
}
