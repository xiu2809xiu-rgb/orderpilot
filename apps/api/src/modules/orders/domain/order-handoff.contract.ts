import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import type {
  HandoffAnswer,
  OrderHandoff,
  OrderSubmitted,
  PoVersionConfirmed,
} from "./order-handoff.js";

/**
 * What an implementation of `OrderHandoff` gives the contract to work on.
 * Area 2 builds this over its own class and its test database.
 */
export interface OrderHandoffUnderTest {
  readonly handoff: OrderHandoff;
  /**
   * An order number that nothing has started a workflow for and that no
   * earlier check used: each call returns a new one, so a rerun against a
   * database that keeps its rows still starts clean.
   */
  readonly freshOrderNo: () => string;
  /**
   * Calls the implementation means to refuse, such as a PO version after the
   * PI is sent. Each must reject with a `DomainError`. Leave it out and the
   * refusal check has nothing to run, as for a stand-in that never refuses.
   */
  readonly refusals?: readonly {
    readonly name: string;
    readonly call: () => Promise<unknown>;
  }[];
}

const PERSON = {
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic Support",
  role: "SUPPORT",
} as const;

/** Frozen all the way down, so an implementation that edits the fact it was given throws. */
function frozen<T extends object>(fact: T): T {
  for (const value of Object.values(fact) as unknown[]) {
    if (typeof value === "object" && value !== null && !(value instanceof Date))
      Object.freeze(value);
  }
  return Object.freeze(fact);
}

export function submittedFact(orderNo: string): OrderSubmitted {
  return frozen({
    orderNo,
    customerNo: "C-0001",
    submittedBy: { ...PERSON },
    submittedAt: new Date("2026-11-26T03:00:00.000Z"),
    total: "1200.00",
    prepaymentPercent: "30.00",
    poVersionNo: 1,
    request: { ip: null, traceId: "contract-1" },
  });
}

export function confirmedFact(orderNo: string): PoVersionConfirmed {
  return frozen({
    orderNo,
    poVersionNo: 2,
    supersedesPoVersionNo: 1,
    confirmedBy: { ...PERSON },
    confirmedAt: new Date("2026-11-26T04:00:00.000Z"),
    total: "900.00",
    prepaymentPercent: "30.00",
    request: { ip: null, traceId: "contract-1" },
  });
}

/**
 * A call's answer, or its refusal. A refusal is allowed, but only as a
 * `DomainError`: anything else is a crash, and it would roll area 1's write
 * back as a 500 instead of the refusal's own words.
 */
async function answerOf(
  call: () => Promise<HandoffAnswer>,
): Promise<HandoffAnswer | DomainError> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw new Error(
      `A refusal must be a DomainError, but the call threw ${String(error)}`,
      { cause: error },
    );
  }
}

function expectAnAnswer(answer: HandoffAnswer): void {
  // Catches a method that answers nothing, or more than the contract names.
  expect(Object.keys(answer)).toEqual(["effect"]);
  expect(["none", "applied"]).toContain(answer.effect);
}

/**
 * The checks any `OrderHandoff` must pass (ADR 0072). Call it inside a test
 * file with a factory for the implementation, as area 2 does for its class.
 * `mock/logging-order-handoff.test.ts` runs it against the stand-in.
 */
export function describeOrderHandoffContract(
  name: string,
  make: () => Promise<OrderHandoffUnderTest> | OrderHandoffUnderTest,
): void {
  describe(`the OrderHandoff contract: ${name}`, () => {
    it("answers only none or applied for a submitted order, and does not edit the fact", async () => {
      const { handoff, freshOrderNo } = await make();
      const fact = submittedFact(freshOrderNo());
      const before = structuredClone(fact);

      const answer = await answerOf(() => handoff.submitted(fact));

      if (!(answer instanceof DomainError)) expectAnAnswer(answer);
      expect(fact).toEqual(before);
    });

    it("has the effect of one call when the same submitted fact comes twice", async () => {
      const { handoff, freshOrderNo } = await make();
      const fact = submittedFact(freshOrderNo());

      const first = await answerOf(() => handoff.submitted(fact));
      const second = await answerOf(() => handoff.submitted(fact));

      // A refused first call may refuse again; only an answer is held to the rule.
      if (first instanceof DomainError) return;
      // Whatever the first call did, the repeat has nothing left to do.
      expect(second).toEqual({ effect: "none" });
    });

    it("answers none for a PO version of an order with no workflow, and does not throw", async () => {
      const { handoff, freshOrderNo } = await make();

      const answer = await handoff.poVersionConfirmed(
        confirmedFact(freshOrderNo()),
      );

      expect(answer).toEqual({ effect: "none" });
    });

    it("has the effect of one call when the same PO version comes twice", async () => {
      const { handoff, freshOrderNo } = await make();
      const orderNo = freshOrderNo();
      const started = await answerOf(() =>
        handoff.submitted(submittedFact(orderNo)),
      );
      if (started instanceof DomainError) return;
      const fact = confirmedFact(orderNo);
      const before = structuredClone(fact);

      const first = await answerOf(() => handoff.poVersionConfirmed(fact));
      const second = await answerOf(() => handoff.poVersionConfirmed(fact));

      if (first instanceof DomainError) return;
      expectAnAnswer(first);
      expect(second).toEqual({ effect: "none" });
      expect(fact).toEqual(before);
    });

    it("refuses with a DomainError wherever it means to refuse", async () => {
      const { refusals = [] } = await make();

      for (const refusal of refusals) {
        await expect(refusal.call(), refusal.name).rejects.toBeInstanceOf(
          DomainError,
        );
      }
    });
  });
}
