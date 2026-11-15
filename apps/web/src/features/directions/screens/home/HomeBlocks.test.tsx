import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, delay, http } from "msw";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { server } from "@/test/server";
import {
  OVERDUE_ORDER,
  REFUSED_EVENT,
  RULES,
  loadHomeNamespaces,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * The block of each role with no inbox, where "Needs you" would be: Management
 * has its overdue orders, the auditor the actions that were refused, the
 * system administrator the rules that wait for Spectra. Each reads like a task
 * row (what it is, the record as a link, when, one action) and has every state.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

function block(name: string) {
  return screen.getByRole("region", { name });
}

describe("Management's overdue orders", () => {
  const NAME = "Most overdue, by amount";

  it("lists each order with where it stands, how late, the amount and one action", async () => {
    const served = serveHome({ overdue: [OVERDUE_ORDER], overdueTotal: 21 });
    renderHome("MANAGEMENT");
    const section = await screen.findByRole("region", { name: NAME });
    const row = await within(section).findByText(
      "Packing list differs from the PO",
    );
    expect(row).toBeVisible();
    expect(
      within(section).getByRole("link", { name: "SO-0045" }),
    ).toHaveAttribute("href", "/orders/SO-0045");
    expect(
      within(section).getByText("Kandaleya Electronics (Pvt) Ltd"),
    ).toBeVisible();
    expect(within(section).getByText("3 days late")).toBeVisible();
    expect(within(section).getByText("USD 31,406.97")).toBeVisible();
    expect(
      within(section).getByRole("link", { name: "Open order: SO-0045" }),
    ).toHaveAttribute("href", "/orders/SO-0045");
    // The biggest first, five at most, and the whole list one click away.
    expect(
      served.calls.some(
        (call) =>
          call.includes("overdue=true") &&
          call.includes("sort=amount") &&
          call.includes("direction=desc"),
      ),
    ).toBe(true);
    expect(
      within(section).getByRole("link", { name: "View all (21)" }),
    ).toHaveAttribute("href", "/orders?overdue=true");
    expect(
      await screen.findByText(
        "21 orders are overdue. The ones worth the most are first.",
      ),
    ).toBeVisible();
  });

  it("says no order is overdue, and does not ask for tasks it has none of", async () => {
    const served = serveHome({ overdue: [] });
    renderHome("MANAGEMENT");
    expect(await screen.findByText("No order is overdue")).toBeVisible();
    expect(served.calls.some((call) => call.endsWith("/workflows/tasks"))).toBe(
      false,
    );
  });

  it("shows the shape of its rows while it loads", async () => {
    server.use(
      http.get("*/api/v1/*", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    renderHome("MANAGEMENT");
    const section = await screen.findByRole("region", { name: NAME });
    expect(within(section).getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows the error with its trace id and a retry when the orders cannot load", async () => {
    const served = serveHome({ blockStatus: 500 });
    renderHome("MANAGEMENT");
    const alert = await within(
      await screen.findByRole("region", { name: NAME }),
    ).findByRole("alert");
    expect(alert).toHaveTextContent("trace-home-1");
    const before = served.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(served.calls.length).toBeGreaterThan(before);
    });
  });

  it("says the role may not read the orders when the server refuses", async () => {
    serveHome({ blockStatus: 403 });
    renderHome("MANAGEMENT");
    expect(
      await within(
        await screen.findByRole("region", { name: NAME }),
      ).findByRole("heading", {
        name: "You do not have access to this",
      }),
    ).toBeVisible();
  });

  it("has no accessibility violation", async () => {
    serveHome({ overdue: [OVERDUE_ORDER], overdueTotal: 21 });
    const { container } = renderHome("MANAGEMENT");
    await screen.findByText("Packing list differs from the PO");
    await screen.findByText(/^Lab estimate:/);
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});

describe("the auditor's refused actions", () => {
  const NAME = "Latest refused actions";

  it("lists each refusal with who, which event and when, and opens it in the audit trail", async () => {
    serveHome({ refused: [REFUSED_EVENT] });
    renderHome("AUDITOR");
    const section = await screen.findByRole("region", { name: NAME });
    expect(
      await within(section).findByText(
        "Hafiz Rahman was refused viewing the audit trail",
      ),
    ).toBeVisible();
    expect(
      within(section).getByRole("link", { name: "Event 557" }),
    ).toHaveAttribute("href", `/audit?event=${REFUSED_EVENT.id}`);
    expect(within(section).getByText("Hafiz Rahman")).toBeVisible();
    expect(within(section).getByText("1 hour ago")).toBeVisible();
    expect(
      within(section).getByRole("link", {
        name: /^Open: Hafiz Rahman was refused/,
      }),
    ).toHaveAttribute("href", `/audit?event=${REFUSED_EVENT.id}`);
  });

  it("links the whole list when more were refused than are shown", async () => {
    serveHome({});
    // Later handlers win, so this one answers before the kit's.
    server.use(
      http.get("*/api/v1/audit/events", () =>
        HttpResponse.json({
          data: [REFUSED_EVENT],
          meta: { page: 1, pageSize: 5, total: 54, mock: true },
        }),
      ),
    );
    renderHome("AUDITOR");
    expect(
      await screen.findByRole("link", { name: "View all (54)" }),
    ).toHaveAttribute("href", "/audit?refusals=1");
  });

  it("says nothing was refused", async () => {
    serveHome({ refused: [] });
    renderHome("AUDITOR");
    expect(await screen.findByText("No refused actions")).toBeVisible();
  });

  it("shows the error with its trace id and a retry", async () => {
    serveHome({ blockStatus: 500 });
    renderHome("AUDITOR");
    const alert = await within(
      await screen.findByRole("region", { name: NAME }),
    ).findByRole("alert");
    expect(alert).toHaveTextContent("trace-home-1");
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });
});

describe("the system administrator's business rules", () => {
  const NAME = "Business rules from Spectra";

  it("shows what Spectra confirmed beside what still waits, and leads nowhere", async () => {
    serveHome({ rules: RULES });
    renderHome("SYSTEM_ADMIN");
    const section = await screen.findByRole("region", { name: NAME });
    expect(await within(section).findByText("Who approves")).toBeVisible();
    expect(
      within(section).getByText(
        "Any one of three management approvers decides, after a coordinator routes it",
      ),
    ).toBeVisible();
    // The settled rule says so, with the date of the briefing; the open one still waits.
    expect(within(section).getByText("Confirmed 5 Nov")).toBeVisible();
    expect(within(section).getByText("Approval limits")).toBeVisible();
    expect(within(section).getByText("To confirm")).toBeVisible();
    // Each stays a setting: no row opens a screen, and nothing in it is a button.
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    expect(
      await screen.findByText(
        "1 business rule waits for Spectra to confirm it.",
      ),
    ).toBeVisible();
  });

  it("says no rule is waiting", async () => {
    serveHome({ rules: [] });
    renderHome("SYSTEM_ADMIN");
    expect(await screen.findByText("No rule is waiting")).toBeVisible();
  });

  it("shows the error with its trace id and a retry", async () => {
    serveHome({ blockStatus: 500 });
    renderHome("SYSTEM_ADMIN");
    const alert = await within(
      await screen.findByRole("region", { name: NAME }),
    ).findByRole("alert");
    expect(alert).toHaveTextContent("trace-home-1");
  });

  it("is a real home page: a greeting, its numbers, its list and the health of its services", async () => {
    serveHome({ rules: RULES });
    renderHome("SYSTEM_ADMIN");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Daniel$/,
      }),
    ).toBeVisible();
    expect(block(NAME)).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "Your numbers" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("region", { name: "System health" }),
    ).toBeVisible();
  });
});
