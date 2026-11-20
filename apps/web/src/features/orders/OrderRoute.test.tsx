import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Role } from "@orderpilot/shared";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { CrumbProvider, useCrumbTail } from "@/app/shell/pageCrumb";
import {
  loadNamespaces,
  SPECS,
  stubApi,
  taskOn,
  type OrderSpec,
} from "@/features/directions/screens/orders/ordersTestKit";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import OrderRoute from "./OrderRoute";

// The form is a page of its own with its own tests (DraftOrderPage.test.tsx).
// Here only the choice matters: which page this route opens for which order
// and which role.
vi.mock("./DraftOrderPage", () => ({
  default: () => <p>The order form</p>,
}));

const [sample] = SPECS;
if (!sample) throw new Error("no sample order");

const entered = (
  orderNo: string,
  state: "draft" | "submitted" | "void",
): OrderSpec => ({ ...sample, orderNo, entered: state, orderedDaysAgo: 2 });

const DRAFT = entered("SO-20261108-0001", "draft");
const SUBMITTED = entered("SO-20261108-0002", "submitted");
const VOID = entered("SO-20261108-0003", "void");
const ALL = [sample, DRAFT, SUBMITTED, VOID];

/** Draws what the shell would: the trail's last crumb and the address. */
function Probe() {
  const { pathname, search } = useLocation();
  return (
    <>
      <output aria-label="crumb">{useCrumbTail()}</output>
      <output aria-label="address">{`${pathname}${search}`}</output>
    </>
  );
}

function open(orderNo: string, role: Role = "SUPPORT", query = "") {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CrumbProvider>
        <MemoryRouter initialEntries={[`/orders/${orderNo}${query}`]}>
          <Probe />
          <Routes>
            <Route path="/orders/:orderNo" element={<OrderRoute />} />
          </Routes>
        </MemoryRouter>
      </CrumbProvider>
    </QueryClientProvider>,
  );
}

const heading = (name: string) =>
  screen.findByRole("heading", { level: 1, name });

/** The entry badge by the title: its name holds the state and what it means for this person. */
function entryBadge(): HTMLElement {
  return screen.getByRole("button", {
    name: /^(Sample|Draft|Submitted|Void)./,
  });
}

beforeAll(loadNamespaces);

beforeEach(() => {
  stubApi({ specs: ALL });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("one order at /orders/:orderNo", () => {
  it.each(["SUPPORT", "PRODUCT_MANAGER"] as const)(
    "gives %s, who may edit, the order form for a draft",
    async (role) => {
      open(DRAFT.orderNo, role);
      expect(await screen.findByText("The order form")).toBeVisible();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    },
  );

  it.each(["WAREHOUSE", "APPROVER", "MANAGEMENT", "AUDITOR"] as const)(
    "gives %s, who may only read, the order page for a draft, and says it is a draft",
    async (role) => {
      open(DRAFT.orderNo, role);
      expect(await heading(DRAFT.orderNo)).toBeVisible();
      expect(screen.queryByText("The order form")).toBeNull();
      const badge = entryBadge();
      expect(within(badge).getByText("Draft")).toBeVisible();
      expect(badge).toHaveAccessibleName(
        /Only a role that may edit orders can change/,
      );
    },
  );

  it("gives a submitted order the order page, even to a role that may edit, and says so", async () => {
    open(SUBMITTED.orderNo, "SUPPORT");
    expect(await heading(SUBMITTED.orderNo)).toBeVisible();
    expect(screen.queryByText("The order form")).toBeNull();
    const badge = entryBadge();
    expect(within(badge).getByText("Submitted")).toBeVisible();
    expect(badge).toHaveAccessibleName(
      "Submitted. Entered here and submitted. Only a draft can be changed.",
    );
  });

  it("gives a void order the order page, struck through, and says it cannot be changed", async () => {
    open(VOID.orderNo, "SUPPORT");
    expect(await heading(VOID.orderNo)).toBeVisible();
    expect(screen.queryByText("The order form")).toBeNull();
    const badge = entryBadge();
    const chip = within(badge).getByText("Void").closest("[data-entry]");
    expect(chip?.className).toContain("line-through");
    expect(badge).toHaveAccessibleName(/It cannot be changed/);
  });

  it("gives a sample order the order page and says samples are read only here", async () => {
    open(sample.orderNo, "SUPPORT");
    expect(await heading(sample.orderNo)).toBeVisible();
    expect(screen.queryByText("The order form")).toBeNull();
    const badge = entryBadge();
    expect(within(badge).getByText("Sample")).toBeVisible();
    // It is a sample of the synthetic demo set, and says nothing of where it came from.
    expect(badge).toHaveAccessibleName(
      "Sample. A sample order of the synthetic demo set. Samples are read only here.",
    );
  });

  it("says the order was not found, with a heading and the way back to the list", async () => {
    open("SO-9999");
    expect(await heading("That order was not found")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to Orders" }),
    ).toHaveAttribute("href", "/orders");
    expect(screen.queryByText("The order form")).toBeNull();
  });

  it("shows the page's own skeleton while the order is on its way, and no form", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const view = open(DRAFT.orderNo);
    expect(
      view.container.querySelector('[data-slot="skeleton"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByText("The order form")).toBeNull();
  });

  it.each([
    ["the form", DRAFT, "SUPPORT"],
    ["the order page", sample, "SUPPORT"],
    ["the order page for a reader", DRAFT, "WAREHOUSE"],
  ] as const)(
    "ends the trail with the order's number on %s",
    async (_, spec, role) => {
      open(spec.orderNo, role);
      await waitFor(() => {
        expect(screen.getByLabelText("crumb")).toHaveTextContent(spec.orderNo);
      });
    },
  );

  it("keeps the tab in the address, so a link opens the order on it", async () => {
    const user = userEvent.setup();
    const view = open(sample.orderNo, "SUPPORT", "?tab=documents");
    const tabs = await screen.findByRole("tablist", { name: "Order details" });
    expect(
      within(tabs).getByRole("tab", { name: /^Documents/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(within(tabs).getByRole("tab", { name: /^Checks/ }));
    await waitFor(() => {
      expect(screen.getByLabelText("address")).toHaveTextContent("tab=checks");
    });
    view.unmount();
    open(sample.orderNo, "SUPPORT", "?tab=activity");
    expect(
      await screen.findByRole("tab", { name: /^Activity/, selected: true }),
    ).toBeVisible();
  });

  it("hides the prices from a role that may not see them, with the reason", async () => {
    vi.unstubAllGlobals();
    stubApi({ specs: ALL, masked: true });
    open(sample.orderNo, "WAREHOUSE");
    await heading(sample.orderNo);
    await screen.findByRole("table", { name: "Lines of the order" });
    expect(document.body.textContent).not.toContain("7,960.80");
    expect(
      screen.getAllByText(/prices are for roles that work with pricing/).length,
    ).toBeGreaterThan(2);
  });

  it("gives the person's own task as the one action, and a role with no tasks none", async () => {
    vi.unstubAllGlobals();
    stubApi({ specs: ALL, tasks: [taskOn(sample.orderNo, "SEND_PI")] });
    const view = open(sample.orderNo, "SUPPORT");
    expect(
      await screen.findByRole("button", { name: "Mark sent" }),
    ).toBeVisible();
    view.unmount();
    open(sample.orderNo, "MANAGEMENT");
    await heading(sample.orderNo);
    expect(screen.queryByRole("button", { name: "Mark sent" })).toBeNull();
    expect(screen.queryByText(/no open task/)).toBeNull();
  });

  it("opens a lower-case order number as the order, at the address in capitals, keeping the query", async () => {
    open("so-0001", "SUPPORT", "?tab=checks");
    expect(await heading("SO-0001")).toBeVisible();
    expect(screen.getByLabelText("address")).toHaveTextContent(
      "/orders/SO-0001?tab=checks",
    );
    expect(screen.queryByText("That order was not found")).toBeNull();
  });

  it.each(["NOPE!", "SO_0001", "SO-0001<b>"])(
    "says %s is not found, with a heading and no retry, without asking the API",
    async (typed) => {
      vi.unstubAllGlobals();
      const calls = stubApi({ specs: ALL });
      open(typed);
      expect(await heading("That order was not found")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(
        screen.getByRole("link", { name: "Back to Orders" }),
      ).toHaveAttribute("href", "/orders");
      expect(calls.filter((call) => call.includes("/orders/"))).toEqual([]);
    },
  );
});
