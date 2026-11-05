import {
  compareDecimal,
  type HoldSource,
  type NavisionStatus,
  type OrderStatus,
  type PaymentType,
  type Role,
} from "@orderpilot/shared";
import { ConflictError, DomainError } from "../../../common/domain-error.js";

/** Who made a transition. The fields match `WorkflowEvent`'s actor columns. */
export type OrderActor =
  | {
      readonly kind: "user";
      readonly userId: string;
      readonly name: string;
      readonly role: Role;
    }
  | { readonly kind: "system"; readonly name: string };

/** What one order's state machine needs to know, and nothing else about the order. */
export interface OrderSnapshot {
  readonly status: OrderStatus;
  /** The prepayment that must be confirmed before packing; null when none is asked for. */
  readonly prepaymentDue: string | null;
  /** The answer of the stock check; null until it has run. */
  readonly stockCoversOrder: boolean | null;
  /** Everything holding the order. An order can be held for two reasons at once. */
  readonly holds: readonly HoldSource[];
  /** Where a held order returns to; null when it is not on hold. */
  readonly resumeTo: OrderStatus | null;
}

export type OrderCommand =
  | {
      readonly type: "FIELDS_CONFIRMED";
      readonly allFieldsConfirmed: boolean;
    }
  | { readonly type: "STOCK_CHECKED"; readonly stockCoversOrder: boolean }
  | { readonly type: "SPR_RAISED" }
  | { readonly type: "SPR_APPROVED" }
  | { readonly type: "SPR_REJECTED"; readonly reason: string }
  | { readonly type: "PI_SENT" }
  | {
      readonly type: "PAYMENT_CONFIRMED";
      readonly paymentType: PaymentType;
      /** Everything confirmed so far against the prepayment. */
      readonly amount: string;
    }
  | { readonly type: "PACKING_STARTED" }
  | { readonly type: "INVOICED" }
  | { readonly type: "RELEASED" }
  | { readonly type: "SHIPPING_DETAILS_SENT" }
  | { readonly type: "SHIPPING_DOCUMENTS_RECEIVED" }
  | {
      readonly type: "HOLD_RAISED";
      readonly source: HoldSource;
      readonly reason: string;
    }
  | { readonly type: "HOLD_CLEARED"; readonly source: HoldSource }
  | { readonly type: "CANCELLED"; readonly reason: string };

export type OrderCommandType = OrderCommand["type"];

/** One fact about an order: who did what, when, and the status before and after. */
export interface OrderEvent {
  readonly type: OrderCommandType | "ORDER_STARTED";
  /** Null only on the event that starts the order. */
  readonly from: OrderStatus | null;
  readonly to: OrderStatus;
  readonly actor: OrderActor;
  readonly at: Date;
  readonly reason: string | null;
  readonly data: Readonly<Record<string, string>> | null;
}

export interface OrderTransitionResult {
  readonly state: OrderSnapshot;
  readonly event: OrderEvent;
}

/**
 * Rules Spectra has not confirmed yet, so they are settings and not code
 * (assumption A-21). Which role does what is not here: it is in the table.
 */
export interface OrderFlowRules {
  /** A shortfall must go through an approved SPR before the PI can be sent. */
  readonly sprRequiredOnShortfall: boolean;
}

export const DEFAULT_ORDER_FLOW_RULES: OrderFlowRules = {
  sprRequiredOnShortfall: true,
};

/** `SYSTEM`: another area reports it. No person can press it directly. */
const SYSTEM = "SYSTEM";

/** `RESUME`: back to wherever the order was when it was held. */
const RESUME = "RESUME";

interface Transition {
  readonly on: OrderCommandType;
  readonly from: readonly OrderStatus[];
  readonly to: OrderStatus | typeof RESUME;
  readonly by: Role | typeof SYSTEM;
}

// Goods have left once an order is Released, so these cannot be cancelled.
const CANCELLABLE: readonly OrderStatus[] = [
  "Received",
  "Confirmed",
  "StockChecked",
  "AwaitingSpr",
  "SprApproved",
  "AwaitingPayment",
  "Paid",
  "Packing",
  "Invoiced",
];

/**
 * The sales flow as data, and the one place that says what can follow what. A
 * new step is a new row here with its tests. When a legal move still has to be
 * refused (the payment gate, say), that is `refusalOf`, below.
 */
const TRANSITIONS: readonly Transition[] = [
  {
    on: "FIELDS_CONFIRMED",
    from: ["Received"],
    to: "Confirmed",
    by: "SUPPORT",
  },
  {
    on: "STOCK_CHECKED",
    from: ["Confirmed"],
    to: "StockChecked",
    by: "PRODUCT_MANAGER",
  },
  {
    on: "SPR_RAISED",
    from: ["StockChecked"],
    to: "AwaitingSpr",
    by: "PRODUCT_MANAGER",
  },
  {
    on: "SPR_APPROVED",
    from: ["AwaitingSpr"],
    to: "SprApproved",
    by: "APPROVER",
  },
  // Back to the stock check, so that a corrected SPR is raised and approved
  // afresh. If the stock is short, the PI stays blocked until one is.
  {
    on: "SPR_REJECTED",
    from: ["AwaitingSpr"],
    to: "StockChecked",
    by: "APPROVER",
  },
  {
    on: "PI_SENT",
    from: ["StockChecked", "SprApproved"],
    to: "AwaitingPayment",
    by: "SUPPORT",
  },
  {
    on: "PAYMENT_CONFIRMED",
    from: ["AwaitingPayment"],
    to: "Paid",
    by: "FINANCE",
  },
  {
    on: "PACKING_STARTED",
    from: ["AwaitingPayment", "Paid"],
    to: "Packing",
    by: "WAREHOUSE",
  },
  { on: "INVOICED", from: ["Packing"], to: "Invoiced", by: "SUPPORT" },
  { on: "RELEASED", from: ["Invoiced"], to: "Released", by: "WAREHOUSE" },
  {
    on: "SHIPPING_DETAILS_SENT",
    from: ["Released"],
    to: "AwaitingShippingDocuments",
    by: "SUPPORT",
  },
  {
    on: "SHIPPING_DOCUMENTS_RECEIVED",
    from: ["AwaitingShippingDocuments"],
    to: "Closed",
    by: "LOGISTICS",
  },
  {
    on: "HOLD_RAISED",
    from: [...CANCELLABLE, "Released", "AwaitingShippingDocuments", "OnHold"],
    to: "OnHold",
    by: SYSTEM,
  },
  { on: "HOLD_CLEARED", from: ["OnHold"], to: RESUME, by: SYSTEM },
  {
    on: "CANCELLED",
    from: [...CANCELLABLE, "OnHold"],
    to: "Cancelled",
    by: "SUPPORT",
  },
];

/** Payment types that satisfy the gate. A deposit or a balance does not. */
const GATE_PAYMENT_TYPES: readonly PaymentType[] = [
  "prepayment",
  "full-payment",
];

/**
 * Where OrderPilot's states meet Navision's Sales Header Status: an assumption
 * to confirm at the briefing call. Closed and Cancelled are ours alone.
 */
export function navisionStatusOf(state: OrderSnapshot): NavisionStatus | null {
  const status = state.status === "OnHold" ? state.resumeTo : state.status;
  switch (status) {
    case "AwaitingSpr":
      return "Pending Approval";
    case "AwaitingPayment":
      return state.prepaymentDue === null ? "Open" : "Pending Prepayment";
    case "Paid":
    case "Packing":
    case "Invoiced":
    case "Released":
    case "AwaitingShippingDocuments":
      return "Released";
    case "Closed":
    case "Cancelled":
    case "OnHold":
    case null:
      return null;
    default:
      return "Open";
  }
}

/**
 * The order state machine for the sales flow, and the only code that decides
 * an order's status. It is pure: each call takes the current state and returns
 * the next state with the event that records it. It changes nothing it is
 * given, saves nothing and sends nothing, so that a service can apply the state
 * and the event in one transaction.
 */
export class OrderStateMachine {
  constructor(
    private readonly rules: OrderFlowRules = DEFAULT_ORDER_FLOW_RULES,
  ) {}

  start(
    actor: OrderActor,
    at: Date,
    facts: { readonly prepaymentDue: string | null },
  ): OrderTransitionResult {
    return {
      state: {
        status: "Received",
        prepaymentDue: facts.prepaymentDue,
        stockCoversOrder: null,
        holds: [],
        resumeTo: null,
      },
      event: {
        type: "ORDER_STARTED",
        from: null,
        to: "Received",
        actor,
        at,
        reason: null,
        data:
          facts.prepaymentDue === null
            ? null
            : { prepaymentDue: facts.prepaymentDue },
      },
    };
  }

  /** Applies one command, or throws: FORBIDDEN for the wrong actor, CONFLICT otherwise. */
  apply(
    state: OrderSnapshot,
    command: OrderCommand,
    actor: OrderActor,
    at: Date,
  ): OrderTransitionResult {
    // Role first, so someone who may not act learns nothing about the order.
    this.assertActor(command.type, actor);

    const transition = TRANSITIONS.find(
      (t) => t.on === command.type && t.from.includes(state.status),
    );
    if (!transition) {
      throw new ConflictError(
        `An order at ${state.status} cannot take ${command.type}.`,
      );
    }

    const refusal = this.refusalOf(state, command);
    if (refusal) {
      throw new ConflictError(
        `An order at ${state.status} cannot take ${command.type}: ${refusal}`,
      );
    }

    const next = nextState(state, command, transition);
    return {
      state: next,
      event: {
        type: command.type,
        from: state.status,
        to: next.status,
        actor,
        at,
        reason: reasonOf(command),
        data: dataOf(command),
      },
    };
  }

  private assertActor(type: OrderCommandType, actor: OrderActor): void {
    // Every row of one event names the same actor.
    const by = TRANSITIONS.find((t) => t.on === type)?.by;
    const allowed = actor.kind === "system" ? by === SYSTEM : by === actor.role;
    if (!allowed) {
      throw new DomainError("FORBIDDEN", `You may not make ${type}.`);
    }
  }

  /** Why a move the table allows must still be refused, or null when it may go ahead. */
  private refusalOf(
    state: OrderSnapshot,
    command: OrderCommand,
  ): string | null {
    switch (command.type) {
      case "FIELDS_CONFIRMED":
        return command.allFieldsConfirmed
          ? null
          : "a person must confirm every uncertain field first.";
      case "PI_SENT":
        return state.status === "StockChecked" &&
          this.rules.sprRequiredOnShortfall &&
          !state.stockCoversOrder
          ? "the stock is short, so an SPR must be approved first."
          : null;
      case "PAYMENT_CONFIRMED":
        return refusalOfPayment(state, command.paymentType, command.amount);
      case "PACKING_STARTED":
        return state.status === "AwaitingPayment" &&
          state.prepaymentDue !== null
          ? "the prepayment must be confirmed by Finance first."
          : null;
      case "SPR_REJECTED":
        return command.reason.trim() ? null : "say why it was rejected.";
      case "HOLD_RAISED":
        if (!command.reason.trim()) return "say why it is held.";
        return state.holds.includes(command.source)
          ? `it already has a ${command.source} hold.`
          : null;
      case "HOLD_CLEARED":
        return state.holds.includes(command.source)
          ? null
          : `it has no ${command.source} hold.`;
      case "CANCELLED":
        if (!command.reason.trim()) return "say why it is cancelled.";
        // A held order keeps the limit of the status it was held from.
        return state.status === "OnHold" &&
          state.resumeTo !== null &&
          !CANCELLABLE.includes(state.resumeTo)
          ? "its goods have already gone."
          : null;
      default:
        return null;
    }
  }
}

function refusalOfPayment(
  state: OrderSnapshot,
  paymentType: PaymentType,
  amount: string,
): string | null {
  if (state.prepaymentDue === null) return "no prepayment is due.";
  if (!GATE_PAYMENT_TYPES.includes(paymentType)) {
    return `a ${paymentType} payment does not open the gate.`;
  }
  return compareDecimal(amount, state.prepaymentDue) < 0
    ? "the amount does not cover the prepayment due."
    : null;
}

function nextState(
  state: OrderSnapshot,
  command: OrderCommand,
  transition: Transition,
): OrderSnapshot {
  switch (command.type) {
    case "STOCK_CHECKED":
      return {
        ...state,
        status: "StockChecked",
        stockCoversOrder: command.stockCoversOrder,
      };
    case "HOLD_RAISED":
      return {
        ...state,
        status: "OnHold",
        holds: [...state.holds, command.source],
        // A second hold must not overwrite where the order first came from.
        resumeTo: state.resumeTo ?? state.status,
      };
    case "HOLD_CLEARED": {
      const holds = state.holds.filter((source) => source !== command.source);
      if (holds.length > 0) return { ...state, holds };
      return {
        ...state,
        status: state.resumeTo ?? state.status,
        holds,
        resumeTo: null,
      };
    }
    case "CANCELLED":
      return { ...state, status: "Cancelled", holds: [], resumeTo: null };
    default:
      return {
        ...state,
        status: transition.to === RESUME ? state.status : transition.to,
      };
  }
}

function reasonOf(command: OrderCommand): string | null {
  switch (command.type) {
    case "SPR_REJECTED":
    case "HOLD_RAISED":
    case "CANCELLED":
      return command.reason.trim();
    default:
      return null;
  }
}

function dataOf(
  command: OrderCommand,
): Readonly<Record<string, string>> | null {
  switch (command.type) {
    case "PAYMENT_CONFIRMED":
      return { paymentType: command.paymentType, amount: command.amount };
    case "HOLD_RAISED":
    case "HOLD_CLEARED":
      return { source: command.source };
    case "STOCK_CHECKED":
      return { stockCoversOrder: String(command.stockCoversOrder) };
    default:
      return null;
  }
}
