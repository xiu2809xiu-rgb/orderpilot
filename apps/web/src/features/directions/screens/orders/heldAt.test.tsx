import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { stageFactsOf } from "../order/stageFacts";
import { HeldAtCell } from "./HeldAtCell";
import { PeekFacts } from "./PeekFacts";
import { ALL_DONE, type OrderRow } from "./orderRow";
import { loadNamespaces, makeRow } from "./ordersTestKit";

// "Held at" says one thing in three places: the list's cell, the peek and the
// page. Each state of an order is listed once, with the word all three say.

beforeAll(loadNamespaces);
afterEach(() => {
  vi.unstubAllGlobals();
});

const none = {
  status: null,
  ownerRole: null,
  step: null,
  overdue: null,
} as const;

interface State {
  name: string;
  row: OrderRow;
  /** The same order as the page reads it. */
  found: Pick<SalesOrderDetail, "source" | "captureState" | "workflowStatus">;
  /** The tracker's timeline, for the orders the tracker knows. */
  order?: Pick<OrderTimeline, "ownerRole" | "status">;
  word: string;
}

const STATES: State[] = [
  {
    name: "a sample with a step",
    row: makeRow(),
    found: {
      source: "sample",
      captureState: null,
      workflowStatus: "Waiting for payment",
    },
    order: {
      ownerRole: "FINANCE",
      status: { code: "sample-awaiting-payment", label: "Waiting for payment" },
    },
    word: "Finance",
  },
  {
    name: "a sample with none",
    row: makeRow({ ...none, workflowStatus: null }),
    found: { source: "sample", captureState: null, workflowStatus: null },
    word: "Not set",
  },
  {
    name: "a draft",
    row: makeRow({
      ...none,
      source: "stored",
      captureState: "draft",
      workflowStatus: null,
    }),
    found: { source: "stored", captureState: "draft", workflowStatus: null },
    word: "Not set",
  },
  {
    name: "a void order",
    row: makeRow({
      ...none,
      source: "stored",
      captureState: "void",
      workflowStatus: null,
    }),
    found: { source: "stored", captureState: "void", workflowStatus: null },
    word: "Not set",
  },
  {
    name: "a typed-in order that no team holds",
    row: makeRow({
      ...none,
      source: "stored",
      captureState: "submitted",
      workflowStatus: null,
    }),
    found: {
      source: "stored",
      captureState: "submitted",
      workflowStatus: null,
    },
    word: "Nobody",
  },
  {
    name: "a stored order that a team holds",
    row: makeRow({
      ...none,
      source: "stored",
      captureState: "submitted",
      workflowStatus: "Waiting for payment",
    }),
    found: {
      source: "stored",
      captureState: "submitted",
      workflowStatus: "Waiting for payment",
    },
    word: "Not set",
  },
];

const roleLabel = (role: string) => i18n.t(`common:roles.${role}`);
const names = STATES.map((state) => [state.name, state] as const);

describe("Held at in the list's cell", () => {
  it.each(names)("says the same word for %s", (_name, state) => {
    render(<HeldAtCell row={state.row} roleLabel={roleLabel} />);
    expect(screen.getByText(state.word)).toBeVisible();
  });

  it("says Done for an order with every step done", () => {
    render(
      <HeldAtCell
        row={makeRow({ step: ALL_DONE, ownerRole: "SUPPORT" })}
        roleLabel={roleLabel}
      />,
    );
    expect(screen.getByText("Done")).toBeVisible();
  });
});

describe("Held at in the peek", () => {
  it.each(names)("says the same word for %s", (_name, state) => {
    render(<PeekFacts row={state.row} roleLabel={roleLabel} />, {
      wrapper: MemoryRouter,
    });
    const fact = screen.getByText("Held at").closest("div");
    if (!fact) throw new Error("no fact");
    expect(within(fact).getByText(state.word)).toBeVisible();
  });

  it("says Done for an order with every step done", () => {
    render(
      <PeekFacts
        row={makeRow({ step: ALL_DONE, ownerRole: "SUPPORT" })}
        roleLabel={roleLabel}
      />,
      { wrapper: MemoryRouter },
    );
    const fact = screen.getByText("Held at").closest("div");
    if (!fact) throw new Error("no fact");
    expect(within(fact).getByText("Done")).toBeVisible();
  });
});

describe("Held at on the page", () => {
  const t = i18n.getFixedT("en", "directions-orders");
  const tc = i18n.getFixedT("en", "common");

  it.each(names)("says the same word for %s", (_name, state) => {
    const facts = stageFactsOf({
      t,
      tc,
      order: state.order as OrderTimeline | undefined,
      found: state.found as SalesOrderDetail,
    });
    expect(facts.heldAt).toBe(state.word);
  });
});
