import {
  ORDER_STATUSES,
  ROLES,
  type OrderStatus,
  type Role,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import {
  navisionStatusOf,
  OrderStateMachine,
  type OrderActor,
  type OrderCommand,
  type OrderSnapshot,
} from "./order-state-machine.js";

const AT = new Date("2026-11-05T02:00:00.000Z");

const machine = new OrderStateMachine();

function person(role: Role): OrderActor {
  return { kind: "user", userId: "user-1", name: `Test ${role}`, role };
}

const SYSTEM: OrderActor = { kind: "system", name: "checks" };

function snapshot(
  status: OrderStatus,
  changes: Partial<OrderSnapshot> = {},
): OrderSnapshot {
  return {
    status,
    prepaymentDue: "100.00",
    stockCoversOrder: true,
    holds: status === "OnHold" ? ["check"] : [],
    resumeTo: status === "OnHold" ? "Packing" : null,
    ...changes,
  };
}

interface CommandCase {
  readonly command: OrderCommand;
  readonly actor: OrderActor;
  readonly facts?: Partial<OrderSnapshot>;
  /** Every status the event is legal from, with the status it leads to. */
  readonly legal: Partial<Record<OrderStatus, OrderStatus>>;
}

// Written out by hand, not read from the machine's table: a test that derived
// this list from the table would pass whatever the table said.
const CASES: readonly CommandCase[] = [
  {
    command: { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
    actor: person("SUPPORT"),
    legal: { Received: "Confirmed" },
  },
  {
    command: { type: "STOCK_CHECKED", stockCoversOrder: true },
    actor: person("PRODUCT_MANAGER"),
    legal: { Confirmed: "StockChecked" },
  },
  {
    command: { type: "SPR_RAISED" },
    actor: person("PRODUCT_MANAGER"),
    legal: { StockChecked: "AwaitingSpr" },
  },
  {
    command: { type: "SPR_APPROVED" },
    actor: person("APPROVER"),
    legal: { AwaitingSpr: "SprApproved" },
  },
  {
    command: { type: "SPR_REJECTED", reason: "The unit cost looks wrong" },
    actor: person("APPROVER"),
    legal: { AwaitingSpr: "StockChecked" },
  },
  {
    command: { type: "PI_SENT" },
    actor: person("SUPPORT"),
    legal: { StockChecked: "AwaitingPayment", SprApproved: "AwaitingPayment" },
  },
  {
    command: {
      type: "PAYMENT_CONFIRMED",
      paymentType: "prepayment",
      amount: "100.00",
    },
    actor: person("FINANCE"),
    legal: { AwaitingPayment: "Paid" },
  },
  {
    command: { type: "PACKING_STARTED" },
    actor: person("WAREHOUSE"),
    facts: { prepaymentDue: null },
    legal: { AwaitingPayment: "Packing", Paid: "Packing" },
  },
  {
    command: { type: "INVOICED" },
    actor: person("SUPPORT"),
    legal: { Packing: "Invoiced" },
  },
  {
    command: { type: "RELEASED" },
    actor: person("WAREHOUSE"),
    legal: { Invoiced: "Released" },
  },
  {
    command: { type: "SHIPPING_DETAILS_SENT" },
    actor: person("SUPPORT"),
    legal: { Released: "AwaitingShippingDocuments" },
  },
  {
    command: { type: "SHIPPING_DOCUMENTS_RECEIVED" },
    actor: person("LOGISTICS"),
    legal: { AwaitingShippingDocuments: "Closed" },
  },
  {
    command: {
      type: "HOLD_RAISED",
      source: "payment",
      reason: "The bank details changed",
    },
    actor: SYSTEM,
    legal: {
      Received: "OnHold",
      Confirmed: "OnHold",
      StockChecked: "OnHold",
      AwaitingSpr: "OnHold",
      SprApproved: "OnHold",
      AwaitingPayment: "OnHold",
      Paid: "OnHold",
      Packing: "OnHold",
      Invoiced: "OnHold",
      Released: "OnHold",
      AwaitingShippingDocuments: "OnHold",
      OnHold: "OnHold",
    },
  },
  {
    command: { type: "HOLD_CLEARED", source: "check" },
    actor: SYSTEM,
    legal: { OnHold: "Packing" },
  },
  {
    command: { type: "CANCELLED", reason: "The customer withdrew the PO" },
    actor: person("SUPPORT"),
    legal: {
      Received: "Cancelled",
      Confirmed: "Cancelled",
      StockChecked: "Cancelled",
      AwaitingSpr: "Cancelled",
      SprApproved: "Cancelled",
      AwaitingPayment: "Cancelled",
      Paid: "Cancelled",
      Packing: "Cancelled",
      Invoiced: "Cancelled",
      OnHold: "Cancelled",
    },
  },
];

function refusal(run: () => unknown): DomainError {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error("Expected a refusal, and the machine allowed it");
}

/** Freezes the state, so a change to it throws instead of passing quietly. */
function frozen(state: OrderSnapshot): OrderSnapshot {
  Object.freeze(state.holds);
  return Object.freeze(state);
}

describe("every status against every event", () => {
  const every = CASES.flatMap((c) =>
    ORDER_STATUSES.map((status) => ({ ...c, status })),
  );

  it.each(every)(
    "$command.type from $status does what the list says",
    ({ command, actor, facts, legal, status }) => {
      const state = frozen(snapshot(status, facts));
      const to = legal[status];

      if (to) {
        const result = machine.apply(state, command, actor, AT);
        expect(result.state.status).toBe(to);
        expect(result.event).toMatchObject({
          type: command.type,
          from: status,
          to,
          actor,
          at: AT,
        });
      } else {
        const error = refusal(() => machine.apply(state, command, actor, AT));
        expect(error.code).toBe("CONFLICT");
        expect(error.httpStatus).toBe(409);
        expect(error.message).toContain(status);
      }
    },
  );

  it("covers every status and every event in the machine", () => {
    expect(ORDER_STATUSES).toHaveLength(14);
    expect(every).toHaveLength(14 * 15);
  });
});

describe("who may make each transition", () => {
  const firstLegal = (c: CommandCase): OrderStatus =>
    Object.keys(c.legal)[0] as OrderStatus;

  const wrongPeople = CASES.flatMap((c) =>
    ROLES.filter(
      (role) => c.actor.kind !== "user" || role !== c.actor.role,
    ).map((role) => ({ ...c, role })),
  );

  it.each(wrongPeople)(
    "refuses $command.type by $role",
    ({ command, facts, role, ...c }) => {
      const state = snapshot(firstLegal({ command, facts, ...c }), facts);
      const error = refusal(() =>
        machine.apply(state, command, person(role), AT),
      );
      expect(error.code).toBe("FORBIDDEN");
    },
  );

  it.each(CASES.filter((c) => c.actor.kind === "user"))(
    "refuses $command.type by the system, because a person must do it",
    (c) => {
      const state = snapshot(firstLegal(c), c.facts);
      const error = refusal(() => machine.apply(state, c.command, SYSTEM, AT));
      expect(error.code).toBe("FORBIDDEN");
    },
  );

  it("says no by role before it says anything about the order's status", () => {
    const error = refusal(() =>
      machine.apply(
        snapshot("Closed"),
        { type: "SPR_APPROVED" },
        person("WAREHOUSE"),
        AT,
      ),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).not.toContain("Closed");
  });
});

describe("order transitions (the state machine)", () => {
  it("starts an order at Received, recording what prepayment is due", () => {
    const { state, event } = machine.start(person("SUPPORT"), AT, {
      prepaymentDue: "500.00",
    });

    expect(state).toEqual({
      status: "Received",
      prepaymentDue: "500.00",
      stockCoversOrder: null,
      holds: [],
      resumeTo: null,
    });
    expect(event).toEqual({
      type: "ORDER_STARTED",
      from: null,
      to: "Received",
      actor: person("SUPPORT"),
      at: AT,
      reason: null,
      data: { prepaymentDue: "500.00" },
    });
  });

  it("moves an order from PO received to fields confirmed only when the fields are confirmed", () => {
    const state = snapshot("Received");
    const error = refusal(() =>
      machine.apply(
        state,
        { type: "FIELDS_CONFIRMED", allFieldsConfirmed: false },
        person("SUPPORT"),
        AT,
      ),
    );
    expect(error.code).toBe("CONFLICT");

    const { state: next } = machine.apply(
      state,
      { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
      person("SUPPORT"),
      AT,
    );
    expect(next.status).toBe("Confirmed");
  });

  it("refuses a transition that skips a required step", () => {
    const error = refusal(() =>
      machine.apply(
        snapshot("Received"),
        { type: "PI_SENT" },
        person("SUPPORT"),
        AT,
      ),
    );
    expect(error.code).toBe("CONFLICT");
  });

  it("refuses a transition out of a closed order", () => {
    for (const c of CASES) {
      const error = refusal(() =>
        machine.apply(snapshot("Closed"), c.command, c.actor, AT),
      );
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("refuses a transition out of a cancelled order", () => {
    for (const c of CASES) {
      const error = refusal(() =>
        machine.apply(snapshot("Cancelled"), c.command, c.actor, AT),
      );
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("skips the SPR approval step when the stock covers the order", () => {
    const { state } = machine.apply(
      snapshot("Confirmed", { stockCoversOrder: null }),
      { type: "STOCK_CHECKED", stockCoversOrder: true },
      person("PRODUCT_MANAGER"),
      AT,
    );
    expect(state.stockCoversOrder).toBe(true);

    const { state: sent } = machine.apply(
      state,
      { type: "PI_SENT" },
      person("SUPPORT"),
      AT,
    );
    expect(sent.status).toBe("AwaitingPayment");
  });

  it("refuses to send the PI on a shortfall until an SPR is approved", () => {
    const { state } = machine.apply(
      snapshot("Confirmed", { stockCoversOrder: null }),
      { type: "STOCK_CHECKED", stockCoversOrder: false },
      person("PRODUCT_MANAGER"),
      AT,
    );

    const error = refusal(() =>
      machine.apply(state, { type: "PI_SENT" }, person("SUPPORT"), AT),
    );
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("SPR");

    const { state: raised } = machine.apply(
      state,
      { type: "SPR_RAISED" },
      person("PRODUCT_MANAGER"),
      AT,
    );
    const { state: approved } = machine.apply(
      raised,
      { type: "SPR_APPROVED" },
      person("APPROVER"),
      AT,
    );
    const { state: sent } = machine.apply(
      approved,
      { type: "PI_SENT" },
      person("SUPPORT"),
      AT,
    );
    expect(sent.status).toBe("AwaitingPayment");
  });

  it("lets a person raise an SPR even when the stock covers the order, since the trigger is still open (A-21)", () => {
    const { state } = machine.apply(
      snapshot("StockChecked", { stockCoversOrder: true }),
      { type: "SPR_RAISED" },
      person("PRODUCT_MANAGER"),
      AT,
    );
    expect(state.status).toBe("AwaitingSpr");
  });

  it("lets configuration turn the SPR requirement off, since the rule is still open (A-21)", () => {
    const relaxed = new OrderStateMachine({ sprRequiredOnShortfall: false });
    const { state } = relaxed.apply(
      snapshot("StockChecked", { stockCoversOrder: false }),
      { type: "PI_SENT" },
      person("SUPPORT"),
      AT,
    );
    expect(state.status).toBe("AwaitingPayment");
  });

  it("walks a whole order from the PO to closed, with one event per step", () => {
    const support = person("SUPPORT");
    const pm = person("PRODUCT_MANAGER");
    const warehouse = person("WAREHOUSE");
    const steps: readonly [OrderCommand, OrderActor, OrderStatus][] = [
      [
        { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
        support,
        "Confirmed",
      ],
      [{ type: "STOCK_CHECKED", stockCoversOrder: false }, pm, "StockChecked"],
      [{ type: "SPR_RAISED" }, pm, "AwaitingSpr"],
      [{ type: "SPR_APPROVED" }, person("APPROVER"), "SprApproved"],
      [{ type: "PI_SENT" }, support, "AwaitingPayment"],
      [
        {
          type: "PAYMENT_CONFIRMED",
          paymentType: "prepayment",
          amount: "500.00",
        },
        person("FINANCE"),
        "Paid",
      ],
      [{ type: "PACKING_STARTED" }, warehouse, "Packing"],
      [{ type: "INVOICED" }, support, "Invoiced"],
      [{ type: "RELEASED" }, warehouse, "Released"],
      [{ type: "SHIPPING_DETAILS_SENT" }, support, "AwaitingShippingDocuments"],
      [{ type: "SHIPPING_DOCUMENTS_RECEIVED" }, person("LOGISTICS"), "Closed"],
    ];

    let { state } = machine.start(support, AT, { prepaymentDue: "500.00" });
    for (const [command, actor, to] of steps) {
      const before = state.status;
      const result = machine.apply(state, command, actor, AT);
      expect(result.event).toMatchObject({ from: before, to, actor, at: AT });
      state = result.state;
      expect(state.status).toBe(to);
    }
  });

  it("never changes the state it is given", () => {
    const state = frozen(snapshot("AwaitingSpr"));
    const before = structuredClone(state);

    machine.apply(state, { type: "SPR_APPROVED" }, person("APPROVER"), AT);
    machine.apply(
      state,
      { type: "HOLD_RAISED", source: "check", reason: "Quantity differs" },
      SYSTEM,
      AT,
    );
    machine.apply(
      state,
      { type: "CANCELLED", reason: "Withdrawn" },
      person("SUPPORT"),
      AT,
    );

    expect(state).toEqual(before);
  });
});

describe("rejecting an SPR", () => {
  it("returns the order to StockChecked, with the reason on the event", () => {
    const { state, event } = machine.apply(
      snapshot("AwaitingSpr", { stockCoversOrder: false }),
      { type: "SPR_REJECTED", reason: "  The unit cost looks wrong  " },
      person("APPROVER"),
      AT,
    );

    expect(state.status).toBe("StockChecked");
    expect(event).toMatchObject({
      type: "SPR_REJECTED",
      from: "AwaitingSpr",
      to: "StockChecked",
      reason: "The unit cost looks wrong",
    });
  });

  it("refuses a rejection without a reason", () => {
    for (const reason of ["", "   "]) {
      const error = refusal(() =>
        machine.apply(
          snapshot("AwaitingSpr"),
          { type: "SPR_REJECTED", reason },
          person("APPROVER"),
          AT,
        ),
      );
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("still blocks the PI after a rejection on a shortfall, so a corrected SPR must be raised and approved", () => {
    const { state } = machine.apply(
      snapshot("AwaitingSpr", { stockCoversOrder: false }),
      { type: "SPR_REJECTED", reason: "Wrong vendor" },
      person("APPROVER"),
      AT,
    );

    const error = refusal(() =>
      machine.apply(state, { type: "PI_SENT" }, person("SUPPORT"), AT),
    );
    expect(error.code).toBe("CONFLICT");

    const { state: again } = machine.apply(
      state,
      { type: "SPR_RAISED" },
      person("PRODUCT_MANAGER"),
      AT,
    );
    expect(again.status).toBe("AwaitingSpr");
  });
});

describe("the payment gate", () => {
  const finance = person("FINANCE");

  it("holds a prepayment order until a prepayment confirmation covers the amount due", () => {
    const state = snapshot("AwaitingPayment", { prepaymentDue: "100.00" });

    const short = refusal(() =>
      machine.apply(
        state,
        {
          type: "PAYMENT_CONFIRMED",
          paymentType: "prepayment",
          amount: "99.99",
        },
        finance,
        AT,
      ),
    );
    expect(short.code).toBe("CONFLICT");

    const packing = refusal(() =>
      machine.apply(
        state,
        { type: "PACKING_STARTED" },
        person("WAREHOUSE"),
        AT,
      ),
    );
    expect(packing.code).toBe("CONFLICT");
    expect(packing.message).toContain("prepayment");
  });

  it("does not release the order on a balance or deposit payment type", () => {
    const state = snapshot("AwaitingPayment", { prepaymentDue: "100.00" });
    for (const paymentType of ["balance", "deposit"] as const) {
      const error = refusal(() =>
        machine.apply(
          state,
          { type: "PAYMENT_CONFIRMED", paymentType, amount: "100.00" },
          finance,
          AT,
        ),
      );
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("releases the order on a full payment, which covers the prepayment too", () => {
    const { state } = machine.apply(
      snapshot("AwaitingPayment", { prepaymentDue: "100.00" }),
      {
        type: "PAYMENT_CONFIRMED",
        paymentType: "full-payment",
        amount: "400.00",
      },
      finance,
      AT,
    );
    expect(state.status).toBe("Paid");
  });

  it("releases the order when the prepayment is confirmed, and records who confirmed it", () => {
    const { state, event } = machine.apply(
      snapshot("AwaitingPayment", { prepaymentDue: "100.00" }),
      {
        type: "PAYMENT_CONFIRMED",
        paymentType: "prepayment",
        amount: "100.00",
      },
      finance,
      AT,
    );

    expect(state.status).toBe("Paid");
    expect(event).toMatchObject({
      actor: finance,
      at: AT,
      data: { paymentType: "prepayment", amount: "100.00" },
    });

    const { state: packing } = machine.apply(
      state,
      { type: "PACKING_STARTED" },
      person("WAREHOUSE"),
      AT,
    );
    expect(packing.status).toBe("Packing");
  });

  it("lets an order with no prepayment pass the gate", () => {
    const { state } = machine.apply(
      snapshot("AwaitingPayment", { prepaymentDue: null }),
      { type: "PACKING_STARTED" },
      person("WAREHOUSE"),
      AT,
    );
    expect(state.status).toBe("Packing");
  });

  it("refuses a payment confirmation when no prepayment is due, since there is no gate to open", () => {
    const error = refusal(() =>
      machine.apply(
        snapshot("AwaitingPayment", { prepaymentDue: null }),
        {
          type: "PAYMENT_CONFIRMED",
          paymentType: "prepayment",
          amount: "100.00",
        },
        finance,
        AT,
      ),
    );
    expect(error.code).toBe("CONFLICT");
  });
});

describe("holds", () => {
  const failed: OrderCommand = {
    type: "HOLD_RAISED",
    source: "check",
    reason: "The packing list quantity differs from the PO",
  };

  it("holds the order on a failed check, rather than moving it on, and keeps where it was", () => {
    const { state, event } = machine.apply(
      snapshot("Packing"),
      failed,
      SYSTEM,
      AT,
    );

    expect(state).toMatchObject({
      status: "OnHold",
      holds: ["check"],
      resumeTo: "Packing",
    });
    expect(event).toMatchObject({
      from: "Packing",
      to: "OnHold",
      reason: "The packing list quantity differs from the PO",
      data: { source: "check" },
    });
  });

  it("refuses every ordinary step while the order is on hold", () => {
    const state = snapshot("OnHold", { resumeTo: "Invoiced" });
    const error = refusal(() =>
      machine.apply(state, { type: "RELEASED" }, person("WAREHOUSE"), AT),
    );
    expect(error.code).toBe("CONFLICT");
  });

  it("returns to where it was when the hold clears", () => {
    const { state } = machine.apply(
      snapshot("OnHold", { holds: ["check"], resumeTo: "Invoiced" }),
      { type: "HOLD_CLEARED", source: "check" },
      SYSTEM,
      AT,
    );
    expect(state).toMatchObject({
      status: "Invoiced",
      holds: [],
      resumeTo: null,
    });
  });

  it("stays on hold until both a check hold and a payment hold have cleared", () => {
    const first = machine.apply(snapshot("Packing"), failed, SYSTEM, AT);
    const second = machine.apply(
      first.state,
      {
        type: "HOLD_RAISED",
        source: "payment",
        reason: "Bank details changed",
      },
      SYSTEM,
      AT,
    );
    expect(second.state).toMatchObject({
      status: "OnHold",
      holds: ["check", "payment"],
      resumeTo: "Packing",
    });

    const cleared = machine.apply(
      second.state,
      { type: "HOLD_CLEARED", source: "check" },
      SYSTEM,
      AT,
    );
    expect(cleared.state).toMatchObject({
      status: "OnHold",
      holds: ["payment"],
      resumeTo: "Packing",
    });

    const free = machine.apply(
      cleared.state,
      { type: "HOLD_CLEARED", source: "payment" },
      SYSTEM,
      AT,
    );
    expect(free.state).toMatchObject({
      status: "Packing",
      holds: [],
      resumeTo: null,
    });
  });

  it("refuses raising a hold the order already has, and clearing one it does not", () => {
    const state = snapshot("OnHold", { holds: ["check"] });

    expect(refusal(() => machine.apply(state, failed, SYSTEM, AT)).code).toBe(
      "CONFLICT",
    );
    expect(
      refusal(() =>
        machine.apply(
          state,
          { type: "HOLD_CLEARED", source: "payment" },
          SYSTEM,
          AT,
        ),
      ).code,
    ).toBe("CONFLICT");
  });

  it("refuses a hold without a reason", () => {
    const error = refusal(() =>
      machine.apply(
        snapshot("Packing"),
        { type: "HOLD_RAISED", source: "check", reason: "  " },
        SYSTEM,
        AT,
      ),
    );
    expect(error.code).toBe("CONFLICT");
  });
});

describe("cancelling", () => {
  const support = person("SUPPORT");

  it("cancels with a reason, and drops any holds", () => {
    const { state, event } = machine.apply(
      snapshot("OnHold", { resumeTo: "Packing" }),
      { type: "CANCELLED", reason: "The customer withdrew the PO" },
      support,
      AT,
    );
    expect(state).toMatchObject({
      status: "Cancelled",
      holds: [],
      resumeTo: null,
    });
    expect(event.reason).toBe("The customer withdrew the PO");
  });

  it("refuses to cancel without a reason", () => {
    const error = refusal(() =>
      machine.apply(
        snapshot("Packing"),
        { type: "CANCELLED", reason: " " },
        support,
        AT,
      ),
    );
    expect(error.code).toBe("CONFLICT");
  });

  it("refuses to cancel an order on hold whose goods have already gone", () => {
    for (const resumeTo of ["Released", "AwaitingShippingDocuments"] as const) {
      const error = refusal(() =>
        machine.apply(
          snapshot("OnHold", { resumeTo }),
          { type: "CANCELLED", reason: "Too late" },
          support,
          AT,
        ),
      );
      expect(error.code).toBe("CONFLICT");
    }
  });
});

describe("Navision's Sales Header Status, where the states meet it (an assumption to confirm)", () => {
  const expected: readonly [
    OrderStatus,
    ReturnType<typeof navisionStatusOf>,
  ][] = [
    ["Received", "Open"],
    ["Confirmed", "Open"],
    ["StockChecked", "Open"],
    ["AwaitingSpr", "Pending Approval"],
    ["SprApproved", "Open"],
    ["AwaitingPayment", "Pending Prepayment"],
    ["Paid", "Released"],
    ["Packing", "Released"],
    ["Invoiced", "Released"],
    ["Released", "Released"],
    ["AwaitingShippingDocuments", "Released"],
    ["Closed", null],
    ["Cancelled", null],
  ];

  it.each(expected)("maps %s to %s", (status, navision) => {
    expect(navisionStatusOf(snapshot(status))).toBe(navision);
  });

  it("shows Open while waiting for payment when no prepayment is due", () => {
    expect(
      navisionStatusOf(snapshot("AwaitingPayment", { prepaymentDue: null })),
    ).toBe("Open");
  });

  it("maps an order on hold by where it will return to", () => {
    expect(
      navisionStatusOf(snapshot("OnHold", { resumeTo: "AwaitingSpr" })),
    ).toBe("Pending Approval");
  });
});
