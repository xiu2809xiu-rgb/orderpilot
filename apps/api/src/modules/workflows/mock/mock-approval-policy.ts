import { Injectable } from "@nestjs/common";
import { DEMO_PERSONAS, type ApprovalUserSetup } from "@orderpilot/shared";
import {
  ApprovalPolicy,
  type ApproverProfile,
} from "../domain/approval-policy.js";
import { mockId } from "./fixtures.js";

/**
 * The approver's own Approval User Setup row: who they escalate to, their
 * limits and their substitute. The numbers are invented for the demo. Area 4
 * replaces this class with the real policy (F-1 and its follow-ups) by
 * providing its own under the `ApprovalPolicy` token; nothing in area 2
 * changes.
 */
const APPROVER_SETUP: ApprovalUserSetup = {
  userId: mockId(901),
  approverId: mockId(902),
  salesAmountApprovalLimit: "20000.00",
  purchaseAmountApprovalLimit: "5000.00",
  unlimitedSalesApproval: false,
  unlimitedPurchaseApproval: false,
  substituteUserId: mockId(903),
};

@Injectable()
export class MockApprovalPolicy extends ApprovalPolicy {
  approverFor(requesterRole: string): Promise<ApproverProfile | null> {
    // Only the product manager raises SPRs in the sample data.
    if (requesterRole !== "PRODUCT_MANAGER") return Promise.resolve(null);
    return Promise.resolve({
      displayName: DEMO_PERSONAS.APPROVER,
      setup: APPROVER_SETUP,
      substituteName: DEMO_PERSONAS.PRODUCT_MANAGER,
    });
  }
}
