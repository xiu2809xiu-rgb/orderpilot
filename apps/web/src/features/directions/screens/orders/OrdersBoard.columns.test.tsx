import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OrdersBoard } from "./OrdersBoard";
import type { OrderRow } from "./orderRow";
import { loadNamespaces, makeRow } from "./ordersTestKit";

// The rows with no step are of three kinds, and each is under its own word:
// a sample the tracker has no step for, a stored order that is not in the
// order flow, and a stored order that a team holds, which the tracker cannot
// place on a step. None of them sits under a word that is false of it.

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

const SAMPLE = makeRow({ ...none, orderNo: "SO-0101", workflowStatus: null });
const TYPED = makeRow({
  ...none,
  orderNo: "SO-20261108-0102",
  source: "stored",
  captureState: "submitted",
  workflowStatus: null,
});
const HELD = makeRow({
  ...none,
  orderNo: "SO-20261108-0103",
  source: "stored",
  captureState: "submitted",
  workflowStatus: "Waiting for payment",
});

function draw(rows: OrderRow[]) {
  render(
    <OrdersBoard
      rows={rows}
      onPeek={() => undefined}
      onOpenStep={() => undefined}
    />,
  );
}

const column = (name: string) =>
  within(screen.getByRole("region", { name: "Orders by stage" })).queryByRole(
    "region",
    { name },
  );

describe("the board's columns for orders with no step", () => {
  it("puts a sample with no step under Not started, and under nothing that says it is not in the flow", () => {
    draw([SAMPLE]);
    const started = column("Not started");
    if (!started) throw new Error("no Not started column");
    expect(within(started).getByText("SO-0101")).toBeVisible();
    expect(column("Not in the order flow")).toBeNull();
    expect(column("In the order flow")).toBeNull();
  });

  it("puts a typed-in order under Not in the order flow, and not under Not started", () => {
    draw([TYPED]);
    const outside = column("Not in the order flow");
    if (!outside) throw new Error("no Not in the order flow column");
    expect(within(outside).getByText("SO-20261108-0102")).toBeVisible();
    expect(column("Not started")).toBeNull();
    expect(column("In the order flow")).toBeNull();
  });

  it("puts a stored order that a team holds in neither of those, under In the order flow", () => {
    draw([HELD]);
    const held = column("In the order flow");
    if (!held) throw new Error("no In the order flow column");
    expect(within(held).getByText("SO-20261108-0103")).toBeVisible();
    expect(column("Not started")).toBeNull();
    expect(column("Not in the order flow")).toBeNull();
  });

  it("draws each last column only when it has rows, and gives every order exactly one place", () => {
    draw([SAMPLE, TYPED, HELD]);
    const cards = screen
      .getAllByRole("button", { name: /^SO-/ })
      .map((button) => button.textContent);
    expect(cards.sort()).toEqual([
      "SO-0101",
      "SO-20261108-0102",
      "SO-20261108-0103",
    ]);
    for (const name of [
      "Not started",
      "Not in the order flow",
      "In the order flow",
    ]) {
      const section = column(name);
      if (!section) throw new Error(`no ${name} column`);
      expect(
        within(section).getAllByRole("button", { name: /^SO-/ }),
      ).toHaveLength(1);
    }
  });
});
