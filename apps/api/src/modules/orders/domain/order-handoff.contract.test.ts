import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../common/domain-error.js";
import {
  checkAnswerShape,
  checkFirstSubmittedStartsAWorkflow,
  checkNoWorkflowAnswersNone,
  checkPoVersionRepeat,
  checkRefusalRollsBack,
  checkRefusalsAreDomainErrors,
  checkSubmittedRepeat,
  checkWorkflowAfterSubmit,
  confirmedFact,
  describeOrderHandoffContract,
  submittedFact,
  SCENARIOS,
  type OrderHandoffUnderTest,
  type Within,
} from "./order-handoff.contract.js";
import {
  OrderHandoff,
  type HandoffAnswer,
  type OrderSubmitted,
  type PoVersionConfirmed,
} from "./order-handoff.js";

const NONE: HandoffAnswer = { effect: "none" };
const APPLIED: HandoffAnswer = { effect: "applied" };

/** What the in-memory database holds: the workflows, the marks area 1 writes, and the orders whose PI is sent. */
class Store {
  workflows = new Map<string, Set<number>>();
  marks = new Set<string>();
  piSent = new Set<string>();

  snapshot(): Store {
    const copy = new Store();
    for (const [orderNo, versions] of this.workflows)
      copy.workflows.set(orderNo, new Set(versions));
    copy.marks = new Set(this.marks);
    copy.piSent = new Set(this.piSent);
    return copy;
  }

  restore(from: Store): void {
    this.workflows = from.workflows;
    this.marks = from.marks;
    this.piSent = from.piSent;
  }
}

/**
 * A small implementation that does what ADR 0072 asks: it starts a workflow
 * on a first `submitted`, answers `none` on a repeat and for an order with no
 * workflow, and refuses a PO version after the PI is sent.
 */
class InMemoryHandoff extends OrderHandoff {
  constructor(protected readonly store: Store) {
    super();
  }

  submitted(fact: OrderSubmitted): Promise<HandoffAnswer> {
    if (this.store.workflows.has(fact.orderNo)) return Promise.resolve(NONE);
    this.store.workflows.set(fact.orderNo, new Set([fact.poVersionNo]));
    return Promise.resolve(APPLIED);
  }

  poVersionConfirmed(fact: PoVersionConfirmed): Promise<HandoffAnswer> {
    const versions = this.store.workflows.get(fact.orderNo);
    if (versions === undefined || versions.has(fact.poVersionNo))
      return Promise.resolve(NONE);
    if (this.store.piSent.has(fact.orderNo))
      return Promise.reject(
        new ConflictError("The PI is sent, so the PO can no longer change."),
      );
    versions.add(fact.poVersionNo);
    return Promise.resolve(APPLIED);
  }
}

/** A transaction that undoes everything the work did to the store when it throws. */
function withRollback(store: Store): Within {
  return async (work) => {
    const before = store.snapshot();
    try {
      return await work();
    } catch (error) {
      store.restore(before);
      throw error;
    }
  };
}

/** A "transaction" with no rollback: whatever the work wrote stays. */
function withoutRollback(): Within {
  return (work) => work();
}

let next = 0;
function freshOrderNo(): string {
  next += 1;
  return `SO-20261126-${String(2000 + next).padStart(4, "0")}`;
}

/** A refusal: a PO version for an order whose PI is already sent. */
function afterPiSent(store: Store, handoff: OrderHandoff) {
  return {
    name: "a PO version after the PI is sent",
    call: async () => {
      const orderNo = freshOrderNo();
      await handoff.submitted(submittedFact(orderNo));
      store.piSent.add(orderNo);
      return handoff.poVersionConfirmed(confirmedFact(orderNo));
    },
  };
}

/** The correct implementation, with every optional part of the factory. */
function correct(
  build: (store: Store) => OrderHandoff = (store) => new InMemoryHandoff(store),
  within: (store: Store) => Within = withRollback,
): OrderHandoffUnderTest & { within: Within } {
  const store = new Store();
  const handoff = build(store);
  return {
    handoff,
    freshOrderNo,
    refusals: [afterPiSent(store, handoff)],
    within: within(store),
    rollbackProbe: {
      writeBeforeCall: (marker) => {
        store.marks.add(marker);
        return Promise.resolve();
      },
      readBack: (marker) => Promise.resolve(store.marks.has(marker)),
    },
    hasWorkflow: (orderNo) => Promise.resolve(store.workflows.has(orderNo)),
  };
}

describeOrderHandoffContract(
  "a correct in-memory class, with every optional part",
  () => correct(),
  ["within", "rollbackProbe", "hasWorkflow", "refusals"],
);

describeOrderHandoffContract(
  "a correct in-memory class, with none of the optional parts",
  () => ({
    handoff: new InMemoryHandoff(new Store()),
    freshOrderNo,
  }),
);

describe("the contract checks bite", () => {
  it("passes a correct implementation on every check, for every scenario", async () => {
    for (const scenario of SCENARIOS) {
      const under = correct();
      await checkAnswerShape(under, scenario);
      await checkSubmittedRepeat(under, scenario);
      await checkNoWorkflowAnswersNone(under, scenario);
      await checkPoVersionRepeat(under, scenario);
      await checkWorkflowAfterSubmit(under, scenario);
      await checkFirstSubmittedStartsAWorkflow(under, scenario);
    }
    await checkRefusalsAreDomainErrors(correct());
    await checkRefusalRollsBack(correct());
  });

  it("fails an implementation that applies twice on a repeat", async () => {
    class AppliesTwice extends InMemoryHandoff {
      override submitted(fact: OrderSubmitted): Promise<HandoffAnswer> {
        this.store.workflows.set(fact.orderNo, new Set([fact.poVersionNo]));
        return Promise.resolve(APPLIED);
      }
      override poVersionConfirmed(
        fact: PoVersionConfirmed,
      ): Promise<HandoffAnswer> {
        return Promise.resolve(
          this.store.workflows.has(fact.orderNo) ? APPLIED : NONE,
        );
      }
    }
    const under = correct((store) => new AppliesTwice(store));

    await expect(checkSubmittedRepeat(under)).rejects.toThrow(/applied/);
    await expect(checkPoVersionRepeat(under)).rejects.toThrow(/applied/);
    await expect(checkWorkflowAfterSubmit(under)).rejects.toThrow(/applied/);
  });

  it("fails an implementation that lets a plain Error out", async () => {
    class Crashes extends InMemoryHandoff {
      override submitted(): Promise<HandoffAnswer> {
        return Promise.reject(new Error("the database said no"));
      }
    }
    const under = correct((store) => new Crashes(store));

    await expect(checkAnswerShape(under)).rejects.toThrow(
      /must be a DomainError/,
    );
    await expect(checkSubmittedRepeat(under)).rejects.toThrow(
      /must be a DomainError/,
    );
    // The same plain Error as a declared refusal.
    await expect(
      checkRefusalsAreDomainErrors({
        ...under,
        refusals: [
          {
            name: "a refusal that is a plain Error",
            call: () => Promise.reject(new Error("the database said no")),
          },
        ],
      }),
    ).rejects.toThrow(/a refusal that is a plain Error/);
  });

  it("fails an implementation that answers applied for an order with no workflow", async () => {
    class AppliesToAnything extends InMemoryHandoff {
      override poVersionConfirmed(): Promise<HandoffAnswer> {
        return Promise.resolve(APPLIED);
      }
    }
    const under = correct((store) => new AppliesToAnything(store));

    await expect(checkNoWorkflowAnswersNone(under)).rejects.toThrow(/applied/);
  });

  it("fails an implementation that answers applied for a submitted order and starts no workflow", async () => {
    class Lies extends InMemoryHandoff {
      override submitted(): Promise<HandoffAnswer> {
        return Promise.resolve(APPLIED);
      }
    }
    const under = correct((store) => new Lies(store));

    await expect(checkWorkflowAfterSubmit(under)).rejects.toThrow(
      /after the first call/,
    );
    await expect(checkFirstSubmittedStartsAWorkflow(under)).rejects.toThrow(
      /the workflow it started/,
    );
  });

  it("fails an implementation that does nothing and is not marked a stand-in, and passes one that is", async () => {
    class DoesNothing extends OrderHandoff {
      submitted(): Promise<HandoffAnswer> {
        return Promise.resolve(NONE);
      }
      poVersionConfirmed(): Promise<HandoffAnswer> {
        return Promise.resolve(NONE);
      }
    }
    const unmarked: OrderHandoffUnderTest = {
      handoff: new DoesNothing(),
      freshOrderNo,
      hasWorkflow: () => Promise.resolve(false),
    };

    await expect(checkFirstSubmittedStartsAWorkflow(unmarked)).rejects.toThrow(
      /a first submitted starts the workflow/,
    );
    await checkFirstSubmittedStartsAWorkflow({ ...unmarked, standIn: true });
  });

  it("fails a stand-in that claims an effect", async () => {
    class ClaimsTooMuch extends OrderHandoff {
      submitted(): Promise<HandoffAnswer> {
        return Promise.resolve(APPLIED);
      }
      poVersionConfirmed(): Promise<HandoffAnswer> {
        return Promise.resolve(NONE);
      }
    }

    await expect(
      checkFirstSubmittedStartsAWorkflow({
        handoff: new ClaimsTooMuch(),
        freshOrderNo,
        hasWorkflow: () => Promise.resolve(false),
        standIn: true,
      }),
    ).rejects.toThrow(/a stand-in changes nothing/);
  });

  it("fails an implementation whose refusal does not roll back", async () => {
    const under = correct(undefined, withoutRollback);

    await expect(checkRefusalRollsBack(under)).rejects.toThrow(
      /the write before the refusal/,
    );
  });

  it("fails a probe whose write never stays, so a refusal cannot pass by default", async () => {
    const store = new Store();
    const handoff = new InMemoryHandoff(store);
    const under: OrderHandoffUnderTest = {
      ...correct(),
      refusals: [afterPiSent(store, handoff)],
      rollbackProbe: {
        writeBeforeCall: () => Promise.resolve(),
        readBack: () => Promise.resolve(false),
      },
    };

    await expect(checkRefusalRollsBack(under)).rejects.toThrow(
      /a write with no refusal stays/,
    );
  });

  it("sends every call through within when the factory gives one", async () => {
    let transactions = 0;
    const under = correct();
    const { within } = under;

    await checkSubmittedRepeat({
      ...under,
      within: (work) => {
        transactions += 1;
        return within(work);
      },
    });

    expect(transactions).toBe(2);
  });
});
