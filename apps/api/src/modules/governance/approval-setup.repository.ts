import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../../database/database.js";
import type { ApprovalUserSetup as ApprovalUserSetupRow } from "../../generated/prisma/client.js";
import type { ApprovalSetup } from "./domain/approval-setup.js";

/** The only place ApprovalUserSetup is read or written. */
@Injectable()
export class ApprovalSetupRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async find(userId: string): Promise<ApprovalSetup | null> {
    const row = await this.database.client.approvalUserSetup.findUnique({
      where: { userId },
    });
    return row ? toSetup(row) : null;
  }

  async findMany(userIds: readonly string[]): Promise<ApprovalSetup[]> {
    if (userIds.length === 0) return [];
    const rows = await this.database.client.approvalUserSetup.findMany({
      where: { userId: { in: [...userIds] } },
    });
    return rows.map(toSetup);
  }

  async save(setup: ApprovalSetup): Promise<void> {
    const { userId, ...fields } = setup;
    await this.database.client.approvalUserSetup.upsert({
      where: { userId },
      create: setup,
      update: fields,
    });
  }
}

function toSetup(row: ApprovalUserSetupRow): ApprovalSetup {
  return {
    userId: row.userId,
    approverId: row.approverId,
    // The column holds whole cents, so two places lose nothing.
    salesAmountApprovalLimit: row.salesAmountApprovalLimit.toFixed(2),
    purchaseAmountApprovalLimit: row.purchaseAmountApprovalLimit.toFixed(2),
    unlimitedSalesApproval: row.unlimitedSalesApproval,
    unlimitedPurchaseApproval: row.unlimitedPurchaseApproval,
    substituteUserId: row.substituteUserId,
    awayFrom: row.awayFrom,
    awayUntil: row.awayUntil,
  };
}
