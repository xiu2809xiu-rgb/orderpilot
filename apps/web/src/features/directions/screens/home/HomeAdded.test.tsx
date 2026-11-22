import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import {
  HOLDING,
  OVERDUE_ORDER,
  REFUSED_EVENT,
  RULES,
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
  type Served,
} from "./homeTestKit";

/**
 * The blocks a role gets besides its main one, chosen by permission: the most
 * overdue orders directly below "Needs you" for a role with an inbox that may
 * decide approvals and read the tracker, and the latest refused actions below
 * the rules and the health of the services for a role that manages settings
 * and reads the audit trail. Each asks for its list only where it is drawn.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

const OVERDUE = "Most overdue, by amount";
const REFUSED = "Latest refused actions";
const TREND = "Twelve weeks of the five measures";

/** The block's own request, as the screen sent it: the overdue list by amount, the five latest refusals. */
const askedForOverdue = (served: Served) =>
  served.calls.some((call) => call.includes("sort=amount"));
const askedForRefused = (served: Served) =>
  served.calls.some(
    (call) => call.includes("refusalsOnly=true") && call.includes("pageSize=5"),
  );

const headings = () =>
  screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);

function serve() {
  return serveHome({
    tasks: [makeTask({ assigneeRole: "APPROVER" })],
    overdue: [OVERDUE_ORDER],
    overdueTotal: 21,
    refused: [REFUSED_EVENT],
    rules: RULES,
  });
}

describe("a role with an inbox that may decide approvals and read the tracker", () => {
  it("has the overdue orders directly below Needs you, across the whole page", async () => {
    serve();
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    const section = await screen.findByRole("region", { name: OVERDUE });
    expect(
      await within(section).findByText("Packing list differs from the PO"),
    ).toBeVisible();
    await screen.findByRole("heading", { level: 2, name: "My timeline" });
    await screen.findByRole("heading", {
      level: 2,
      name: "Orders in each step",
    });
    // The overview first, then Needs you with the overdue orders directly below it.
    expect(headings().slice(0, 5)).toEqual([
      "My timeline",
      "Your numbers",
      "Orders in each step",
      "Needs you",
      OVERDUE,
    ]);
    // On a row of the page of its own: not inside the pair of the timeline and the numbers.
    const pair = screen
      .getByRole("region", { name: "My timeline" })
      .closest("div.lg\\:grid-cols-2");
    expect(pair).not.toBeNull();
    expect(pair?.contains(section)).toBe(false);
    expect(
      within(section).getByRole("link", { name: "View all (21)" }),
    ).toHaveAttribute("href", "/orders?overdue=true");
  });

  it("asks the server for the overdue orders, and not for the refused actions", async () => {
    const served = serve();
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    await screen.findByText("Packing list differs from the PO");
    expect(askedForOverdue(served)).toBe(true);
    expect(askedForRefused(served)).toBe(false);
  });

  it("keeps the sentence under the greeting about its tasks", async () => {
    serve();
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    expect(
      await screen.findByText(
        "1 task is waiting for you. 1 is past its due time.",
      ),
    ).toBeVisible();
  });

  it("says so when no order is overdue", async () => {
    serveHome({ tasks: [makeTask({ assigneeRole: "APPROVER" })], overdue: [] });
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    const section = await screen.findByRole("region", { name: OVERDUE });
    expect(
      await within(section).findByText("No order is overdue"),
    ).toBeVisible();
  });

  it("shows the error with its trace id and a retry inside the block when the orders cannot load", async () => {
    const served = serveHome({
      tasks: [makeTask({ assigneeRole: "APPROVER" })],
      blockStatus: 500,
    });
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    const section = await screen.findByRole("region", { name: OVERDUE });
    const alert = await within(section).findByRole("alert");
    expect(alert).toHaveTextContent("trace-home-1");
    const before = served.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(served.calls.length).toBeGreaterThan(before);
    });
  });

  it("says the role may not read the orders, inside the block, when the server refuses", async () => {
    serveHome({
      tasks: [makeTask({ assigneeRole: "APPROVER" })],
      blockStatus: 403,
    });
    renderHome("APPROVER", { permissions: HOLDING.approvals });
    const section = await screen.findByRole("region", { name: OVERDUE });
    expect(
      await within(section).findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeVisible();
  });

  it("has no accessibility violation", async () => {
    serve();
    const { container } = renderHome("APPROVER", {
      permissions: HOLDING.approvals,
    });
    await screen.findByText("Packing list differs from the PO");
    await screen.findByRole("heading", { level: 2, name: "My timeline" });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);

  it.each([
    ["decide approvals", ["tracker.read", "tasks.complete"]],
    ["read the tracker", ["approvals.decide", "tasks.complete"]],
  ] as const)(
    "has no overdue block when it may not %s",
    async (_missing, permissions) => {
      const served = serve();
      renderHome("APPROVER", { permissions });
      await screen.findByRole("heading", { level: 2, name: "My timeline" });
      expect(
        screen.queryByRole("heading", { level: 2, name: OVERDUE }),
      ).toBeNull();
      expect(askedForOverdue(served)).toBe(false);
    },
  );
});

describe("a role that manages settings and reads the audit trail", () => {
  it("has the refused actions below its rules and the health of its services", async () => {
    serve();
    renderHome("SYSTEM_ADMIN", { permissions: HOLDING.settings });
    const section = await screen.findByRole("region", { name: REFUSED });
    expect(
      await within(section).findByText(
        "Hafiz Rahman was refused viewing the audit trail",
      ),
    ).toBeVisible();
    await screen.findByRole("heading", { level: 2, name: "System health" });
    const names = headings();
    const rules = names.indexOf("Business rules from Spectra");
    const health = names.indexOf("System health");
    const refused = names.indexOf(REFUSED);
    expect(rules).toBe(0);
    expect(health).toBe(1);
    expect(refused).toBe(2);
    // Below the pair, not inside it.
    const pair = screen
      .getByRole("region", { name: "System health" })
      .closest("div.lg\\:grid-cols-2");
    expect(pair).not.toBeNull();
    expect(pair?.contains(section)).toBe(false);
  });

  it("asks the server for the refused actions, and not for the overdue orders", async () => {
    const served = serve();
    renderHome("SYSTEM_ADMIN", { permissions: HOLDING.settings });
    await screen.findByText("Hafiz Rahman was refused viewing the audit trail");
    expect(askedForRefused(served)).toBe(true);
    expect(askedForOverdue(served)).toBe(false);
  });

  it("says so when nothing was refused", async () => {
    serveHome({ rules: RULES, refused: [] });
    renderHome("SYSTEM_ADMIN", { permissions: HOLDING.settings });
    const section = await screen.findByRole("region", { name: REFUSED });
    expect(
      await within(section).findByText("No refused actions"),
    ).toBeVisible();
  });

  it("shows the error with its trace id inside the block when the actions cannot load", async () => {
    serveHome({ blockStatus: 500 });
    renderHome("SYSTEM_ADMIN", { permissions: HOLDING.settings });
    const section = await screen.findByRole("region", { name: REFUSED });
    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "trace-home-1",
    );
  });

  it("says the role may not read the actions, inside the block, when the server refuses", async () => {
    serveHome({ blockStatus: 403 });
    renderHome("SYSTEM_ADMIN", { permissions: HOLDING.settings });
    const section = await screen.findByRole("region", { name: REFUSED });
    expect(
      await within(section).findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeVisible();
  });

  it("has no accessibility violation", async () => {
    serve();
    const { container } = renderHome("SYSTEM_ADMIN", {
      permissions: HOLDING.settings,
    });
    await screen.findByText("Hafiz Rahman was refused viewing the audit trail");
    await screen.findByRole("heading", { level: 2, name: "System health" });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);

  it("has no refused block when it may not read the audit trail", async () => {
    const served = serve();
    renderHome("SYSTEM_ADMIN", { permissions: ["settings.manage"] });
    await screen.findByRole("heading", { level: 2, name: "System health" });
    expect(
      screen.queryByRole("heading", { level: 2, name: REFUSED }),
    ).toBeNull();
    expect(askedForRefused(served)).toBe(false);
  });
});

describe("a role with a different block", () => {
  it.each(["SUPPORT", "WAREHOUSE", "FINANCE", "LOGISTICS"] as const)(
    "asks for neither the overdue orders nor the refused actions (%s)",
    async (role) => {
      const served = serve();
      renderHome(role);
      await screen.findByRole("heading", { level: 2, name: "My timeline" });
      expect(askedForOverdue(served)).toBe(false);
      expect(askedForRefused(served)).toBe(false);
    },
  );
});

describe("the twelve-week trend", () => {
  it("shows where the overdue block shows and the insights are read", async () => {
    serve();
    renderHome("APPROVER", {
      permissions: [...HOLDING.approvals, "insights.read"],
    });
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: TREND },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: OVERDUE }),
    ).toBeVisible();
  }, 30_000);

  it("is not shown to a role that reads the insights and has no overdue block", async () => {
    serve();
    renderHome("PRODUCT_MANAGER", {
      permissions: ["tracker.read", "insights.read", "tasks.complete"],
    });
    await screen.findByText(/^Lab estimate:/);
    expect(
      screen.queryByRole("heading", { level: 2, name: OVERDUE }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: TREND })).toBeNull();
  });

  it("is not shown where the refused actions are the block", async () => {
    serve();
    renderHome("AUDITOR", { permissions: HOLDING.auditOnly });
    await screen.findByText(/^Lab estimate:/);
    expect(
      screen.getByRole("heading", { level: 2, name: REFUSED }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { level: 2, name: TREND })).toBeNull();
  });
});
