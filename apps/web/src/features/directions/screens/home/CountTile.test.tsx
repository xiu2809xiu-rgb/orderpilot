import { screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import {
  loadNamespaces,
  nth,
  renderAt,
  SPECS,
  stubApi,
  type OrderSpec,
} from "../orders/ordersTestKit";
import { CountTile } from "./CountTile";

const DRAFT: OrderSpec = {
  ...nth(SPECS, 1),
  customerName: "Entered Here Ltd",
  entered: "draft",
};

beforeAll(async () => {
  await loadNamespaces();
});

beforeEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.setState({ status: "active", session: null });
});

function cueOf(role: "SUPPORT", id: string) {
  const session = sessionFor(role);
  useSessionStore.setState({ status: "active", session });
  const found = cuesFor(session).find(({ cue }) => cue.id === id);
  if (!found) throw new Error(`${role} has no ${id} tile`);
  return found.cue;
}

describe("a home tile whose list is the tracker's", () => {
  it("opens Orders with the same filter and counts what Orders shows", async () => {
    // Two orders entered here: Orders counts them as open, the tracker does not know them.
    stubApi({
      specs: [
        ...SPECS,
        { ...DRAFT, orderNo: "SO-9001" },
        { ...DRAFT, orderNo: "SO-9002" },
      ],
    });
    renderAt(<CountTile cue={cueOf("SUPPORT", "openOrders")} />, "/");
    const tile = await screen.findByRole("link", { name: /^Open orders\s*5$/ });
    expect(tile).toHaveAttribute("href", "/orders?open=true");
  });

  it("keeps the tracker's address and total for a role that may not read orders", async () => {
    stubApi({ specs: SPECS });
    // A role that has the tile but not orders.read keeps the tracker's page.
    const session = sessionFor("SUPPORT");
    useSessionStore.setState({
      status: "active",
      session: {
        ...session,
        permissions: session.permissions.filter((p) => p !== "orders.read"),
      },
    });
    const found = cuesFor(session).find(({ cue }) => cue.id === "openOrders");
    if (!found) throw new Error("no tile");
    renderAt(<CountTile cue={found.cue} />, "/");
    const tile = await screen.findByRole("link", { name: /^Open orders\s*4$/ });
    expect(tile).toHaveAttribute("href", "/order-tracker?open=true");
  });
});

describe("a home tile's label", () => {
  it("is the faint tier, on the card", async () => {
    stubApi({ specs: SPECS });
    renderAt(<CountTile cue={cueOf("SUPPORT", "openOrders")} />, "/");
    const tile = await screen.findByRole("link", {
      name: /^Open orders\s*\d+$/,
    });
    // The class is on the label's wrapper, which also holds the arrow.
    expect(
      must(within(tile).getByText("Open orders").parentElement),
    ).toHaveClass("text-faint-foreground");
  });
});
