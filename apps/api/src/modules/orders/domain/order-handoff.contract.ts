import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import type {
  HandoffAnswer,
  HandoffPerson,
  OrderHandoff,
  OrderSubmitted,
  PoVersionConfirmed,
} from "./order-handoff.js";

/**
 * Runs a piece of work inside a transaction, committing when it resolves and
 * rolling everything back when it throws. Area 2 passes
 * `(work) => database.transaction(work)`; no wrapper of its own is needed.
 */
export type Within = <T>(work: () => Promise<T>) => Promise<T>;

/**
 * A write the factory makes just before a refused call, in the same
 * transaction, and a way to read it back. It stands for area 1's own write,
 * which a refusal must roll back.
 */
export interface RollbackProbe {
  readonly writeBeforeCall: (marker: string) => Promise<void>;
  readonly readBack: (marker: string) => Promise<boolean>;
}

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
   * PI is sent. Each must reject with a `DomainError`.
   */
  readonly refusals?: readonly {
    readonly name: string;
    readonly call: () => Promise<unknown>;
  }[];
  /**
   * When given, every call of the contract goes through it, as area 1 will
   * make the calls. Without it the calls are bare, and the transaction is not
   * tested.
   */
  readonly within?: Within;
  /** With `within` and at least one refusal, checks that a refusal rolls back. */
  readonly rollbackProbe?: RollbackProbe;
  /**
   * Whether the order has a workflow now. With it, the helper checks that a
   * first `submitted` starts one, that a repeat leaves the one, and that an
   * implementation that does nothing says it is a stand-in.
   */
  readonly hasWorkflow?: (orderNo: string) => Promise<boolean>;
  /** True only for an implementation that changes nothing, such as the logging stand-in. */
  readonly standIn?: boolean;
}

/**
 * The parts of `OrderHandoffUnderTest` a factory may leave out. The helper
 * needs to know them when it registers its tests, which is before it can call
 * the factory, so a factory declares the parts it gives, and the helper
 * fails if the declaration and the factory disagree.
 */
export type OptionalPart =
  "within" | "rollbackProbe" | "hasWorkflow" | "refusals";

/** The call's answer is a refusal, or nothing but `none` or `applied`. */
const NONE: HandoffAnswer = { effect: "none" };
const APPLIED: HandoffAnswer = { effect: "applied" };

export const SUPPORT_PERSON: HandoffPerson = {
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic Support",
  role: "SUPPORT",
};

/**
 * The path ADR 0072 flags: the machine's `start` refuses a user who is not
 * Support, so area 2 starts the workflow as a system actor and must keep this
 * person another way.
 */
export const PRODUCT_MANAGER_PERSON: HandoffPerson = {
  userId: "00000000-0000-4000-8000-000000000002",
  name: "Synthetic Product Manager",
  role: "PRODUCT_MANAGER",
};

/** Who hands the order over, and the percent of the total due before it ships. */
export interface ContractScenario {
  readonly label: string;
  readonly person: HandoffPerson;
  readonly prepaymentPercent: string;
}

export const SUPPORT_SCENARIO: ContractScenario = {
  label: "a Support user",
  person: SUPPORT_PERSON,
  prepaymentPercent: "30.00",
};

export const SCENARIOS: readonly ContractScenario[] = [
  SUPPORT_SCENARIO,
  {
    label: "a Product Manager",
    person: PRODUCT_MANAGER_PERSON,
    prepaymentPercent: "30.00",
  },
  {
    label: "no prepayment due",
    person: SUPPORT_PERSON,
    prepaymentPercent: "0.00",
  },
];

/** Frozen all the way down, so an implementation that edits the fact it was given throws. */
function frozen<T extends object>(fact: T): T {
  for (const value of Object.values(fact) as unknown[]) {
    if (typeof value === "object" && value !== null && !(value instanceof Date))
      Object.freeze(value);
  }
  return Object.freeze(fact);
}

export function submittedFact(
  orderNo: string,
  overrides: Partial<OrderSubmitted> = {},
): OrderSubmitted {
  return frozen({
    orderNo,
    customerNo: "C-0001",
    submittedBy: { ...SUPPORT_PERSON },
    submittedAt: new Date("2026-11-26T03:00:00.000Z"),
    total: "1200.00",
    prepaymentPercent: "30.00",
    poVersionNo: 1,
    request: { ip: null, traceId: "contract-1" },
    ...overrides,
  });
}

export function confirmedFact(
  orderNo: string,
  overrides: Partial<PoVersionConfirmed> = {},
): PoVersionConfirmed {
  return frozen({
    orderNo,
    poVersionNo: 2,
    supersedesPoVersionNo: 1,
    confirmedBy: { ...SUPPORT_PERSON },
    confirmedAt: new Date("2026-11-26T04:00:00.000Z"),
    total: "900.00",
    prepaymentPercent: "30.00",
    request: { ip: null, traceId: "contract-1" },
    ...overrides,
  });
}

function submittedFor(
  orderNo: string,
  scenario: ContractScenario,
): OrderSubmitted {
  return submittedFact(orderNo, {
    submittedBy: { ...scenario.person },
    prepaymentPercent: scenario.prepaymentPercent,
  });
}

function confirmedFor(
  orderNo: string,
  scenario: ContractScenario,
): PoVersionConfirmed {
  return confirmedFact(orderNo, {
    confirmedBy: { ...scenario.person },
    prepaymentPercent: scenario.prepaymentPercent,
  });
}

/** Runs the work through the factory's transaction when it has one. */
function run<T>(
  under: OrderHandoffUnderTest,
  work: () => Promise<T>,
): Promise<T> {
  return under.within ? under.within(work) : work();
}

/**
 * A call's answer, or its refusal. A refusal is allowed, but only as a
 * `DomainError`: anything else is a crash, and it would roll area 1's write
 * back as a 500 instead of the refusal's own words.
 */
async function answerOf(
  under: OrderHandoffUnderTest,
  call: () => Promise<HandoffAnswer>,
): Promise<HandoffAnswer | DomainError> {
  try {
    return await run(under, call);
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

function needs<T>(part: T | undefined, name: string, check: string): T {
  if (part === undefined)
    throw new Error(`${check} needs the factory to give ${name}`);
  return part;
}

/** Catches an answer of the wrong shape, a plain Error from a call, and an edit to the fact. */
export async function checkAnswerShape(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const fact = submittedFor(under.freshOrderNo(), scenario);
  const before = structuredClone(fact);

  const answer = await answerOf(under, () => under.handoff.submitted(fact));

  if (!(answer instanceof DomainError)) expectAnAnswer(answer);
  expect(fact).toEqual(before);
}

/** Catches a `submitted` that has its effect again when the same order comes twice. */
export async function checkSubmittedRepeat(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const fact = submittedFor(under.freshOrderNo(), scenario);

  const first = await answerOf(under, () => under.handoff.submitted(fact));
  const second = await answerOf(under, () => under.handoff.submitted(fact));

  // A refused first call may refuse again; only an answer is held to the rule.
  if (first instanceof DomainError) return;
  // Whatever the first call did, the repeat has nothing left to do.
  expect(second).toEqual(NONE);
}

/** Catches a PO version of an order with no workflow that throws or claims an effect. */
export async function checkNoWorkflowAnswersNone(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const answer = await run(under, () =>
    under.handoff.poVersionConfirmed(
      confirmedFor(under.freshOrderNo(), scenario),
    ),
  );

  expect(answer).toEqual(NONE);
}

/** Catches a `poVersionConfirmed` that has its effect again when the same version comes twice. */
export async function checkPoVersionRepeat(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const orderNo = under.freshOrderNo();
  const started = await answerOf(under, () =>
    under.handoff.submitted(submittedFor(orderNo, scenario)),
  );
  if (started instanceof DomainError) return;
  const fact = confirmedFor(orderNo, scenario);
  const before = structuredClone(fact);

  const first = await answerOf(under, () =>
    under.handoff.poVersionConfirmed(fact),
  );
  const second = await answerOf(under, () =>
    under.handoff.poVersionConfirmed(fact),
  );

  if (first instanceof DomainError) return;
  expectAnAnswer(first);
  expect(second).toEqual(NONE);
  expect(fact).toEqual(before);
}

/**
 * Needs `hasWorkflow`. Catches a stub that answers `applied` and starts no
 * workflow, and a repeat that leaves the order without the workflow it had.
 */
export async function checkWorkflowAfterSubmit(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const hasWorkflow = needs(
    under.hasWorkflow,
    "hasWorkflow",
    "checkWorkflowAfterSubmit",
  );
  const orderNo = under.freshOrderNo();
  const fact = submittedFor(orderNo, scenario);

  const first = await answerOf(under, () => under.handoff.submitted(fact));
  if (first instanceof DomainError) return;
  const started = first.effect === "applied";
  expect(await hasWorkflow(orderNo), "after the first call").toBe(started);

  const second = await answerOf(under, () => under.handoff.submitted(fact));

  expect(second).toEqual(NONE);
  expect(await hasWorkflow(orderNo), "after the repeat").toBe(started);
}

/**
 * Needs `hasWorkflow`. A first `submitted` for an order with no workflow
 * starts one and answers `applied`. An implementation that answers `none`
 * fails, unless it says it is a stand-in, and a stand-in must answer `none`.
 */
export async function checkFirstSubmittedStartsAWorkflow(
  under: OrderHandoffUnderTest,
  scenario: ContractScenario = SUPPORT_SCENARIO,
): Promise<void> {
  const hasWorkflow = needs(
    under.hasWorkflow,
    "hasWorkflow",
    "checkFirstSubmittedStartsAWorkflow",
  );
  const orderNo = under.freshOrderNo();

  const first = await answerOf(under, () =>
    under.handoff.submitted(submittedFor(orderNo, scenario)),
  );

  // A refusal of a first call is allowed; the refusal check holds its type.
  if (first instanceof DomainError) return;
  if (under.standIn === true) {
    expect(first, "a stand-in changes nothing").toEqual(NONE);
    expect(await hasWorkflow(orderNo), "a stand-in starts nothing").toBe(false);
    return;
  }
  expect(first, "a first submitted starts the workflow").toEqual(APPLIED);
  expect(await hasWorkflow(orderNo), "the workflow it started").toBe(true);
}

/** Catches a refusal that is not a `DomainError`, or a refusing call that does not refuse. */
export async function checkRefusalsAreDomainErrors(
  under: OrderHandoffUnderTest,
): Promise<void> {
  for (const refusal of under.refusals ?? []) {
    await expect(run(under, refusal.call), refusal.name).rejects.toBeInstanceOf(
      DomainError,
    );
  }
}

/**
 * Needs `within`, `rollbackProbe` and a refusal. Catches a refusal that
 * leaves area 1's write in place. A control first shows that the probe's
 * write does stay when nothing refuses, so a probe that never writes cannot
 * pass this check.
 */
export async function checkRefusalRollsBack(
  under: OrderHandoffUnderTest,
): Promise<void> {
  const within = needs(under.within, "within", "checkRefusalRollsBack");
  const probe = needs(
    under.rollbackProbe,
    "rollbackProbe",
    "checkRefusalRollsBack",
  );
  const refusals = under.refusals ?? [];
  if (refusals.length === 0)
    throw new Error(
      "checkRefusalRollsBack needs the factory to give a refusal",
    );

  const kept = under.freshOrderNo();
  await within(() => probe.writeBeforeCall(kept));
  expect(await probe.readBack(kept), "a write with no refusal stays").toBe(
    true,
  );

  for (const refusal of refusals) {
    const marker = under.freshOrderNo();
    await expect(
      within(async () => {
        await probe.writeBeforeCall(marker);
        await refusal.call();
      }),
      refusal.name,
    ).rejects.toBeInstanceOf(DomainError);
    expect(
      await probe.readBack(marker),
      `${refusal.name}: the write before the refusal`,
    ).toBe(false);
  }
}

function givenParts(under: OrderHandoffUnderTest): OptionalPart[] {
  const given: OptionalPart[] = [];
  if (under.within) given.push("within");
  if (under.rollbackProbe) given.push("rollbackProbe");
  if (under.hasWorkflow) given.push("hasWorkflow");
  if (under.refusals && under.refusals.length > 0) given.push("refusals");
  return given;
}

/**
 * The checks any `OrderHandoff` must pass (ADR 0072). Call it inside a test
 * file with a factory for the implementation, as area 2 does for its class.
 * `mock/logging-order-handoff.test.ts` runs it against the stand-in, and
 * `order-handoff.contract.test.ts` against a correct in-memory class.
 *
 * The calls run for a Support user, for a Product Manager and with no
 * prepayment due.
 *
 * What a factory that gives none of the optional parts leaves untested:
 * - without `within`, that the calls work inside a transaction, which is how
 *   area 1 will make them;
 * - without `rollbackProbe` and a refusal, that a refusal rolls area 1's
 *   write back;
 * - without `hasWorkflow`, that a first `submitted` really starts a workflow:
 *   a stub that answers `applied` and does nothing passes every other check,
 *   and so does a class that answers `none` and is no stand-in.
 * Each check that needs a missing part is registered as a skipped test whose
 * name says which part is missing, so a green run is never read as more.
 */
export function describeOrderHandoffContract(
  name: string,
  make: () => Promise<OrderHandoffUnderTest> | OrderHandoffUnderTest,
  parts: readonly OptionalPart[] = [],
): void {
  const declared = new Set<OptionalPart>(parts);
  const has = (...needed: OptionalPart[]) =>
    needed.every((part) => declared.has(part));
  const registerWhen = (
    needed: OptionalPart[],
    title: string,
    body: () => Promise<void>,
  ) => {
    if (has(...needed)) it(title, body);
    else
      it.skip(
        `SKIPPED, the factory gave no ${needed.filter((part) => !declared.has(part)).join(" and no ")}: ${title}`,
        body,
      );
  };

  describe(`the OrderHandoff contract: ${name}`, () => {
    it("gives exactly the optional parts it declares", async () => {
      expect(givenParts(await make()).sort()).toEqual([...declared].sort());
    });

    for (const scenario of SCENARIOS) {
      describe(`for ${scenario.label}`, () => {
        it("answers only none or applied for a submitted order, and does not edit the fact", async () => {
          await checkAnswerShape(await make(), scenario);
        });

        it("has the effect of one call when the same submitted fact comes twice", async () => {
          await checkSubmittedRepeat(await make(), scenario);
        });

        it("answers none for a PO version of an order with no workflow, and does not throw", async () => {
          await checkNoWorkflowAnswersNone(await make(), scenario);
        });

        it("has the effect of one call when the same PO version comes twice", async () => {
          await checkPoVersionRepeat(await make(), scenario);
        });

        registerWhen(
          ["hasWorkflow"],
          "leaves the order with its workflow after a submitted call and after a repeat",
          async () => checkWorkflowAfterSubmit(await make(), scenario),
        );

        registerWhen(
          ["hasWorkflow"],
          "starts a workflow on a first submitted call, unless it is a stand-in, which changes nothing",
          async () =>
            checkFirstSubmittedStartsAWorkflow(await make(), scenario),
        );
      });
    }

    registerWhen(
      ["within"],
      "runs every call of the contract inside the factory transaction",
      async () => {
        const under = await make();
        const within = needs(under.within, "within", "this check");
        let calls = 0;
        await checkSubmittedRepeat({
          ...under,
          within: (work) => {
            calls += 1;
            return within(work);
          },
        });
        // Two submitted calls, and each one went through the transaction.
        expect(calls).toBe(2);
      },
    );

    registerWhen(
      ["refusals"],
      "refuses with a DomainError wherever it means to refuse",
      async () => checkRefusalsAreDomainErrors(await make()),
    );

    registerWhen(
      ["within", "rollbackProbe", "refusals"],
      "rolls back a write made just before a refusal, in the same transaction",
      async () => checkRefusalRollsBack(await make()),
    );
  });
}
