import type { OpenRule } from "@orderpilot/shared";

/**
 * The business rules as they stand after the 5 Nov briefing: what Spectra
 * settled, and the drafts that wait for its answer (#251's questions). It only
 * reports them: the workflow reads its own configuration, and this decides
 * nothing. No rule has a screen of its own yet.
 */
export function mockOpenRules(): OpenRule[] {
  return [
    {
      id: "sprTrigger",
      value:
        "The product manager raises it from stock on hand and the last three months' sales",
      status: "confirmed",
      screen: null,
    },
    {
      id: "approvers",
      value:
        "Any one of three management approvers decides, after a coordinator routes it",
      status: "confirmed",
      screen: null,
    },
    {
      id: "approvalLimits",
      value: "None set. Limits stay a setting, off until Spectra asks for them",
      status: "open",
      screen: null,
    },
    {
      id: "approverDisagreement",
      value: "The first decision stands, and the others see it",
      status: "open",
      screen: null,
    },
    {
      id: "remarksReply",
      value: "The SPR goes back to the product manager with the remarks",
      status: "open",
      screen: null,
    },
    {
      id: "piSequence",
      value: "The PI goes to the customer first, and packing waits for payment",
      status: "open",
      screen: null,
    },
  ];
}
