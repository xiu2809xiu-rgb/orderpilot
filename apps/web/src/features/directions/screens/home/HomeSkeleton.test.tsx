import { ROLES, type Role } from "@orderpilot/shared";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { HomeSkeleton } from "./HomeSkeleton";

/** The main block and the added one of each role, as the default permissions give them. */
const BY_ROLE: Record<Role, { main: string; extra: string | null }> = {
  SYSTEM_ADMIN: { main: "rules", extra: "refused" },
  PRODUCT_MANAGER: { main: "tasks", extra: null },
  APPROVER: { main: "tasks", extra: "overdue" },
  SUPPORT: { main: "tasks", extra: null },
  WAREHOUSE: { main: "tasks", extra: null },
  FINANCE: { main: "tasks", extra: null },
  LOGISTICS: { main: "tasks", extra: null },
  MANAGEMENT: { main: "overdue", extra: null },
  AUDITOR: { main: "refused", extra: null },
};

describe("the home skeleton", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "anonymous", session: null });
  });

  it.each(ROLES)(
    "has the top row and as many count blocks as the page of %s",
    (role) => {
      useSessionStore.setState({ status: "active", session: sessionFor(role) });
      const { container } = render(<HomeSkeleton />);
      expect(
        container.querySelector("[data-block]")?.getAttribute("data-block"),
      ).toBe(BY_ROLE[role].main);
      // The room of an added block is kept, full width, and no other role has one.
      expect(
        container.querySelector("[data-extra]")?.getAttribute("data-extra") ??
          null,
      ).toBe(BY_ROLE[role].extra);
      const counts = cuesFor(sessionFor(role)).length;
      // The count blocks are the last grid's children.
      const grids = container.querySelectorAll(":scope > div > div.grid");
      const last = grids[grids.length - 1];
      const drawn =
        counts === 0 || grids.length < 2 ? 0 : (last?.children.length ?? 0);
      expect(drawn).toBe(counts);
    },
  );

  it("draws the approver's rows in the order of the page: Needs you, the overdue block, then the pair", () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("APPROVER"),
    });
    const { container } = render(<HomeSkeleton />);
    const marks = Array.from(
      container.querySelectorAll("[data-block], [data-extra], [data-pair]"),
    ).map((node) =>
      node.hasAttribute("data-block")
        ? "needs-you"
        : node.hasAttribute("data-extra")
          ? "overdue"
          : "pair",
    );
    expect(marks).toEqual(["needs-you", "overdue", "pair"]);
    // Needs you is one full-width block, not a column of a two-column row.
    const needs = container.querySelector("[data-block]");
    expect(needs?.parentElement?.className).not.toContain("grid");
    expect(container.querySelector("[data-pair]")?.children).toHaveLength(2);
  });

  it("draws an inbox role without an added block as Needs you, then the pair", () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SUPPORT"),
    });
    const { container } = render(<HomeSkeleton />);
    const marks = Array.from(
      container.querySelectorAll("[data-block], [data-extra], [data-pair]"),
    ).map((node) => (node.hasAttribute("data-block") ? "needs-you" : "pair"));
    expect(marks).toEqual(["needs-you", "pair"]);
  });
});
