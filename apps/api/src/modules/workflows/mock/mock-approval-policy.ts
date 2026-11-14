import { Injectable } from "@nestjs/common";
import { DEMO_PERSONAS, type ApprovalUserSetup } from "@orderpilot/shared";
import {
  ApprovalPolicy,
  type ApproverProfile,
} from "../domain/approval-policy.js";
import { mockId } from "./fixtures.js";

/**
 * The approver's own Approval User Setup row, as Spectra described it on 5 Nov:
 * any one of three management approvers decides, with no limits set and nobody
 * standing in, so no escalation either. Area 4 replaces this class with the
 * real policy (F-1 and its follow-ups) by providing its own under the
 * `ApprovalPolicy` token; nothing in area 2 changes.
 */
const APPROVER_SETUP: ApprovalUserSetup = {
  userId: mockId(901),
  approverId: null,
  salesAmountApprovalLimit: "0.00",
  purchaseAmountApprovalLimit: "0.00",
  unlimitedSalesApproval: true,
  unlimitedPurchaseApproval: true,
  substituteUserId: null,
};

@Injectable()
export class MockApprovalPolicy extends ApprovalPolicy {
  approverFor(requesterRole: string): Promise<ApproverProfile | null> {
    // Only the product manager raises SPRs in the sample data.
    if (requesterRole !== "PRODUCT_MANAGER") return Promise.resolve(null);
    return Promise.resolve({
      displayName: DEMO_PERSONAS.APPROVER,
      setup: APPROVER_SETUP,
      substituteName: null,
      escalatesToName: null,
    });
  }
}
