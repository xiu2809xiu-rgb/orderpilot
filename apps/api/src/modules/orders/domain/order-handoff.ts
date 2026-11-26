import type { Role } from "@orderpilot/shared";

/**
 * `applied`: this call changed the order's workflow. `none`: it changed
 * nothing, because the implementation is a stand-in, the order has no
 * workflow, or the same fact was handed over before.
 */
export type HandoffEffect = "none" | "applied";

export interface HandoffAnswer {
  readonly effect: HandoffEffect;
}

/** The person whose click made the fact. The name is what the workflow's audit row and event show. */
export interface HandoffPerson {
  readonly userId: string;
  readonly name: string;
  readonly role: Role;
}

/** Where the call came from, so the workflow's audit row leads back to the request. */
export interface HandoffRequest {
  readonly ip: string | null;
  readonly traceId: string;
}

/**
 * A stored order was submitted (ADR 0072). The numbers are decimal strings, as
 * everywhere else. The lines, their prices, the stock and the prepayment amount
 * stay out: the payment gate's arithmetic is area 2's, from `total` and
 * `prepaymentPercent`.
 */
export interface OrderSubmitted {
  readonly orderNo: string;
  readonly customerNo: string;
  readonly submittedBy: HandoffPerson;
  readonly submittedAt: Date;
  readonly total: string;
  readonly prepaymentPercent: string;
  /** 1 at a submit. */
  readonly poVersionNo: number;
  readonly request: HandoffRequest;
}

/** A person confirmed that a re-sent PO is a new version of a submitted order. */
export interface PoVersionConfirmed {
  readonly orderNo: string;
  readonly poVersionNo: number;
  readonly supersedesPoVersionNo: number;
  readonly confirmedBy: HandoffPerson;
  readonly confirmedAt: Date;
  /** The new version's total. */
  readonly total: string;
  readonly prepaymentPercent: string;
  readonly request: HandoffRequest;
}

/**
 * How area 1 tells area 2's workflow that an order was submitted or revised.
 * Area 1 is the consumer, so it declares the port; area 2 implements it, and
 * binds its class under this token with one line in `OrdersModule`.
 *
 * Each call runs inside area 1's transaction (`Database.transaction` joins an
 * open one). So a `DomainError` from the implementation rolls area 1's write
 * back, and the person sees the implementation's message as the refusal,
 * whatever their role may see: the message holds no price, total or bank
 * detail. A call that is repeated with the same fact has the effect of one
 * call. An order with no workflow answers `none` and does not throw.
 *
 * `order-handoff.contract.ts` holds the checks that any implementation can run.
 */
export abstract class OrderHandoff {
  abstract submitted(fact: OrderSubmitted): Promise<HandoffAnswer>;
  abstract poVersionConfirmed(fact: PoVersionConfirmed): Promise<HandoffAnswer>;
}
