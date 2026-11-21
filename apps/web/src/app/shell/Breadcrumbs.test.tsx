import type { Role } from "@orderpilot/shared";
import { render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
  useParams,
} from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { allFeatures } from "@/features/registry";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import { Breadcrumbs } from "./Breadcrumbs";
import { CrumbProvider, usePageCrumb } from "./pageCrumb";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "common",
    ...allFeatures.map((feature) => feature.namespace),
  ]);
});

/** A page that names its own record, as the order page does. */
function Order() {
  usePageCrumb(useParams().orderNo);
  return null;
}

function trailAt(path: string, role: Role) {
  useSessionStore.getState().setSession(sessionFor(role));
  const router = createMemoryRouter(
    [
      {
        path: "/",
        handle: { crumb: "common:nav.home" },
        element: (
          <CrumbProvider>
            <Breadcrumbs />
            <Outlet />
          </CrumbProvider>
        ),
        children: [
          { index: true, element: null },
          {
            path: "orders",
            handle: { crumb: "orders:title" },
            children: [
              { index: true, element: null },
              { path: ":orderNo", element: <Order /> },
            ],
          },
          {
            // A heading of the panel with no page of its own, over two pages.
            path: "master-data",
            handle: { crumb: "master-data:title" },
            children: [
              {
                path: "customers",
                handle: { crumb: "master-data:tabs.customers" },
                children: [
                  { index: true, element: null },
                  {
                    path: ":no",
                    handle: { record: { kind: "customer", param: "no" } },
                    element: null,
                  },
                ],
              },
            ],
          },
          {
            path: "workflows",
            handle: { crumb: "workflows:title" },
            children: [
              { index: true, element: null },
              {
                // The route's own crumb and the record's number are one page.
                path: "sprs/:recordNo",
                handle: {
                  crumb: "workflows:spr.crumb",
                  record: { kind: "spr", param: "recordNo" },
                },
                element: null,
              },
            ],
          },
          {
            path: "insights",
            handle: { crumb: "insights:title" },
            element: null,
          },
          {
            path: "settings",
            handle: { crumb: "common:nav.settings" },
            element: null,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
  return within(nav)
    .getAllByRole("listitem")
    .map((item) => item.textContent)
    .filter((text) => text !== "");
}

describe("the trail of the top bar", () => {
  it("shows a top-level page by its own name, with no group", () => {
    expect(trailAt("/orders", "SUPPORT")).toEqual(["Orders"]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Orders")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).queryByText("Work")).toBeNull();
    expect(within(nav).queryByRole("link")).toBeNull();
  });

  it("names the home page alone", () => {
    expect(trailAt("/", "SUPPORT")).toEqual(["Home"]);
  });

  it("ends with the record a page names, and links back to its list", () => {
    expect(trailAt("/orders/SO-0001", "SUPPORT")).toEqual([
      "Orders",
      "SO-0001",
    ]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(within(nav).getByText("SO-0001")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("reads a customer as its list and its number, without Master data", () => {
    expect(trailAt("/master-data/customers/C-1042", "SUPPORT")).toEqual([
      "Customers",
      "C-1042",
    ]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(nav).getByRole("link", { name: "Customers" }),
    ).toHaveAttribute("href", "/master-data/customers");
    expect(within(nav).queryByText("Master data")).toBeNull();
  });

  it("reads an SPR as My tasks and its number, and says the SPR once", () => {
    expect(trailAt("/workflows/sprs/SPR-20261115-0003", "SUPPORT")).toEqual([
      "My tasks",
      "SPR-20261115-0003",
    ]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "My tasks" })).toHaveAttribute(
      "href",
      "/workflows",
    );
    expect(within(nav).queryByText("Stock purchase requisition")).toBeNull();
  });

  it("shows a page of no group by its own name, not a way back to Home", () => {
    expect(trailAt("/settings", "SUPPORT")).toEqual(["Settings"]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();
  });

  it("shows Insights as one word", () => {
    expect(trailAt("/insights", "MANAGEMENT")).toEqual(["Insights"]);
  });

  it("drops a crumb whose page the role has no menu entry for", () => {
    // The administrator has no Orders entry, so Orders is not a place to link to.
    expect(trailAt("/orders/SO-0001", "SYSTEM_ADMIN")).toEqual(["SO-0001"]);
  });

  it("makes every crumb but the last a link", () => {
    trailAt("/master-data/customers/C-1042", "SUPPORT");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(nav).getAllByRole("listitem");
    const named = items.filter((item) => item.textContent !== "");
    expect(named).toHaveLength(2);
    expect(within(must(named[0])).getByRole("link")).toBeTruthy();
    expect(within(must(named[1])).queryByRole("link")).toBeNull();
  });
});
