import { ROLES, type Role } from "@orderpilot/shared";
import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
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

beforeAll(async () => {
  await i18n.loadNamespaces(["components"]);
});

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

  const MARKS = "[data-block], [data-extra], [data-pair], [data-flows]";
  const markOf = (node: Element) =>
    node.hasAttribute("data-block")
      ? "needs-you"
      : node.hasAttribute("data-extra")
        ? "overdue"
        : node.hasAttribute("data-flows")
          ? "flows"
          : "pair";

  it("draws the approver's rows in the order of the page: the pair, the flows, Needs you, then the overdue block", () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("APPROVER"),
    });
    const { container } = render(<HomeSkeleton />);
    const marks = Array.from(container.querySelectorAll(MARKS)).map(markOf);
    expect(marks).toEqual(["pair", "flows", "needs-you", "overdue"]);
    // Needs you is one full-width block, not a column of a two-column row.
    const needs = container.querySelector("[data-block]");
    expect(needs?.parentElement?.className).not.toContain("grid");
    expect(container.querySelector("[data-pair]")?.children).toHaveLength(2);
  });

  it("draws an inbox role without an added block as the pair, the flows, then Needs you", () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SUPPORT"),
    });
    const { container } = render(<HomeSkeleton />);
    const marks = Array.from(container.querySelectorAll(MARKS)).map(markOf);
    expect(marks).toEqual(["pair", "flows", "needs-you"]);
  });

  it("draws no flows block for an inbox role whose session cannot read the tracker", () => {
    const session = sessionFor("SUPPORT");
    useSessionStore.setState({
      status: "active",
      session: {
        ...session,
        permissions: session.permissions.filter(
          (permission) => permission !== "tracker.read",
        ),
      },
    });
    const { container } = render(<HomeSkeleton />);
    const marks = Array.from(container.querySelectorAll(MARKS)).map(markOf);
    expect(marks).toEqual(["pair", "needs-you"]);
    expect(container.querySelector("[data-flows]")).toBeNull();
  });

  it("guard: draws no flows block for a role without an inbox", () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SYSTEM_ADMIN"),
    });
    const { container } = render(<HomeSkeleton />);
    expect(container.querySelector("[data-flows]")).toBeNull();
  });

  it("is announced once as loading, and has no axe violation", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SUPPORT"),
    });
    const { container } = render(<HomeSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
    expect(await axeViolations(container)).toEqual([]);
  });
});
