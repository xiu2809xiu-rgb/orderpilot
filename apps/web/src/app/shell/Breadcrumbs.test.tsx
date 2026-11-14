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
  it("starts with the group of the panel the page sits in", () => {
    expect(trailAt("/orders", "SUPPORT")).toEqual(["Work", "Orders"]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Orders")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Under a group the trail does not also lead back to Home.
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();
  });

  it("names the home page under its group", () => {
    expect(trailAt("/", "SUPPORT")).toEqual(["Work", "Home"]);
  });

  it("ends with the record a page names, and links back to its list", () => {
    expect(trailAt("/orders/SO-0001", "SUPPORT")).toEqual([
      "Work",
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

  it("keeps the way back to Home for a page of no group", () => {
    expect(trailAt("/settings", "SUPPORT")).toEqual(["Home", "Settings"]);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("gives no group to a page the role has no menu entry for", () => {
    // The administrator has no Orders entry, so the page is in no group of theirs.
    expect(trailAt("/orders", "SYSTEM_ADMIN")).toEqual(["Home", "Orders"]);
  });
});
