import { screen, within } from "@testing-library/react";
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
import { todayInSingapore } from "@/lib/format";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import {
  loadNamespaces,
  nth,
  renderAt,
  SPECS,
  stubApi,
  taskOn,
} from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import { flowOf, step, stubFlow } from "./orderPageTestKit";

/** Opens an order as its route does: the number from the address, the tab from the query. */
const open = (orderNo: string, query = "") =>
  renderAt(<OrderPage orderNo={orderNo} />, `/orders/${orderNo}${query}`);

beforeAll(loadNamespaces);

beforeEach(() => {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** SO-0001 waits for payment: the fourth step. */
const PAID = "SO-0001";

describe("the order page", () => {
  it("heads the page with the number, the customer and the facts", async () => {
    stubApi();
    open(PAID);
    expect(
      await screen.findByRole("heading", { level: 1, name: "SO-0001" }),
    ).toBeVisible();
    expect(screen.getByText("Alpha Traders, C-0001")).toBeVisible();
    const facts = screen.getByText("Stage").closest("dl");
    if (!facts) throw new Error("no facts");
    expect(within(facts).getByText("Waiting for payment")).toBeVisible();
    expect(within(facts).getByText("Finance")).toBeVisible();
    expect(within(facts).getByText("PO-SO-0001")).toBeVisible();
    // Lateness is said once, by the badge under the title, not in the facts.
    expect(within(facts).queryByText("3 d late")).toBeNull();
    expect(screen.getAllByText("3 d late")).toHaveLength(1);
    // The read-only order form showed the prepayment, and customers pay before shipping.
    expect(within(facts).getByText("30% prepayment")).toBeVisible();
  });

  it("shows the journey with done, now and later, and who and when for done steps", async () => {
    stubApi();
    open(PAID);
    const rail = await screen.findByRole("list", {
      name: "Sales order journey",
    });
    const steps = within(rail).getAllByRole("listitem");
    expect(steps).toHaveLength(9);
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    // Done: the actor and the day, from the order's own events.
    expect(within(nth(steps, 2)).getByText(/Support, /)).toBeVisible();
    expect(within(nth(steps, 3)).getByText(/^Now, late/)).toBeVisible();
    // The current step says how long it has waited and what is usual, in one short line.
    expect(
      within(nth(steps, 3)).getByText("Waiting 14 days, usually 4 days"),
    ).toBeVisible();
    // Later: a day the step is expected, worked from the usual times.
    expect(within(nth(steps, 4)).getByText(/^By /)).toBeVisible();
  });

  it("counts the wait from the workflow's record, not from the tracker's newest event", async () => {
    stubApi();
    // The workflow finished its last step six days ago; the tracker's own
    // current event is fourteen days old here, and on the sample data it is
    // always today, which is why the record's time is the one shown.
    const sixDaysAgo = new Date(
      Date.parse(`${todayInSingapore()}T12:00:00.000Z`) - 6 * 86_400_000,
    ).toISOString();
    stubFlow(() =>
      flowOf(PAID, {
        steps: [
          { ...step("pi-sent", "done"), completedAt: sixDaysAgo },
          step("payment-confirmed", "current"),
        ],
      }),
    );
    open(PAID);
    const rail = await screen.findByRole("list", {
      name: "Sales order journey",
    });
    const now = nth(within(rail).getAllByRole("listitem"), 3);
    expect(
      await within(now).findByText("Waiting 6 days, usually 4 days"),
    ).toBeVisible();
    expect(within(now).queryByText(/Waiting 14 days/)).toBeNull();
  });

  it("names the expected ship day as what it is and sets it against the order's ship date", async () => {
    stubApi();
    open(PAID);
    expect(
      await screen.findByText(
        /^Expected to ship \w{3}, \d{1,2} \w{3}: (\d+ days? after the order.s ship date|in time for the order.s ship date)\.$/,
      ),
    ).toBeVisible();
    expect(screen.getByText(/^From how long each step took/)).toBeVisible();
    // A step the data cannot time says so on the rail, where it is.
    const rail = screen.getByRole("list", { name: "Sales order journey" });
    expect(within(rail).getByText("No usual time")).toBeVisible();
  });

  it("fills the four tabs from the real data", async () => {
    stubApi();
    const user = userEvent.setup();
    open(PAID);
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    const tabs = await screen.findByRole("tablist", { name: "Order details" });
    expect(
      within(tabs).getByRole("tab", { name: /^Lines\s*2$/ }),
    ).toHaveAttribute("aria-selected", "true");
    const lines = await screen.findByRole("table", {
      name: "Lines of the order",
    });
    expect(within(lines).getByText("Item 2")).toBeVisible();
    expect(within(lines).getByText("Short 5")).toBeVisible();
    expect(within(lines).getByText("Order total")).toBeVisible();

    await user.click(within(tabs).getByRole("tab", { name: /^Documents/ }));
    const customerPo = (await screen.findByText("Customer PO")).closest("li");
    if (!customerPo) throw new Error("no document row");
    expect(
      within(customerPo).getByText("A check found a difference"),
    ).toBeVisible();
    expect(screen.getByText("Packing list")).toBeVisible();

    await user.click(within(tabs).getByRole("tab", { name: /^Checks/ }));
    expect(await screen.findByText("Rule quantity")).toBeVisible();
    expect(screen.getByText("Matched to Business Central")).toBeVisible();
    expect(screen.getByText("C-0009 Look-alike Ltd")).toBeVisible();

    await user.click(within(tabs).getByRole("tab", { name: /^Activity/ }));
    // Found by name: right after the click the Checks panel can still be the
    // visible one, and a slow runner would read it instead.
    const events = await screen.findByRole("tabpanel", { name: /^Activity/ });
    expect(await within(events).findByText("Payment received")).toBeVisible();
    expect(within(events).getByText("Current step")).toBeVisible();
  });

  it("says a document waits for a person when the tracker says so, without naming which", async () => {
    stubApi({ toConfirm: ["SO-0001"] });
    open(PAID, "?tab=documents");
    expect(
      await screen.findByText(
        "A document of this order waits for you to confirm it",
      ),
    ).toBeVisible();
    expect(screen.getByText(/It does not say which one/)).toBeVisible();
  });

  it("lists the documents the workflow knows, with the one waiting for a person marked", async () => {
    stubApi({ toConfirm: ["SO-0001"] });
    stubFlow(() =>
      flowOf("SO-0001", {
        documents: [
          {
            id: "d1",
            type: "CUSTOMER_PO",
            number: "PO-SO-0001",
            status: "confirmed",
            receivedAt: "2026-11-02T01:00:00.000Z",
            dueDate: null,
          },
          {
            id: "d2",
            type: "PACKING_LIST",
            number: "PL-77",
            status: "to-confirm",
            receivedAt: "2026-11-05T01:00:00.000Z",
            dueDate: null,
          },
          {
            id: "d3",
            type: "AWB",
            number: null,
            status: "expected",
            receivedAt: null,
            dueDate: "2026-11-23",
          },
        ],
      }),
    );
    open(PAID, "?tab=documents");
    // The workflow answers after the tracker: wait for its number.
    await screen.findByText("PL-77");
    const packing = screen.getByText("Packing list").closest("li");
    if (!packing) throw new Error("no document row");
    expect(within(packing).getByText("To confirm")).toBeVisible();
    expect(within(packing).getByText("PL-77")).toBeVisible();
    expect(within(packing).getByText("Received 5 Nov 2026")).toBeVisible();
    const awb = screen.getByText("Air waybill").closest("li");
    if (!awb) throw new Error("no AWB row");
    expect(within(awb).getByText("Expected by 23 Nov 2026")).toBeVisible();
    // The alert can name the document now, because the list does.
    expect(screen.getByText(/It is marked To confirm/)).toBeVisible();
    expect(screen.queryByText(/It does not say which one/)).toBeNull();
  });

  it("makes the person's own task the one primary button, finished here with one click", async () => {
    stubApi({ tasks: [taskOn("SO-0001", "SEND_PI")] });
    open(PAID);
    expect(
      await screen.findByRole("button", { name: "Mark sent" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Mark sent/ })).toHaveLength(
      1,
    );
  });

  it("opens the order's own page of the app for a decision, and says when there is no task", async () => {
    stubApi({ tasks: [taskOn("SO-0001", "CONFIRM_PAYMENT")] });
    const view = open(PAID);
    expect(
      await screen.findByRole("link", { name: /Confirm/ }),
    ).toHaveAttribute("href", "/workflows/orders/SO-0001");
    view.unmount();
    vi.unstubAllGlobals();
    stubApi();
    open(PAID);
    expect(
      await screen.findByText("You have no open task on this order."),
    ).toBeVisible();
  });

  it("opens the SPR itself for an SPR to decide, with its action in words", async () => {
    stubApi({
      tasks: [
        {
          ...taskOn("SO-0001", "APPROVE_SPR"),
          assigneeRole: "APPROVER",
          ref: { recordNo: "SPR-20261111-0003", navisionNo: null },
        },
      ],
    });
    open(PAID);
    expect(await screen.findByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/workflows/sprs/SPR-20261111-0003",
    );
    // A missing wording would show its key, as it did once.
    expect(screen.queryByText(/needs\.actions/)).toBeNull();
  });

  it("hides every price from a role that may not see them, with the reason", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("WAREHOUSE"),
    });
    stubApi({ masked: true });
    open(PAID);
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    await screen.findByRole("table", { name: "Lines of the order" });
    const body = document.body.textContent;
    for (const hidden of ["7,960.80", "7960.80", "169.19", "553.93"]) {
      expect(body).not.toContain(hidden);
    }
    expect(
      screen.getAllByText(/prices are for roles that work with pricing/).length,
    ).toBeGreaterThan(2);
    // The reason is on the page in words too: a tablet has no hover to show it.
    expect(
      document.querySelector("[data-main] .od-fact-note")?.textContent,
    ).toBe("Hidden: prices are for roles that work with pricing");
  });

  it("keeps the facts and the lines for a role the tracker refuses, and says why there is no journey", async () => {
    stubApi({ trackerForbidden: true });
    open(PAID);
    expect(
      await screen.findByRole("heading", { level: 1, name: "SO-0001" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "The journey comes from the order tracker, which your role cannot read.",
      ),
    ).toBeVisible();
    expect(
      await screen.findByRole("table", { name: "Lines of the order" }),
    ).toBeVisible();
  });

  it("tells a role with no tasks nothing about one", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("MANAGEMENT"),
    });
    stubApi();
    open(PAID);
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    expect(screen.queryByText(/no open task/)).toBeNull();
  });

  it.each(["draft", "void"] as const)(
    "does not ask the tracker or the workflow about a %s order, and still shows its facts and lines",
    async (entered) => {
      const calls = stubApi({
        specs: [{ ...nth(SPECS, 1), orderNo: "SO-9001", entered }],
        flowDocuments: [],
      });
      open("SO-9001");
      expect(
        await screen.findByRole("heading", { level: 1, name: "SO-9001" }),
      ).toBeVisible();
      expect(
        await screen.findByRole("table", { name: "Lines of the order" }),
      ).toBeVisible();
      expect(
        screen.getByText(
          "This order has no journey yet: the tracker does not know it.",
        ),
      ).toBeVisible();
      // Each of those would answer 404 and leave an error in the console.
      expect(
        calls.filter((call) => call.includes("/tracker/orders/SO-")),
      ).toEqual([]);
      expect(
        calls.filter((call) => call.includes("/workflows/orders/")),
      ).toEqual([]);
    },
  );

  it("says plainly when the order is not found", async () => {
    stubApi();
    open("SO-9999");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "That order was not found",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Orders" })).toBeVisible();
    // A retry would ask the same question and get the same answer.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows the error with its trace id and a way to retry when the order cannot be read", async () => {
    stubApi({ orderFails: true });
    open(PAID);
    expect(await screen.findByText(/trace-order-500/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Orders" })).toBeVisible();
    expect(screen.queryByText("That order was not found")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    stubApi({ tasks: [taskOn("SO-0001", "SEND_PI")] });
    const view = open(PAID, "?tab=checks");
    await screen.findByText("Rule quantity");
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
