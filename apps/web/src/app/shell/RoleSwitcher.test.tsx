import {
  DEMO_PERSONAS,
  ROLES,
  demoLoginRequestSchema,
  type Role,
} from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  loadNamespaces,
  stubApi,
  taskOn,
} from "@/features/directions/screens/orders/ordersTestKit";
import { OrderPage } from "@/features/directions/screens/order/OrderPage";
import { apiClient } from "@/lib/api/instance";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { optionsFixture, sessionFor } from "@/test/fixtures";
import { loadShellOverlays } from "./overlays/preload";
import { RoleSwitcher } from "./RoleSwitcher";
import { onStay } from "./roleSwitch";

beforeAll(async () => {
  await loadNamespaces();
  await loadShellOverlays();
}, 60_000);

/** What each role has open on SO-0001, so the page can show whose view it is. */
const TASKS: Partial<Record<Role, string>> = {
  SUPPORT: "SEND_PI",
  FINANCE: "CONFIRM_PAYMENT",
};

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** The order API of the orders test kit, plus the sign-in routes and a task list that follows the role. */
function stubAsRoles(first: Role) {
  stubApi();
  const orders = globalThis.fetch;
  let who = first;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
        "http://localhost",
      );
      const path = url.pathname.replace("/api/v1", "");
      if (path === "/auth/options") return json({ data: optionsFixture(true) });
      if (path === "/auth/demo-login") {
        const body: unknown =
          typeof init?.body === "string" ? JSON.parse(init.body) : null;
        who = demoLoginRequestSchema.parse(body).role;
        return json({ data: sessionFor(who) });
      }
      if (path === "/workflows/tasks") {
        const kind = TASKS[who];
        const rows = kind ? [taskOn("SO-0001", kind)] : [];
        return json({
          data: rows,
          meta: { page: 1, pageSize: 200, total: rows.length, mock: true },
        });
      }
      return orders(input, init);
    }),
  );
}

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function OrderRouteStub() {
  const { orderNo = "" } = useParams();
  return <OrderPage orderNo={orderNo} />;
}

function open(path: string, first: Role) {
  stubAsRoles(first);
  useSessionStore.setState({ status: "active", session: sessionFor(first) });
  document.cookie = "op_csrf=csrf-token-1";
  apiClient.markSessionStarted();
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <RoleSwitcher />
        <Where />
        <Routes>
          <Route path="/orders/new" element={<p>The entry form</p>} />
          <Route path="/orders/:orderNo" element={<OrderRouteStub />} />
          <Route path="*" element={<p>Some other page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function switchTo(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(await screen.findByRole("button", { name: "Demo role" }));
  await user.click(await screen.findByRole("menuitem", { name }));
}

beforeEach(() => {
  document.cookie = "op_csrf=; Max-Age=0";
});

afterEach(() => {
  vi.unstubAllGlobals();
  apiClient.reset();
});

describe("the Demo role menu", () => {
  it("lists the six teams in flow order with their numbers and lines, then the others, then the tour", async () => {
    const user = userEvent.setup();
    open("/", "FINANCE");
    await user.click(await screen.findByRole("button", { name: "Demo role" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "1SupportMei TanTakes in the customer's order and sends the proforma invoice",
      "2Product managerPriya NairWatches stock and run rate, and raises the request to buy",
      "3Management approverRachel GohApproves or rejects the request to buy",
      "4FinanceGrace OngConfirms the customer's payment",
      "5WarehouseHafiz RahmanPacks the goods and checks them against the papers",
      "6LogisticsArjun MehtaBooks the forwarder and follows the shipping papers",
      "System adminDaniel KohSets up users and roles",
      "ManagementSophia ChenReads the tracker and the KPIs",
      "AuditorLucas WongReads the audit trail",
      "Start the demo tour",
    ]);
    expect(Object.keys(DEMO_PERSONAS)).toHaveLength(ROLES.length);
    // Two dividers: one under the hint, one before the tour, and one between the six and the rest.
    expect(screen.getAllByRole("separator")).toHaveLength(3);
  });

  it("says what a change of role does: an open order stays open", async () => {
    const user = userEvent.setup();
    open("/", "FINANCE");
    await user.click(await screen.findByRole("button", { name: "Demo role" }));
    expect(
      await screen.findByText(
        "Switch to another role. An order you have open stays open.",
      ),
    ).toBeInTheDocument();
  });

  it("ticks the current role and no other", async () => {
    const user = userEvent.setup();
    open("/", "FINANCE");
    await user.click(await screen.findByRole("button", { name: "Demo role" }));
    const ticks = await screen.findAllByLabelText("Current role");
    expect(ticks).toHaveLength(1);
    expect(ticks[0]?.closest("[role=menuitem]")).toHaveTextContent("Finance");
  });
});

describe("changing role keeps the order on screen", () => {
  it("stays on one order's page and shows the new role's view of it", async () => {
    const user = userEvent.setup();
    open("/orders/SO-0001", "SUPPORT");
    // Support's own task is the page's action.
    expect(
      await screen.findByRole("button", { name: "Mark PI as sent" }),
    ).toBeVisible();

    await switchTo(user, /Finance/);

    expect(
      await screen.findByRole("link", { name: "Enter payment details" }),
    ).toBeVisible();
    expect(screen.getByTestId("where")).toHaveTextContent("/orders/SO-0001");
    // Nothing of the old role is left on the page.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Mark PI as sent" }),
      ).toBeNull();
    });
  });

  it("says it stayed on the order, so the order becomes a tab for the new person, and says nothing when it leaves the page", async () => {
    const user = userEvent.setup();
    const stays: string[] = [];
    const stop = onStay((path) => stays.push(path));
    const view = open("/orders/SO-0001", "SUPPORT");
    await screen.findByRole("button", { name: "Mark PI as sent" });
    await switchTo(user, /Finance/);
    await waitFor(() => {
      expect(stays).toEqual(["/orders/SO-0001"]);
    });
    stop();
    view.unmount();

    // From a page that is not an order the change leaves it: nothing is kept.
    vi.unstubAllGlobals();
    const left: string[] = [];
    const stopLeft = onStay((path) => left.push(path));
    open("/tracker", "SUPPORT");
    await switchTo(user, /Finance/);
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    });
    expect(left).toEqual([]);
    stopLeft();
  });

  it("goes Home from the order list, the entry form and any other page", async () => {
    const user = userEvent.setup();
    for (const path of ["/orders", "/orders/new", "/tracker"]) {
      const view = open(path, "SUPPORT");
      await switchTo(user, /Finance/);
      await waitFor(() => {
        expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
      });
      view.unmount();
      vi.unstubAllGlobals();
    }
  });

  it("goes Home from an order's page when the new role may not read orders", async () => {
    const user = userEvent.setup();
    open("/orders/SO-0001", "SUPPORT");
    await screen.findByRole("button", { name: "Mark PI as sent" });
    await switchTo(user, /System admin/);
    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    });
    expect(
      within(document.body).queryByRole("button", { name: "Mark PI as sent" }),
    ).toBeNull();
  });
});
