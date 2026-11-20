import { act, render, screen, waitFor, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { setRecordRoutes } from "@/lib/recordRoutes";
import { storageKey, useRecordTabs } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { RecordTabs } from "./RecordTabs";
import { announceStay } from "./roleSwitch";

// A change of role that deliberately stays on a record (ADR 0032, decision 2,
// note of 20 Nov 2026). RecordTabs.test.tsx keeps the case that leaves the page.

const routes: RouteObject[] = [
  {
    element: (
      <>
        <RecordTabs />
        <Outlet />
      </>
    ),
    children: [
      {
        path: "orders/:orderNo",
        element: <h1>An order</h1>,
        handle: { record: { kind: "order", param: "orderNo" } },
      },
      { path: "reports", element: <h1>Reports</h1> },
    ],
  },
];

const SUPPORT = sessionFor("SUPPORT");
const FINANCE = sessionFor("FINANCE");

function mount(path: string) {
  setRecordRoutes(routes);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function tabNames(): string[] {
  const nav = screen.queryByRole("navigation", { name: "Open records" });
  return nav
    ? within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("title") ?? "")
    : [];
}

async function ownTabIsOpen() {
  await waitFor(() => {
    expect(tabNames()).toHaveLength(1);
  });
}

beforeAll(async () => {
  await i18n.loadNamespaces("record-tabs");
  await import("./recordTabsRuntime");
});

beforeEach(() => {
  localStorage.clear();
  useRecordTabs.setState({ owner: null, tabs: [] });
  useSessionStore.setState({ status: "active", session: SUPPORT });
});

afterEach(() => {
  useSessionStore.setState({ status: "booting", session: null });
});

describe("a change of role that stays on a record", () => {
  it("makes that record a tab in the new person's strip, and leaves the old person's strip alone", async () => {
    mount("/orders/SO-0001");
    await ownTabIsOpen();

    act(() => {
      useSessionStore.getState().setSession(FINANCE);
    });
    // The page is still on screen but is not yet anyone's tab but the old viewer's.
    await waitFor(() => {
      expect(tabNames()).toEqual([]);
    });

    act(() => {
      announceStay("/orders/SO-0001");
    });
    await waitFor(() => {
      expect(tabNames()).toHaveLength(1);
    });
    expect(
      screen.getByRole("link", { name: /SO-0001/ }).getAttribute("href"),
    ).toBe("/orders/SO-0001");
    expect(localStorage.getItem(storageKey(FINANCE.user.id))).toContain(
      "SO-0001",
    );
    expect(localStorage.getItem(storageKey(SUPPORT.user.id))).toContain(
      "SO-0001",
    );
  });

  it("opens nothing for a stay on a page that is not the one on screen", async () => {
    mount("/orders/SO-0001");
    await ownTabIsOpen();
    act(() => {
      useSessionStore.getState().setSession(FINANCE);
    });
    await waitFor(() => {
      expect(tabNames()).toEqual([]);
    });
    act(() => {
      announceStay("/orders/SO-0002");
    });
    expect(tabNames()).toEqual([]);
    expect(localStorage.getItem(storageKey(FINANCE.user.id))).toBeNull();
  });

  it("opens nothing for a stay on a page that is not a record", () => {
    mount("/reports");
    act(() => {
      useSessionStore.getState().setSession(FINANCE);
    });
    act(() => {
      announceStay("/reports");
    });
    expect(tabNames()).toEqual([]);
    expect(localStorage.getItem(storageKey(FINANCE.user.id))).toBeNull();
  });

  it("keeps the old rule when the change leaves the page: no tab for the page that was on screen", async () => {
    const router = mount("/orders/SO-0001");
    await ownTabIsOpen();
    act(() => {
      useSessionStore.getState().setSession(FINANCE);
    });
    await act(() => router.navigate("/reports"));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/reports");
    });
    expect(tabNames()).toEqual([]);
    expect(localStorage.getItem(storageKey(FINANCE.user.id))).toBeNull();
  });
});
