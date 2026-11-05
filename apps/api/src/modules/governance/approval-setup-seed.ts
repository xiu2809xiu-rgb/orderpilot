import type { INestApplicationContext } from "@nestjs/common";
import type { Role } from "@orderpilot/shared";
import { demoEmail } from "../../auth/demo-accounts.js";
import { UserRepository } from "../../users/user.repository.js";
import { ApprovalSetupRepository } from "./approval-setup.repository.js";
import { ApprovalSetupService } from "./approval-setup.service.js";
import type { ApprovalSetup } from "./domain/approval-setup.js";

const BY_THE_SEED = {
  actor: { kind: "system", name: "seed" },
  ip: null,
  traceId: "seed",
} as const;

const NO_LIMITS = {
  approverId: null,
  salesAmountApprovalLimit: "0.00",
  purchaseAmountApprovalLimit: "0.00",
  unlimitedSalesApproval: false,
  unlimitedPurchaseApproval: false,
  substituteUserId: null,
  awayFrom: null,
  awayUntil: null,
} as const;

/**
 * Area 4's sample approval chain for the demo accounts: the Product Manager's
 * requests go to the approver, who escalates to Management. The numbers are
 * synthetic, the same as area 2's mock, until Spectra confirms its approvers
 * and limits (A-14, A-23). There is no substitute: the demo has one approver,
 * and the Product Manager, who raises the SPRs, must never stand in for them.
 *
 * Safe to run again. A row that exists is left alone, so a limit changed since
 * is never put back.
 */
export async function seedApprovalSetups(
  app: INestApplicationContext,
): Promise<string> {
  const users = app.get(UserRepository);
  const idOf = async (role: Role) =>
    (await users.findByEmail(demoEmail(role)))?.id;
  const [requester, approver, management] = await Promise.all([
    idOf("PRODUCT_MANAGER"),
    idOf("APPROVER"),
    idOf("MANAGEMENT"),
  ]);
  if (!requester || !approver || !management) {
    return "skipped: the demo accounts are not there yet";
  }
  const rows: ApprovalSetup[] = [
    { ...NO_LIMITS, userId: requester, approverId: approver },
    {
      ...NO_LIMITS,
      userId: approver,
      approverId: management,
      salesAmountApprovalLimit: "20000.00",
      purchaseAmountApprovalLimit: "5000.00",
    },
    {
      ...NO_LIMITS,
      userId: management,
      unlimitedSalesApproval: true,
      unlimitedPurchaseApproval: true,
    },
  ];

  const setups = app.get(ApprovalSetupRepository);
  const service = app.get(ApprovalSetupService);
  let created = 0;
  for (const row of rows) {
    if (await setups.find(row.userId)) continue;
    await service.save(row, BY_THE_SEED);
    created += 1;
  }
  return `${String(created)} approval setups created, ${String(rows.length - created)} already there`;
}
