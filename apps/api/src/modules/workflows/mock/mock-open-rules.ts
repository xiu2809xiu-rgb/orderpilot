import type { OpenRule } from "@orderpilot/shared";
import type { ApproverProfile } from "../domain/approval-policy.js";

function usd(value: string): string {
  const amount = Number(value).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `USD ${amount}`;
}

/**
 * The rules that stay open until Spectra answers Q-4 to Q-6. The two with no
 * configuration yet carry the draft the sample data follows. Approvers, limits
 * and delegation are read from the approval policy, so this list cannot drift
 * from what the SPR page shows. It only reports a draft: it decides nothing.
 */
export function mockOpenRules(approver: ApproverProfile | null): OpenRule[] {
  const setup = approver?.setup;
  return [
    {
      id: "sprTrigger",
      value: "Raise an SPR when an order line is short of available stock",
      screen: null,
    },
    {
      id: "piSequence",
      value: "The PI goes to the customer first, and packing waits for payment",
      screen: null,
    },
    {
      id: "approversAndLimits",
      value: setup
        ? `${approver.displayName}: purchases up to ${usd(setup.purchaseAmountApprovalLimit)}, sales up to ${usd(setup.salesAmountApprovalLimit)}`
        : "No approver set up yet",
      // The role matrix holds neither the approver nor the limits, and the SPR
      // page shows them for one request only, so no screen holds this rule yet.
      screen: null,
    },
    {
      id: "delegation",
      value: approver?.substituteName
        ? `${approver.substituteName} stands in while the approver is away`
        : "Nobody stands in yet",
      screen: null,
    },
  ];
}
