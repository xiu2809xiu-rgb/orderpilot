import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Role } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import {
  loadNamespaces,
  nth,
  renderAt,
  SPECS,
  stubApi,
  type OrderSpec,
} from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import { markSubmittedFocus } from "./submittedFocus";

const NO = "SO-20261108-0002";
const TYPED: OrderSpec = {
  ...nth(SPECS, 1),
  orderNo: NO,
  entered: "submitted",
  orderedDaysAgo: 2,
};

const open = (spec: OrderSpec = TYPED, query = "") =>
  renderAt(
    <OrderPage orderNo={spec.orderNo} />,
    `/orders/${spec.orderNo}${query}`,
  );

const notice = () =>
  screen.findByRole("region", { name: "Submitted. No team has a task for it" });

function signIn(role: Role) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
}

beforeAll(loadNamespaces);

beforeEach(() => {
  signIn("SUPPORT");
});

afterEach(() => {
  vi.unstubAllGlobals();
  // The mark is module state: point it at an order no test opens.
  markSubmittedFocus("none");
});

describe("the notice of a submitted order", () => {
  it("says submitted, not approved and no team has a task for a stored submitted order with no status", async () => {
    stubApi({ specs: [TYPED] });
    open();
    const region = await notice();
    expect(within(region).getByText(/It is not approved\./)).toBeVisible();
    expect(
      within(region).getByText(/it does not appear in the Order tracker/),
    ).toBeVisible();
    expect(within(region).getByText(/counts as an open order/)).toBeVisible();
    // A labelled region the page does not announce a second time, after the toast.
    expect(region.closest("[aria-live]")).toBeNull();
    expect(region).not.toHaveAttribute("role", "status");
    expect(region).not.toHaveAttribute("role", "alert");
  });

  it("says nothing of a workflow to a person", async () => {
    stubApi({ specs: [TYPED] });
    open();
    const region = await notice();
    expect(region.textContent).not.toMatch(/workflow/i);
  });

  it("adds the mistake paragraph for a role that may edit and leaves it out for a reader", async () => {
    stubApi({ specs: [TYPED] });
    const view = open();
    const region = await notice();
    expect(
      within(region).getByText(
        /If it was submitted by mistake: OrderPilot cannot change or cancel it/,
      ),
    ).toBeVisible();
    view.unmount();
    signIn("AUDITOR");
    stubApi({ specs: [TYPED] });
    open();
    const reader = await notice();
    expect(within(reader).queryByText(/submitted by mistake/)).toBeNull();
  });

  it.each([
    ["a draft", { entered: "draft" as const }],
    ["a void order", { entered: "void" as const }],
    ["an order the workflow holds", { workflowLabel: "Waiting for payment" }],
  ])("shows no notice for %s", async (_name, over) => {
    const spec = { ...TYPED, ...over };
    stubApi({ specs: [spec] });
    open(spec);
    await screen.findByRole("heading", { level: 1, name: NO });
    expect(
      screen.queryByRole("region", {
        name: "Submitted. No team has a task for it",
      }),
    ).toBeNull();
  });

  it("shows no notice for a sample", async () => {
    const sample = nth(SPECS, 0);
    stubApi();
    open(sample);
    await screen.findByRole("heading", { level: 1, name: sample.orderNo });
    expect(screen.queryByText(/No team has a task for it/)).toBeNull();
  });

  it("links to the activity tab, scrolls and focuses the panel", async () => {
    // jsdom has no scrollIntoView: a stand-in says whether the page asked.
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    try {
      stubApi({ specs: [TYPED] });
      const user = userEvent.setup();
      open();
      const region = await notice();
      await user.click(
        within(region).getByRole("link", {
          name: "See who submitted it, and when",
        }),
      );
      const panel = await screen.findByRole("tabpanel", { name: "Activity" });
      await waitFor(() => {
        expect(panel).toHaveFocus();
      });
      expect(scroll).toHaveBeenCalled();
      expect(screen.getByRole("tab", { name: /Activity/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      Reflect.deleteProperty(window.HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("offers the audit trail of the order to a role that may read it, and not to one that may not", async () => {
    signIn("AUDITOR");
    stubApi({ specs: [TYPED] });
    const view = open();
    const region = await notice();
    expect(
      within(region).getByRole("link", {
        name: `View audit trail for order ${NO}`,
      }),
    ).toHaveAttribute("href", `/audit?entity=Order&id=${NO}`);
    view.unmount();
    signIn("SUPPORT");
    stubApi({ specs: [TYPED] });
    open();
    const other = await notice();
    expect(
      within(other).queryByRole("link", { name: /audit trail/ }),
    ).toBeNull();
  });

  it("gives the audit link the same touch height as the activity link beside it", async () => {
    signIn("AUDITOR");
    stubApi({ specs: [TYPED] });
    open();
    const region = await notice();
    const classes = (name: string | RegExp) =>
      within(region).getByRole("link", { name }).className.split(" ");
    expect(classes(/audit trail/)).toContain("pointer-coarse:min-h-11");
    expect(classes(/See who submitted/)).toContain("pointer-coarse:min-h-11");
  });

  it("takes focus once after a submit and not on a later visit or a reload (the mark expires)", async () => {
    stubApi({ specs: [TYPED] });
    markSubmittedFocus(NO);
    const first = open();
    const region = await notice();
    await waitFor(() => {
      expect(region).toHaveFocus();
    });
    first.unmount();
    // The mark was taken: the same page, opened again, does not pull focus.
    const second = open();
    const again = await notice();
    expect(again).not.toHaveFocus();
    second.unmount();
    // A mark older than ten seconds is not taken either.
    const now = Date.now();
    markSubmittedFocus(NO);
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11_000);
    try {
      open();
      const late = await notice();
      expect(late).not.toHaveFocus();
    } finally {
      clock.mockRestore();
    }
  });

  it("shows no price to a masked role", async () => {
    signIn("WAREHOUSE");
    stubApi({ specs: [TYPED], masked: true });
    open();
    const region = await notice();
    expect(region.textContent).not.toMatch(/\d/);
    await screen.findByRole("table", { name: "Lines of the order" });
    for (const hidden of ["15,676.34", "15676.34", "169.19", "553.93"]) {
      expect(document.body.textContent).not.toContain(hidden);
    }
  });
});

describe("what the page asks for", () => {
  it("does not ask the tracker or the flow for a stored submitted order with no status", async () => {
    const calls = stubApi({ specs: [TYPED], flowDocuments: [] });
    open();
    await notice();
    await screen.findByRole("table", { name: "Lines of the order" });
    expect(
      calls.filter((call) => call.includes("/tracker/orders/SO-")),
    ).toEqual([]);
    expect(calls.filter((call) => call.includes("/workflows/orders/"))).toEqual(
      [],
    );
  });

  it("asks them when the order has a status", async () => {
    const spec = { ...TYPED, workflowLabel: "Waiting for payment" };
    const calls = stubApi({ specs: [spec] });
    open(spec);
    await screen.findByRole("heading", { level: 1, name: NO });
    await waitFor(() => {
      expect(
        calls.some((call) =>
          call.startsWith(`GET /api/v1/tracker/orders/${NO}`),
        ),
      ).toBe(true);
      expect(
        calls.some((call) => call.includes(`/workflows/orders/${NO}/flow`)),
      ).toBe(true);
    });
  });
});
