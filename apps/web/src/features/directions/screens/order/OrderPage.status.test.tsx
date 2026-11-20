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
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import {
  loadNamespaces,
  SPECS,
  stubApi,
  taskOn,
  type OrderSpec,
} from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import {
  entry,
  flowOf,
  renderWithToasts,
  step,
  stubFlow,
  type FlowAnswer,
} from "./orderPageTestKit";

const open = (orderNo: string, query = "") =>
  renderWithToasts(
    <OrderPage orderNo={orderNo} />,
    `/orders/${orderNo}${query}`,
  );

const [first] = SPECS;
if (!first) throw new Error("no spec");

/** An order short of stock and held at the Product manager, as SO-0082 is in the demo data. */
const SHORT: OrderSpec = {
  ...first,
  orderNo: "SO-0082",
  status: { code: "sample-short-stock", label: "Short on stock" },
  ownerRole: "PRODUCT_MANAGER",
  daysOverdue: 1,
  shortBy: "707.00",
};

const PACKED = entry(
  1,
  "2026-11-19T22:10:00.000Z",
  "step.completed",
  { kind: "user", name: "Hafiz Rahman" },
  "Step done: Packed",
);
const REMINDER = entry(
  2,
  "2026-11-19T23:00:00.000Z",
  "reminder.sent",
  { kind: "system", name: "OrderPilot" },
  "Reminder to Logistics: Shipping documents is overdue",
);

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

describe("the status card", () => {
  it("shows the stage and the team that holds it, and says nothing else: Current Stage and Held at are the page's own facts, with no sentence repeating them", async () => {
    stubApi({ specs: [SHORT] });
    open("SO-0082");
    const held = await screen.findByText("Held at");
    const facts = held.closest("dl");
    if (!facts) throw new Error("no facts");
    expect(within(facts).getByText("Product manager")).toBeVisible();
    expect(within(facts).getByText("Short on stock")).toBeVisible();
    expect(document.querySelector(".od-status-sentence")).toBeNull();
  });

  it("shows a finished order's own stage, with nothing more said about it", async () => {
    stubApi({
      specs: [
        {
          ...first,
          orderNo: "SO-0009",
          status: { code: "sample-all-shipped", label: "Closed" },
        },
      ],
    });
    open("SO-0009");
    expect(await screen.findByText("Closed")).toBeVisible();
    expect(document.querySelector(".od-status-sentence")).toBeNull();
  });

  it("falls back to the stage from the Orders API for a role the tracker refuses", async () => {
    stubApi({ trackerForbidden: true });
    open("SO-0001");
    const facts = (await screen.findByText("Held at")).closest("dl");
    if (!facts) throw new Error("no facts");
    expect(within(facts).getByText("Waiting for payment")).toBeVisible();
  });
});

describe("the latest act", () => {
  it("shows who did what and when, with the way to the order's steps", async () => {
    stubApi();
    stubFlow(() => flowOf("SO-0001", { timeline: [PACKED, REMINDER] }));
    open("SO-0001");
    const line = await screen.findByText(
      "Latest: Hafiz Rahman marked Packed as done, 20 Nov at 06:10",
    );
    expect(line).toBeVisible();
    expect(screen.getByRole("link", { name: "All steps" })).toHaveAttribute(
      "href",
      "/workflows/orders/SO-0001",
    );
    // The system's reminder is newer, and is not an act.
    expect(screen.queryByText(/Reminder to Logistics/)).toBeNull();
  });

  it.each<[string, FlowAnswer]>([
    ["a refusal", "forbidden"],
    ["an order the workflow does not know", "missing"],
    [
      "a record where only the system has acted",
      flowOf("SO-0001", { timeline: [REMINDER] }),
    ],
  ])("has no line and no error for %s", async (_, answer) => {
    stubApi();
    stubFlow(() => answer);
    open("SO-0001");
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    await screen.findByRole("table", { name: "Lines of the order" });
    await waitFor(() => {
      expect(screen.queryByText(/^Latest:/)).toBeNull();
    });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText(/trace-flow/)).toBeNull();
  });

  it("does not ask the workflow for a role that may not read it", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SYSTEM_ADMIN"),
    });
    stubApi();
    const asked = stubFlow(() => flowOf("SO-0001", { timeline: [PACKED] }));
    open("SO-0001");
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    expect(screen.queryByText(/^Latest:/)).toBeNull();
    expect(asked).toEqual([]);
  });

  it("is there straight after an act made on this page, without a reload", async () => {
    const user = userEvent.setup();
    stubApi({ tasks: [taskOn("SO-0001", "SEND_PI")] });
    let packed = false;
    stubFlow(() => flowOf("SO-0001", { timeline: packed ? [PACKED] : [] }), {
      onComplete: () => {
        packed = true;
      },
    });
    open("SO-0001");
    const button = await screen.findByRole("button", { name: "Mark sent" });
    expect(screen.queryByText(/^Latest:/)).toBeNull();
    await user.click(button);
    expect(
      await screen.findByText(
        "Latest: Hafiz Rahman marked Packed as done, 20 Nov at 06:10",
      ),
    ).toBeVisible();
  });
});

describe("the first screen", () => {
  it("says lateness once, with the badge, and names the expected ship day as a forecast", async () => {
    stubApi();
    open("SO-0001");
    await screen.findByRole("heading", { level: 1, name: "SO-0001" });
    expect(screen.getAllByText("3 d late")).toHaveLength(1);
    expect(screen.queryByText("Past due")).toBeNull();
    expect(screen.queryByText(/^Since /)).toBeNull();
    expect(screen.queryByText(/later than the order's ship date/)).toBeNull();
    expect(
      screen.getByText(/^Expected to ship .+: .*the order's ship date\.$/),
    ).toBeVisible();
  });

  it("has no Now card: the journey is one row of nine steps", async () => {
    stubApi();
    const view = open("SO-0001");
    const rail = await screen.findByRole("list", {
      name: "Sales order journey",
    });
    expect(within(rail).getAllByRole("listitem")).toHaveLength(9);
    expect(view.container.querySelector(".od-now")).toBeNull();
    expect(screen.queryByText("Now")).toBeNull();
  });

  it("opens on the Lines tab", async () => {
    stubApi();
    open("SO-0001");
    expect(
      await screen.findByRole("tab", { name: /^Lines/, selected: true }),
    ).toBeVisible();
  });

  it("marks a sample as a sample of the synthetic demo set, by the title, and says so from the keyboard", async () => {
    const user = userEvent.setup();
    stubApi();
    open("SO-0001");
    const badge = await screen.findByRole("button", { name: /^Sample\./ });
    expect(badge).toHaveTextContent("Sample");
    // It says nothing of where the data came from.
    expect(badge.getAttribute("aria-label")).not.toMatch(/Spectra/);
    expect(screen.queryByText("Entry")).toBeNull();
    badge.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText(
        "A sample order of the synthetic demo set. Samples are read only here.",
      ),
    ).toBeVisible();
  });
});

describe("the Checks tab", () => {
  it("counts the results its panel lists", async () => {
    const user = userEvent.setup();
    stubApi();
    open("SO-0001");
    const tabs = await screen.findByRole("tablist", { name: "Order details" });
    // The stub holds two results, one passed and one that found a difference.
    const checks = within(tabs).getByRole("tab", { name: /^Checks\s*2$/ });
    await user.click(checks);
    const panel = await screen.findByRole("tabpanel", { name: /^Checks/ });
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(within(panel).getByText("Rule customer")).toBeVisible();
    expect(within(panel).getByText("Rule quantity")).toBeVisible();
  });
});

describe("the Documents tab", () => {
  const docs = (number: string, type: string, status = "confirmed") => ({
    id: `d-${type}`,
    type,
    number,
    status,
    receivedAt: "2026-11-02T01:00:00.000Z",
    dueDate: null,
  });

  it("lists the papers still to come, each in plain words, and the one that is made but not on record", async () => {
    stubApi();
    stubFlow(() =>
      flowOf("SO-0001", {
        steps: [
          step("shipping-documents", "done"),
          step("pi-sent", "upcoming"),
        ],
        documents: [docs("PO-SO-0001", "CUSTOMER_PO")],
      }),
    );
    open("SO-0001", "?tab=documents");
    const proforma = (await screen.findByText("Proforma invoice")).closest(
      "li",
    );
    if (!proforma) throw new Error("no row");
    expect(within(proforma).getByText("Not yet made")).toBeVisible();
    const invoice = screen.getByText("Sales invoice").closest("li");
    if (!invoice) throw new Error("no row");
    expect(within(invoice).getByText("Not yet made")).toBeVisible();
    const shipping = screen
      .getByText("Air waybill or bill of lading")
      .closest("li");
    if (!shipping) throw new Error("no row");
    expect(
      within(shipping).getByText("Marked done, but no copy is on record"),
    ).toBeVisible();
    // Still to come is not "had": the tab counts the PO and the packing list
    // the checks read, and none of the three papers that are missing.
    expect(screen.getByRole("tab", { name: /^Documents\s*2$/ })).toBeVisible();
  });

  it("says nothing of what is missing when the workflow cannot be read", async () => {
    stubApi();
    stubFlow(() => "forbidden");
    open("SO-0001", "?tab=documents");
    await screen.findByText("Customer PO");
    expect(screen.queryByText("Not yet made")).toBeNull();
  });

  it("opens a document the demo set has a file for, and says so for one it has not", async () => {
    stubApi();
    stubFlow(() =>
      flowOf("SO-0001", {
        documents: [
          docs("PO-SO-0001", "CUSTOMER_PO"),
          docs("SI-100000", "SALES_INVOICE"),
        ],
      }),
    );
    open("SO-0001", "?tab=documents");
    const link = await screen.findByRole("link", {
      name: "Open the file of Sales invoice SI-100000, in a new tab",
    });
    expect(link).toHaveAttribute("href", "/demo-documents/invoice-so-0001.pdf");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    const po = screen.getByText("Customer PO").closest("li");
    if (!po) throw new Error("no row");
    expect(within(po).getByText("No file in the demo set")).toBeVisible();
    expect(within(po).queryByRole("link")).toBeNull();
  });

  it("says a document is expected by a day, and offers no file for one that has not come", async () => {
    stubApi();
    stubFlow(() =>
      flowOf("SO-0001", {
        documents: [
          docs("PO-SO-0001", "CUSTOMER_PO"),
          {
            id: "d-awb",
            type: "AWB",
            number: null,
            status: "expected",
            receivedAt: null,
            dueDate: "2026-11-23",
          },
        ],
      }),
    );
    open("SO-0001", "?tab=documents");
    const awb = (await screen.findByText("Air waybill")).closest("li");
    if (!awb) throw new Error("no row");
    expect(within(awb).getByText("Expected by 23 Nov 2026")).toBeVisible();
    expect(within(awb).queryByText("No file in the demo set")).toBeNull();
  });

  it("says a document matches the PO in plain words", async () => {
    stubApi();
    stubFlow(() => flowOf("SO-0001"));
    open("SO-0001", "?tab=documents");
    const packing = (await screen.findByText("Packing list")).closest("li");
    if (!packing) throw new Error("no row");
    expect(within(packing).getByText("Differs from the PO")).toBeVisible();
  });
});

describe("keyboard and accessibility", () => {
  it("has no accessibility violations with the status, the latest act and the documents", async () => {
    stubApi({ tasks: [taskOn("SO-0001", "SEND_PI")] });
    stubFlow(() =>
      flowOf("SO-0001", {
        timeline: [PACKED],
        documents: [
          {
            id: "d1",
            type: "SALES_INVOICE",
            number: "SI-100000",
            status: "confirmed",
            receivedAt: "2026-11-02T01:00:00.000Z",
            dueDate: null,
          },
        ],
      }),
    );
    const view = open("SO-0001", "?tab=documents");
    await screen.findByText(/^Latest:/);
    await screen.findByRole("link", { name: /Open the file of Sales invoice/ });
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
