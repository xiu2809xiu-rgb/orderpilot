import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CrumbProvider } from "@/app/shell/pageCrumb";
import { Toaster } from "@/components/common";
import { markConfirmedFocus } from "@/features/directions/screens/order/versions/confirmedFocus";
import {
  differences,
  versionRow,
} from "@/features/directions/screens/order/versions/versionsTestKit";
import { loadNamespaces } from "@/features/directions/screens/orders/ordersTestKit";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import NewOrderPage from "./NewOrderPage";
import OrderRoute from "./OrderRoute";
import {
  answerConfirm,
  EXISTING,
  http,
  HttpResponse,
  openPanel,
  saveRefused,
  serveRevision,
  server,
  submittedOrder,
} from "./revisionTestKit";

// The routes the app really uses, with the real form and the real order page in
// them: after a confirmation the route swaps the form for the order's page, which
// draws from what the confirmation wrote to the cache.

beforeAll(async () => {
  await loadNamespaces();
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  markConfirmedFocus("none");
});

/** Draws the address, inside the router, above whatever route is open. */
function Layout() {
  const { pathname, search } = useLocation();
  return (
    <>
      <output aria-label="address">{`${pathname}${search}`}</output>
      <Outlet />
    </>
  );
}

function renderRoutes() {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/orders", element: <p>Orders list</p> },
          { path: "/orders/new", element: <NewOrderPage /> },
          { path: "/orders/:orderNo", element: <OrderRoute /> },
        ],
      },
    ],
    { initialEntries: ["/orders/new"] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <CrumbProvider>
        <Toaster />
        <Suspense fallback={<p>Loading</p>}>
          <RouterProvider router={router} />
        </Suspense>
      </CrumbProvider>
    </QueryClientProvider>,
  );
  return { router, client, view };
}

/** What the order page reads beside the order itself, and the PO versions. */
function serveAfter(api: ReturnType<typeof serveRevision>["api"]) {
  const empty = { data: [], meta: { page: 1, pageSize: 5, total: 0 } };
  server.use(
    http.get("*/api/v1/tracker/orders", () => HttpResponse.json(empty)),
    http.get("*/api/v1/workflows/tasks", () => HttpResponse.json(empty)),
    http.get("*/api/v1/orders/:orderNo/po-versions", () =>
      HttpResponse.json({
        data: {
          orderNo: EXISTING,
          currentPoVersionNo: 2,
          versions: [versionRow(2, true), versionRow(1, false)],
        },
      }),
    ),
    http.get("*/api/v1/orders/:orderNo/po-versions/diff", () =>
      HttpResponse.json({ data: differences() }),
    ),
  );
  return () => {
    api.stored = submittedOrder({ poVersionNo: 2, version: 5 });
    return HttpResponse.json(
      {
        data: {
          poVersionNo: 2,
          supersedesPoVersionNo: 1,
          differences: differences(),
          order: api.stored,
        },
      },
      { status: 201 },
    );
  };
}

async function confirmed() {
  const user = userEvent.setup();
  const served = serveRevision();
  const answer = serveAfter(served.api);
  const routes = renderRoutes();
  await saveRefused(user);
  await openPanel(user);
  answerConfirm(served.requests, answer);
  await user.click(
    screen.getByRole("button", { name: "Confirm PO version 2" }),
  );
  return { user, ...served, ...routes };
}

describe("confirming a revised PO on the routes the app uses", () => {
  it("ends with a toast, the order's page drawn from the cached envelope with no error, and the Versions tab with focus", async () => {
    await confirmed();
    expect(
      await screen.findByText(`PO version 2 saved on ${EXISTING}`),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText("address")).toHaveTextContent(
        `/orders/${EXISTING}?tab=versions`,
      );
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: EXISTING }),
    ).toBeVisible();
    const panel = await screen.findByRole("tabpanel", { name: "Versions" });
    const heading = within(panel).getByRole("heading", { name: "PO versions" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(
      screen.getByRole("link", {
        name: "PO version 2. Open the Versions tab.",
      }),
    ).toBeVisible();
    expect(
      within(panel).getByRole("list", { name: "PO versions, newest first" }),
    ).toBeVisible();
    // The page says nobody was told: no team holds this order.
    expect(
      within(panel).getByText(
        "Nobody was told about PO version 2, because no team holds this order. Tell the people who handle it.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("We could not load this")).toBeNull();
  });

  it("opening New order after a confirmed revision shows a blank form", async () => {
    const { router } = await confirmed();
    await screen.findByRole("heading", { level: 1, name: EXISTING });
    await act(async () => {
      await router.navigate("/orders/new");
    });
    const customer = await screen.findByRole("combobox", {
      name: /^Customer$/,
    });
    expect(customer).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /PO number/ })).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
    ).toHaveValue("");
  });

  it("makes no request to the preview route after a success, on reconnect or on a session refresh", async () => {
    const { requests, client } = await confirmed();
    await screen.findByRole("heading", { level: 1, name: EXISTING });
    const previews = requests.previews.length;
    expect(requests.confirms).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await client.invalidateQueries();
      await client.refetchQueries();
    });
    expect(requests.previews).toHaveLength(previews);
    expect(requests.confirms).toHaveLength(1);
  });
});
