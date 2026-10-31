import type { ApprovalUserSetup } from "@orderpilot/shared";

export interface ApproverProfile {
  readonly displayName: string;
  readonly setup: ApprovalUserSetup;
  /** The substitute's name, when the setup names one. */
  readonly substituteName: string | null;
}

/**
 * What area 2 asks of area 4's approval policy. Area 4 owns the limits, the
 * substitutes and the verdict "is this within your limit"; area 2 calls this
 * port and acts on the answer. Rows come in the shape of Navision's Approval
 * User Setup, so a later Navision link maps one to one.
 *
 * The base ships only a mock (`MockApprovalPolicy`). The limit check itself,
 * and the escalation above the limit, are not here: they are the SPR rules.
 */
export abstract class ApprovalPolicy {
  /** The approver for a requester (Navision "Approver ID"), or null if none is set up. */
  abstract approverFor(requesterRole: string): Promise<ApproverProfile | null>;
}
