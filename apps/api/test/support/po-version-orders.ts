import type { Database } from "../../src/database/database.js";
import type { OrderCaptureState } from "../../src/generated/prisma/enums.js";

export const CREATOR = "00000000-0000-4000-8000-000000000001";
export const REVISER = "00000000-0000-4000-8000-000000000002";

let sequence = 0;

export interface StoredOrderOptions {
  readonly captureState?: OrderCaptureState;
  readonly poVersionNo?: number;
}

/**
 * A stored order with two lines of odd prices, straight through Prisma, so a
 * test starts from a known head whatever the services do. Submitted by
 * default, because only a submitted order has PO versions.
 */
export async function storedOrder(
  db: Database,
  options: StoredOrderOptions = {},
): Promise<{ id: string; orderNo: string }> {
  sequence += 1;
  const orderNo = `SO-20261126-${String(sequence).padStart(4, "0")}`;
  const row = await db.client.salesOrder.create({
    data: {
      orderNo,
      captureState: options.captureState ?? "SUBMITTED",
      customerNo: "C-10010",
      externalDocumentNo: `PO-V${String(sequence)}`,
      orderDate: new Date("2026-11-08"),
      shipmentDate: new Date("2026-12-01"),
      currencyCode: "USD",
      prepaymentPercent: "30",
      createdBy: CREATOR,
      lines: {
        create: [
          {
            lineNo: 1,
            itemNo: "ITM-0001",
            description: "First synthetic item",
            quantity: "229",
            unitPrice: "31.97",
            qtyToShip: "229",
          },
          {
            lineNo: 2,
            itemNo: "ITM-0002",
            description: "Second synthetic item",
            quantity: "4",
            unitPrice: "33.41",
            qtyToShip: "4",
          },
        ],
      },
    },
  });
  return { id: row.id, orderNo };
}
