import { Inject, Injectable } from "@nestjs/common";
import type {
  PaymentConfirmationInput,
  PaymentRecord,
  PaymentType,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";
import {
  Prisma,
  PaymentType as StoredPaymentType,
} from "../../generated/prisma/client.js";

/** The order already holds a confirmation of that type under that bank reference. */
export class DuplicatePaymentError extends Error {}

const STORED: Record<PaymentType, StoredPaymentType> = {
  prepayment: StoredPaymentType.PREPAYMENT,
  deposit: StoredPaymentType.DEPOSIT,
  balance: StoredPaymentType.BALANCE,
  "full-payment": StoredPaymentType.FULL_PAYMENT,
};
const READ: Record<StoredPaymentType, PaymentType> = {
  PREPAYMENT: "prepayment",
  DEPOSIT: "deposit",
  BALANCE: "balance",
  FULL_PAYMENT: "full-payment",
};

/** A payment to store: what Finance entered, on which order, and who confirmed it. */
export interface NewPayment extends PaymentConfirmationInput {
  readonly orderRef: string;
  readonly confirmedByUserId: string;
  readonly confirmedAt: Date;
}

/**
 * Finance's payment confirmations on the orders the state machine runs. The
 * sample orders keep theirs in the mock overlay, which forgets them on a
 * restart; these stay, because the order's status was moved on by them.
 */
@Injectable()
export class PaymentConfirmationRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async add(payment: NewPayment): Promise<string> {
    const client = this.database.client;
    const instance = await client.workflowInstance.findFirst({
      where: { orderRef: payment.orderRef },
      select: { id: true },
    });
    if (!instance) throw new Error(`No workflow for ${payment.orderRef}`);
    const row = await client.paymentConfirmation
      .create({
        data: {
          instanceId: instance.id,
          orderRef: payment.orderRef,
          paymentType: STORED[payment.paymentType],
          amount: payment.amount,
          currencyCode: payment.currencyCode,
          reference: payment.reference,
          paidOn: new Date(`${payment.paidOn}T00:00:00.000Z`),
          confirmedByUserId: payment.confirmedByUserId,
          confirmedAt: payment.confirmedAt,
        },
        select: { id: true },
      })
      .catch((error: unknown) => {
        // The unique key on the order, type and reference: a confirmation that raced in.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new DuplicatePaymentError();
        }
        throw error;
      });
    return row.id;
  }

  /** The order's confirmations, oldest first, with who confirmed each by name. */
  async forOrder(orderRef: string): Promise<PaymentRecord[]> {
    const client = this.database.client;
    const rows = await client.paymentConfirmation.findMany({
      where: { orderRef },
      orderBy: { confirmedAt: "asc" },
    });
    const people = await client.user.findMany({
      where: { id: { in: rows.map((row) => row.confirmedByUserId) } },
      select: { id: true, displayName: true },
    });
    const names = new Map(people.map((p) => [p.id, p.displayName]));
    return rows.map((row) => ({
      id: row.id,
      orderNo: row.orderRef,
      paymentType: READ[row.paymentType],
      amount: row.amount.toFixed(2),
      currencyCode: row.currencyCode,
      reference: row.reference,
      paidOn: row.paidOn.toISOString().slice(0, 10),
      confirmedAt: row.confirmedAt.toISOString(),
      confirmedBy: names.get(row.confirmedByUserId) ?? "Finance",
    }));
  }

  /** False when the order holds no such confirmation. */
  async remove(orderRef: string, paymentId: string): Promise<boolean> {
    const { count } = await this.database.client.paymentConfirmation.deleteMany(
      { where: { id: paymentId, orderRef } },
    );
    return count === 1;
  }
}
