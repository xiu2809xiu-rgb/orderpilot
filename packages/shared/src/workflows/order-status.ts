import { z } from "zod";

/**
 * Every status an order can have. Area 2's state machine is the only code that
 * sets one. Other areas may read these names to show an order, and never set
 * them or work one out for themselves.
 */
export const ORDER_STATUSES = [
  "Received",
  "Confirmed",
  "StockChecked",
  "AwaitingSpr",
  "SprApproved",
  "AwaitingPayment",
  "Paid",
  "Packing",
  "Invoiced",
  "Released",
  "AwaitingShippingDocuments",
  "Closed",
  "OnHold",
  "Cancelled",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** What put an order on hold: area 3's checks, or area 4's payment hold. */
export const HOLD_SOURCES = ["check", "payment"] as const;
export const holdSourceSchema = z.enum(HOLD_SOURCES);
export type HoldSource = z.infer<typeof holdSourceSchema>;
