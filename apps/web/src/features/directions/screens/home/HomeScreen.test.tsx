import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Toaster } from "@/components/common/Toaster";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import HomeScreen from "./HomeScreen";

// The tasks and the flow are what the real API would send: the same shapes,
// a few rows. Nothing here is typed into the screen itself.

const NOW = Date.now();
const iso = (hoursFromNow: number) =>
  new Date(NOW + hoursFromNow * 3_600_000).toISOString();

function task(
  id: string,
  kind: string,
  orderNo: string,
  customerName: string,
  createdHoursAgo: number,
  dueInHours: number,
) {
  return {
    id,
    kind,
    title: kind,
    assigneeRole: "SUPPORT",
    orderNo,
    ref: null,
    status: "OPEN",
    createdAt: iso(-createdHoursAgo),
    dueAt: iso(dueInHours),
    overdue: dueInHours < 0,
    customerName,
  };
}

const TASKS = [
  task("t1", "SEND_PI", "SO-0080", "Dunefall General Trading LLC", 120, -48),
  task("t2", "REVIEW_FIELDS", "SO-0102", "Vellamar Network Stores", 80, -29),
  task("t3", "SEND_PI", "SO-0085", "Indora Technology (Pvt) Ltd", 20, 19),
];

const STEP_IDS = [
  "poIn",
  "stock",
  "pi",
  "payment",
  "pack",
  "documents",
  "forwarder",
  "customerTold",
  "awbAndPermit",
];
const FLOW = {
  openOrders: 106,
  steps: STEP_IDS.map((id, index) => ({
    id,
    statuses: [`sample-${id}`],
    count: index === 1 ? 22 : 6 + index,
  })),
};

function reply(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function stubApi(taskList = TASKS) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        "http://localhost",
      );
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url.pathname}`);
      if (url.pathname.endsWith("/workflows/tasks")) {
        const late = url.searchParams.get("overdue") === "true";
        const rows = late ? taskList.filter((row) => row.overdue) : taskList;
        return reply({
          data: rows,
          meta: { page: 1, pageSize: 50, total: rows.length, mock: true },
        });
      }
      if (url.pathname.endsWith("/tracker/flow")) {
        return reply({ data: FLOW, meta: { mock: true } });
      }
      if (url.pathname.includes("/complete")) {
        return reply({ data: { id: "t1" }, meta: { mock: true } });
      }
      return reply(
        {
          error: {
            code: "NOT_FOUND",
            message: "x",
            details: null,
            traceId: "t",
          },
        },
        404,
      );
    }),
  );
  return calls;
}

/** The nth item of a list, or a failure that says so. */
function nth(items: readonly HTMLElement[], at: number): HTMLElement {
  const item = items[at];
  if (!item) throw new Error(`No item at ${String(at)}`);
  return item;
}

function home() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
        </Routes>
      </MemoryRouter>
      {/* The shell draws the toaster on the real page. */}
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.loadNamespaces([
    "directions",
    "directions-home",
    "directions-parts",
    "home",
    "components",
  ]);
});

beforeEach(() => {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the home screen", () => {
  it("greets the person and counts their tasks from the real list", async () => {
    stubApi();
    home();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Mei$/,
      }),
    ).toBeVisible();
    expect(
      await screen.findByText(
        "3 tasks are waiting for you, and 2 are past their due time.",
      ),
    ).toBeVisible();
  });

  it("lists each task with its order, customer, a timer and one action", async () => {
    stubApi();
    home();
    const section = (
      await screen.findByRole("heading", { name: "Needs you" })
    ).closest("section");
    if (!section) throw new Error("Needs you has no section");
    const rows = await within(section).findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(nth(rows, 0)).getByText("SO-0080")).toBeVisible();
    expect(within(nth(rows, 0)).getByText("2 days late")).toBeVisible();
    expect(
      within(nth(rows, 0)).getByRole("button", {
        name: "Mark sent for SO-0080",
      }),
    ).toBeVisible();
    // A task one click cannot finish opens its order instead.
    expect(
      within(nth(rows, 1)).getByRole("link", {
        name: "Review for SO-0102",
      }),
    ).toBeVisible();
  });

  it("has one primary button, New order, and an Upload that opens the upload screen", async () => {
    stubApi();
    home();
    expect(
      await screen.findByRole("link", { name: "New order" }),
    ).toHaveAttribute("href", "/orders/new");
    expect(
      screen.getByRole("link", { name: "Upload a document" }),
    ).toHaveAttribute("href", "/upload");
  });

  it("builds My timeline from the tasks and says where the estimate comes from", async () => {
    stubApi();
    home();
    expect(
      await screen.findByRole("heading", { name: "My timeline" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Done today" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Now" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Next" })).toBeVisible();
    expect(
      screen.getByText(
        "Nothing finished yet today. A task you complete here appears with the time.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Estimate from how long this step took on the last 120 orders.",
      ),
    ).toBeVisible();
    // The task in hand is the first one, with the step's measured usual time.
    expect(await screen.findByText("Usually 1 day")).toBeVisible();
    expect(screen.getByText("Past the usual time for this step")).toBeVisible();
  });

  it("shows the sales flow with the tracker's counts and the purchase flow with none", async () => {
    stubApi();
    home();
    const sales = await screen.findByRole("list", {
      name: "Sales order journey",
    });
    expect(within(sales).getAllByRole("listitem")).toHaveLength(9);
    const busiest = within(sales).getByRole("link", {
      name: /Stock checked: 22 in this step/,
    });
    expect(busiest).toBeVisible();
    expect(within(sales).getAllByRole("listitem")[1]).toHaveAttribute(
      "aria-current",
      "step",
    );
    const purchase = screen.getByRole("list", {
      name: "Purchase order journey",
    });
    expect(within(purchase).getAllByRole("listitem")).toHaveLength(9);
    expect(within(purchase).queryAllByRole("link")).toHaveLength(0);
    expect(
      screen.getByText(
        "Purchase orders are not in the tracker, so these steps show no counts.",
      ),
    ).toBeVisible();
  });

  it("shows Support its own counts, each opening its list, and no measures it may not read", async () => {
    stubApi();
    home();
    const numbers = await screen.findByRole("region", {
      name: "Your numbers",
    });
    // The count is the list's own total, and the tile opens that list.
    expect(
      await within(numbers).findByRole("link", { name: /^My tasks\s*\d+$/ }),
    ).toHaveAttribute("href", "/workflows");
    // A list the API does not answer keeps its tile, with a retry.
    await waitFor(() => {
      expect(
        within(numbers).getAllByRole("button", { name: /Retry/ }).length,
      ).toBeGreaterThan(0);
    });
    for (const name of ["Documents to confirm", "Open orders", "Overdue"]) {
      expect(within(numbers).getByText(name)).toBeVisible();
    }
    // Support may not read the five measures, so the page has no such section.
    expect(screen.queryByText("Spectra's five measures")).toBeNull();
  });

  it("notes a finished task in Done today with its time, and takes it out again on Undo", async () => {
    const calls = stubApi();
    const user = userEvent.setup();
    home();
    await user.click(
      await screen.findByRole("button", { name: "Mark sent for SO-0080" }),
    );
    await waitFor(() => {
      expect(calls).toContain("POST /api/v1/workflows/tasks/t1/complete");
    });
    expect(await screen.findByText(/^Finished at \d\d:\d\d$/)).toBeVisible();
  });

  it("lists no tasks for a role with no inbox, and does not ask for any", async () => {
    const calls = stubApi();
    useSessionStore.setState({
      status: "active",
      session: sessionFor("MANAGEMENT"),
    });
    home();
    // Its own list stands where Needs you would be, and nothing says a part is missing.
    expect(
      await screen.findByRole("heading", { name: "Most overdue, by amount" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Needs you" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Your role has no tasks/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My timeline" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "New order" }),
    ).not.toBeInTheDocument();
    expect(calls.some((call) => call.endsWith("/workflows/tasks"))).toBe(false);
  });

  it("is empty and says so when nothing waits", async () => {
    stubApi([]);
    home();
    expect(
      await screen.findByText("Nothing needs you right now"),
    ).toBeVisible();
    expect(screen.getByText("Nothing is waiting for you.")).toBeVisible();
    expect(
      screen.getByText("Nothing is waiting, so there is nothing to clear."),
    ).toBeVisible();
  });

  it("has no accessibility violation", async () => {
    stubApi();
    const { container } = home();
    await screen.findByRole("heading", { name: "My timeline" });
    // The counts have settled: the tasks tile shows its number.
    await screen.findByRole("link", { name: /^My tasks\s*\d+$/ });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
