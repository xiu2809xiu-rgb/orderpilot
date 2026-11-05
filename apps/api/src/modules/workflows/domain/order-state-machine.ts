import {
  compareDecimal,
  isDecimalString,
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
  /** Every hold on the order, as `holdKeyOf` names them. It can have several at once. */
  readonly holds: readonly string[];
  /** Where a held order returns to; null when it is not on hold. */
  readonly resumeTo: OrderStatus | null;
  /** When it entered this status, as an ISO time. A second hold on a held order is not a new status. */
  readonly enteredAt: string;
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
      /** Which check or payment it is, so one passing never clears another's hold. */
      readonly ref?: string;
      readonly reason: string;
    }
  | {
      readonly type: "HOLD_CLEARED";
      readonly source: HoldSource;
      readonly ref?: string;
    }
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
  /** The step the order now waits on; null once it has finished. */
  readonly currentStep: string | null;
}

/** What names a hold: its source, and which check or payment when the source says. */
export function holdKeyOf(hold: {
  readonly source: HoldSource;
  readonly ref?: string;
}): string {
  return hold.ref ? `${hold.source}:${hold.ref}` : hold.source;
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

/** The injection token for the rules, so a setting can replace the default. */
export const ORDER_FLOW_RULES = Symbol("ORDER_FLOW_RULES");

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

/** Every event the table knows, so a test can notice one with no cases. */
export const TRANSITION_EVENTS: readonly OrderCommandType[] = [
  ...new Set(TRANSITIONS.map((t) => t.on)),
];

/** Payment types that satisfy the gate. A deposit or a balance does not. */
const GATE_PAYMENT_TYPES: readonly PaymentType[] = [
  "prepayment",
  "full-payment",
];

/** What an order waits on: the step, and the role whose move takes it on. */
export interface WaitingOn {
  readonly step: string;
  readonly role: Role;
}

/** What each status normally waits on. Closed and Cancelled wait on nothing. */
const WAITING_ON: Readonly<Record<OrderStatus, WaitingOn | null>> = {
  Received: { step: "fields-confirmed", role: "SUPPORT" },
  Confirmed: { step: "stock-checked", role: "PRODUCT_MANAGER" },
  StockChecked: { step: "pi-sent", role: "SUPPORT" },
  AwaitingSpr: { step: "spr-approval", role: "APPROVER" },
  SprApproved: { step: "pi-sent", role: "SUPPORT" },
  AwaitingPayment: { step: "payment-confirmed", role: "FINANCE" },
  Paid: { step: "packed", role: "WAREHOUSE" },
  Packing: { step: "invoiced", role: "SUPPORT" },
  Invoiced: { step: "shipping-documents", role: "WAREHOUSE" },
  Released: { step: "shipping-documents", role: "SUPPORT" },
  AwaitingShippingDocuments: { step: "shipping-documents", role: "LOGISTICS" },
  Closed: null,
  OnHold: null,
  Cancelled: null,
};

/**
 * What an order waits on. The facts can change the answer: on a shortfall the
 * next move is raising an SPR, and with no prepayment due nothing waits on
 * Finance. A held order stays on what it was held at.
 */
export function waitingOnOf(
  state: OrderSnapshot,
  rules: OrderFlowRules = DEFAULT_ORDER_FLOW_RULES,
): WaitingOn | null {
  const status = state.status === "OnHold" ? state.resumeTo : state.status;
  if (status === null) return null;
  if (
    status === "StockChecked" &&
    rules.sprRequiredOnShortfall &&
    state.stockCoversOrder === false
  ) {
    return { step: "spr-approval", role: "PRODUCT_MANAGER" };
  }
  if (status === "AwaitingPayment" && state.prepaymentDue === null) {
    return { step: "packed", role: "WAREHOUSE" };
  }
  return WAITING_ON[status];
}

/** The step an order is on. */
export function currentStepOf(
  state: OrderSnapshot,
  rules: OrderFlowRules = DEFAULT_ORDER_FLOW_RULES,
): string | null {
  return waitingOnOf(state, rules)?.step ?? null;
}

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

  /** Starts an order. Support opens one by hand, or the system from area 1's event. */
  start(
    actor: OrderActor,
    at: Date,
    facts: { readonly prepaymentDue: string | null },
  ): OrderTransitionResult {
    if (actor.kind === "user" && actor.role !== "SUPPORT") {
      throw new DomainError("FORBIDDEN", "You may not start an order.");
    }
    const due = facts.prepaymentDue;
    // A bad amount here would be stored, and would open or jam the gate later.
    if (
      due !== null &&
      (!isDecimalString(due) || compareDecimal(due, "0") <= 0)
    ) {
      throw new ConflictError(
        "The prepayment due must be an amount above zero, or none at all.",
      );
    }
    const state: OrderSnapshot = {
      status: "Received",
      prepaymentDue: due,
      stockCoversOrder: null,
      holds: [],
      resumeTo: null,
      enteredAt: at.toISOString(),
    };
    return {
      state,
      currentStep: currentStepOf(state, this.rules),
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

    const moved = nextState(state, command, transition);
    const next: OrderSnapshot =
      moved.status === state.status
        ? moved
        : { ...moved, enteredAt: at.toISOString() };
    return {
      state: next,
      currentStep: currentStepOf(next, this.rules),
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
        return state.holds.includes(holdKeyOf(command))
          ? "it already has that hold."
          : null;
      case "HOLD_CLEARED":
        return state.holds.includes(holdKeyOf(command))
          ? null
          : "it does not have that hold.";
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
  if (!isDecimalString(amount)) return "the amount is not a number.";
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
        holds: [...state.holds, holdKeyOf(command)],
        // A second hold must not overwrite where the order first came from.
        resumeTo: state.resumeTo ?? state.status,
      };
    case "HOLD_CLEARED": {
      const key = holdKeyOf(command);
      const holds = state.holds.filter((hold) => hold !== key);
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
      return command.ref
        ? { source: command.source, ref: command.ref }
        : { source: command.source };
    case "STOCK_CHECKED":
      return { stockCoversOrder: String(command.stockCoversOrder) };
    default:
      return null;
  }
}
