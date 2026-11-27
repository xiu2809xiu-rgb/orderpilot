import { screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { loadNamespaces, renderAt } from "../orders/ordersTestKit";
import { CountTile } from "./CountTile";

// A tile stands for a count, so its figure shimmers while the count is on its
// way. The rows of a list do not (RowSkeletons).

beforeAll(async () => {
  await loadNamespaces();
});

beforeEach(() => {
  // The count never arrives, so the tile stays pending.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
  const session = sessionFor("SUPPORT");
  useSessionStore.setState({ status: "active", session });
});

describe("a home tile while its count loads", () => {
  it("shimmers the figure's block and names what it is waiting for", () => {
    const session = sessionFor("SUPPORT");
    const found = cuesFor(session).find(({ cue }) => cue.id === "openOrders");
    if (!found) throw new Error("no openOrders tile");
    renderAt(<CountTile cue={found.cue} />, "/");
    const block = screen.getByRole("status", { name: "Loading Open orders" });
    expect(block).toHaveAttribute("data-slot", "skeleton");
    expect(block).toHaveClass("dx-shimmer");
    expect(block).not.toHaveClass("animate-none");
  });
});
