import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
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
  DataTable,
  RecordLink,
  Toaster,
  type DataTableColumn,
} from "@/components/common";
import { DEFAULT_QUERY } from "@/components/common/data-table/types";
import i18n from "@/i18n";
import { setRecordRoutes } from "@/lib/recordRoutes";
import { resolveRecord } from "@/lib/resolveRecord";
import {
  MAX_TABS,
  storageKey,
  useMarkRecordDirty,
  useRecordTabs,
} from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import { Breadcrumbs } from "./Breadcrumbs";
import { RecordTabs } from "./RecordTabs";

const NUMBERS = Array.from(
  { length: 12 },
  (_, index) => `ITM-${String(index + 1).padStart(3, "0")}`,
);

function Layout() {
  return (
    <>
      <RecordTabs />
      <Breadcrumbs />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Toaster />
    </>
  );
}

const columns: DataTableColumn<string>[] = [
  { id: "no", header: "Number", cell: (no) => no },
];

function List() {
  return (
    <>
      <h1>Items</h1>
      <ul>
        {NUMBERS.map((no) => (
          <li key={no}>
            <RecordLink to={`/items/${no}`}>{no}</RecordLink>
          </li>
        ))}
        <li>
          <RecordLink to="/orders/SO-26-0001">SO-26-0001</RecordLink>
        </li>
        <li>
          <RecordLink to="/reports">Reports</RecordLink>
        </li>
      </ul>
      <DataTable
        tableId="items"
        caption="Rows"
        columns={columns}
        rows={["ROW-1"]}
        total={1}
        query={DEFAULT_QUERY}
        onQueryChange={() => undefined}
        rowKey={(row) => row}
        rowHref={(row) => `/items/${row}`}
      />
    </>
  );
}

function ItemPage() {
  return <h1>An item</h1>;
}

function FormPage() {
  useMarkRecordDirty(true);
  return <h1>An item form</h1>;
}

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: "items",
        handle: { crumb: "common:recordTabs.kinds.item" },
        children: [
          { index: true, element: <List /> },
          {
            path: ":no",
            element: <ItemPage />,
            handle: { record: { kind: "item", param: "no" } },
          },
          {
            path: "form/:no",
            element: <FormPage />,
            handle: { record: { kind: "item", param: "no" } },
          },
        ],
      },
      {
        path: "orders/:orderNo",
        element: <ItemPage />,
        handle: { record: { kind: "order", param: "orderNo" } },
      },
      { path: "reports", element: <h1>Reports</h1> },
    ],
  },
];

const ROLE_A = sessionFor("SUPPORT");
const ROLE_B = sessionFor("PRODUCT_MANAGER");

function mount(path = "/items") {
  setRecordRoutes(routes);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

function strip() {
  return screen.queryByRole("navigation", { name: "Open records" });
}

function tabNames(): string[] {
  const nav = strip();
  if (!nav) return [];
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("title") ?? "");
}

beforeAll(async () => {
  // The words load with the first tab; have them ready so each test starts level.
  await i18n.loadNamespaces("record-tabs");
  // Opening a record loads this on first use; load it now so no test waits on a download.
  await import("./recordTabsRuntime");
});

let user: ReturnType<typeof userEvent.setup>;

// A click loads the tab logic on first use, so its effects arrive a moment later.
async function expectTabs(expected: string[]) {
  await waitFor(() => {
    expect(tabNames()).toEqual(expected);
  });
}

async function expectPath(
  router: { state: { location: { pathname: string } } },
  path: string,
) {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(path);
  });
}

// A plain click adds the tab at once, but the page follows later, as a router
// transition. The tab being active is the proof that the page has rendered:
// act on the page, switch role, close or press Tab only after it.
async function expectActive(title: string) {
  await waitFor(() => {
    const link = within(must(strip()))
      .getAllByRole("link")
      .find((each) => each.getAttribute("title") === title);
    expect(link).toHaveAttribute("aria-current", "page");
  });
}

async function openByClick(label: string, title = `Item ${label}`) {
  await user.click(screen.getByRole("link", { name: label }));
  await expectActive(title);
}

beforeEach(() => {
  user = userEvent.setup();
  localStorage.clear();
  useRecordTabs.setState({ owner: null, tabs: [] });
  useSessionStore.setState({ status: "active", session: ROLE_A });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("record tabs", () => {
  it("takes no space until a record is open", () => {
    mount();
    expect(strip()).toBeNull();
  });

  it("opens a record as the active tab and shows its number in the crumbs", async () => {
    const { router } = mount();
    await openByClick("ITM-001");
    await expectPath(router, "/items/ITM-001");
    const nav = await screen.findByRole("navigation", {
      name: "Open records",
    });
    const tab = within(nav).getByRole("link", { name: /ITM-001/ });
    expect(tab).toHaveAttribute("aria-current", "page");
    const crumbs = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(crumbs).getByText("ITM-001")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens a record that is already open by activating its tab", async () => {
    const { router } = mount();
    await openByClick("ITM-001");
    await act(() => router.navigate("/items"));
    await openByClick("ITM-001");
    await expectTabs(["Item ITM-001"]);
    await expectPath(router, "/items/ITM-001");
  });

  it("opens a Ctrl+click in a background tab and stays on the list", async () => {
    const { router } = mount();
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "ITM-002" }));
    await user.keyboard("{/Control}");
    await expectPath(router, "/items");
    await expectTabs(["Item ITM-002"]);
    expect(
      within(must(strip())).getByRole("link", { name: /ITM-002/ }),
    ).not.toHaveAttribute("aria-current");
    expect(
      await screen.findByText("Item ITM-002 is open in a tab"),
    ).toBeInTheDocument();
  });

  it("says so when a background record is already open", async () => {
    mount();
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("link", { name: "ITM-002" }));
    await user.click(screen.getByRole("link", { name: "ITM-002" }));
    await user.keyboard("{/Meta}");
    await expectTabs(["Item ITM-002"]);
    expect(
      await screen.findByText("Item ITM-002 is already open in a tab"),
    ).toBeInTheDocument();
  });

  it("opens a background tab for a middle click", async () => {
    const { router } = mount();
    const link = screen.getByRole("link", { name: "ITM-003" });
    await user.pointer({ keys: "[MouseMiddle]", target: link });
    await expectPath(router, "/items");
    await expectTabs(["Item ITM-003"]);
  });

  it("leaves a link that is not a record to the router", async () => {
    const { router } = mount();
    await user.click(screen.getByRole("link", { name: "Reports" }));
    await expectPath(router, "/reports");
    expect(strip()).toBeNull();
  });

  it("opens a row with a click, and with Ctrl+click in the background", async () => {
    const { router } = mount();
    const row = screen.getByRole("row", { name: /ROW-1/ });
    await user.keyboard("{Control>}");
    await user.click(within(row).getByText("ROW-1"));
    await user.keyboard("{/Control}");
    await expectPath(router, "/items");
    await expectTabs(["Item ROW-1"]);
    await user.click(within(row).getByText("ROW-1"));
    await expectActive("Item ROW-1");
    await expectPath(router, "/items/ROW-1");
  });

  it("does not open a row while text in it is selected", async () => {
    const { router } = mount();
    const cell = screen.getByRole("cell", { name: "ROW-1" });
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "ROW",
    } as Selection);
    await user.click(cell);
    await expectPath(router, "/items");
    expect(strip()).toBeNull();
  });

  it("closing the active tab goes to the previous one, then to the list", async () => {
    const { router } = mount();
    await openByClick("ITM-001");
    await act(() => router.navigate("/items"));
    await openByClick("ITM-002");
    await user.click(
      await screen.findByRole("button", { name: "Close Item ITM-002" }),
    );
    await expectPath(router, "/items/ITM-001");
    await expectActive("Item ITM-001");
    await user.click(
      await screen.findByRole("button", { name: "Close Item ITM-001" }),
    );
    await expectPath(router, "/items");
    expect(strip()).toBeNull();
  });

  it("closing a background tab stays on the page", async () => {
    const { router } = mount();
    await openByClick("ITM-001");
    await act(() => router.navigate("/items"));
    await openByClick("ITM-002");
    await user.click(
      await screen.findByRole("button", { name: "Close Item ITM-001" }),
    );
    await expectPath(router, "/items/ITM-002");
    await expectTabs(["Item ITM-002"]);
  });

  it("closes the oldest tab when an eleventh opens, and says so", async () => {
    mount();
    const open = useRecordTabs.getState().open;
    for (const no of NUMBERS.slice(0, MAX_TABS)) {
      act(() => {
        open(must(resolveRecord(`/items/${no}`)), `/items/${no}`);
      });
    }
    expect(useRecordTabs.getState().tabs).toHaveLength(MAX_TABS);
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "ITM-011" }));
    await user.keyboard("{/Control}");
    // The click is handled once the tab logic answers: wait for its toast first.
    expect(
      await screen.findByText(/Closed Item ITM-001 to make room/),
    ).toBeInTheDocument();
    const names = tabNames();
    expect(names).toHaveLength(MAX_TABS);
    expect(names).not.toContain("Item ITM-001");
    expect(names).toContain("Item ITM-011");
  });

  it("opens nothing, and says why, when all ten have unsaved changes", async () => {
    const { router } = mount();
    const open = useRecordTabs.getState().open;
    for (const no of NUMBERS.slice(0, MAX_TABS)) {
      act(() => {
        open(must(resolveRecord(`/items/${no}`)), `/items/${no}`);
        useRecordTabs.getState().setDirty(`/items/${no}`, true);
      });
    }
    await user.click(screen.getByRole("link", { name: "ITM-011" }));
    expect(
      await screen.findByText("Ten records are open with unsaved changes"),
    ).toBeInTheDocument();
    await expectPath(router, "/items");
    expect(tabNames()).toHaveLength(MAX_TABS);
    expect(tabNames()).not.toContain("Item ITM-011");
  });

  it("keeps the tabs through a reload", async () => {
    const first = mount();
    await openByClick("ITM-001");
    await act(() => first.router.navigate("/items"));
    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "ITM-002" }));
    await user.keyboard("{/Control}");
    await expectTabs(["Item ITM-001", "Item ITM-002"]);
    first.unmount();

    // A reload empties the store; only localStorage remains.
    useRecordTabs.setState({ owner: null, tabs: [] });
    mount("/items");
    await expectTabs(["Item ITM-001", "Item ITM-002"]);
  });

  it("restores a tab at the address it was last seen", async () => {
    const first = mount("/items/ITM-004?tab=orders");
    await expectTabs(["Item ITM-004"]);
    first.unmount();
    useRecordTabs.setState({ owner: null, tabs: [] });
    mount("/items");
    await expectTabs(["Item ITM-004"]);
    expect(
      within(must(strip())).getByRole("link", { name: /ITM-004/ }),
    ).toHaveAttribute("href", "/items/ITM-004?tab=orders");
  });

  it("keeps each role's tabs apart", async () => {
    mount();
    await openByClick("ITM-001");

    act(() => {
      useSessionStore.getState().setSession(ROLE_B);
    });
    await waitFor(() => {
      expect(strip()).toBeNull();
    });
    expect(localStorage.getItem(storageKey(ROLE_A.user.id))).toContain(
      "ITM-001",
    );

    act(() => {
      useSessionStore.getState().setSession(ROLE_A);
    });
    await expectTabs(["Item ITM-001"]);
  });

  it("does not turn the page left open by another role into a tab", async () => {
    mount();
    // Switch only once the page is on screen and its tab is active.
    await openByClick("ITM-001");
    act(() => {
      useSessionStore.getState().setSession(ROLE_B);
    });
    await waitFor(() => {
      expect(strip()).toBeNull();
    });
    expect(localStorage.getItem(storageKey(ROLE_B.user.id))).toBeNull();
  });

  it("moves along the strip with the arrow keys and closes with Delete", async () => {
    const { router } = mount();
    for (const no of ["ITM-001", "ITM-002", "ITM-003"]) {
      await act(() => router.navigate("/items"));
      await openByClick(no);
    }
    // The strip and its page sync load on first use: wait until the active tab is the stop.
    await waitFor(() => {
      const stops = within(must(strip())).getAllByRole("link");
      expect(stops.map((link) => link.tabIndex)).toEqual([-1, -1, 0]);
    });
    const links = within(must(strip())).getAllByRole("link");

    await user.tab();
    // Page content comes after the strip: the first Tab stop is the active tab.
    expect(links[2]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(links[1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(links[2]).toHaveFocus();

    await user.keyboard("{ArrowLeft}{Delete}");
    await expectTabs(["Item ITM-001", "Item ITM-003"]);
    // The focus lands on a tab that exists, never on the page body.
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(must(strip())).getByRole("link", { name: /ITM-001/ }),
      );
    });
  });

  it("puts the focus on the page when the last tab closes", async () => {
    mount();
    await openByClick("ITM-001");
    await user.tab();
    expect(
      within(must(strip())).getByRole("link", { name: /ITM-001/ }),
    ).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(strip()).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("main")).toHaveFocus();
    });
  });

  it("asks before closing a tab with unsaved changes", async () => {
    mount("/items/form/ITM-005");
    await waitFor(() => {
      expect(
        within(must(strip())).getByText(/unsaved changes/),
      ).toBeInTheDocument();
    });
    await user.click(
      await screen.findByRole("button", { name: "Close Item ITM-005" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Close Item ITM-005?")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Keep it open" }),
    );
    await expectTabs(["Item ITM-005"]);

    await user.click(
      await screen.findByRole("button", { name: "Close Item ITM-005" }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Close tab",
      }),
    );
    expect(strip()).toBeNull();
  });

  it("tells an order from its steps page when they share a number", async () => {
    mount();
    act(() => {
      const open = useRecordTabs.getState().open;
      open(must(resolveRecord("/orders/SO-26-0001")), "/orders/SO-26-0001");
      open(
        {
          key: "/orders/SO-26-0001/steps",
          kind: "orderSteps",
          no: "SO-26-0001",
          listPath: "/orders",
        },
        "/orders/SO-26-0001/steps",
      );
    });
    const nav = await screen.findByRole("navigation", { name: "Open records" });
    // Both read the same number, so the steps tab says what it is in plain sight.
    expect(within(nav).getByText("SO-26-0001 steps")).toBeVisible();
    expect(
      within(nav).getByRole("link", { name: "SO-26-0001 steps" }),
    ).toBeInTheDocument();
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(
      within(nav).getByRole("link", { name: /Order\s*SO-26-0001/ }),
    ).toBeInTheDocument();
  });

  it("works with a broken copy in storage", async () => {
    localStorage.setItem(storageKey(ROLE_A.user.id), "{not json");
    mount("/items/ITM-006");
    await expectTabs(["Item ITM-006"]);
  });

  it("works with a copy that has the wrong shape", async () => {
    localStorage.setItem(
      storageKey(ROLE_A.user.id),
      JSON.stringify([{ key: 1 }]),
    );
    mount("/items/ITM-006");
    await expectTabs(["Item ITM-006"]);
  });

  it("works when storage refuses to read or write", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { router } = mount();
    await openByClick("ITM-001");
    await expectPath(router, "/items/ITM-001");
    await expectTabs(["Item ITM-001"]);
  });

  it("has no accessibility violations", async () => {
    const { container, router } = mount();
    await openByClick("ITM-001");
    await act(() => router.navigate("/items"));
    await openByClick("SO-26-0001", "Order SO-26-0001");
    expect(await axeViolations(container)).toEqual([]);
  });
});
