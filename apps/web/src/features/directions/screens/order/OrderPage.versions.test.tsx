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
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
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

const NO = "SO-20261108-0002";
const SUBMITTED: OrderSpec = {
  ...nth(SPECS, 1),
  orderNo: NO,
  entered: "submitted",
  orderedDaysAgo: 2,
};

const open = (spec: OrderSpec, query = "") =>
  renderAt(
    <OrderPage orderNo={spec.orderNo} />,
    `/orders/${spec.orderNo}${query}`,
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

describe("the order page of a revised order", () => {
  it("shows the PO version chip, the Versions tab with no count, and a note above the lines", async () => {
    const spec = { ...SUBMITTED, poVersionNo: 3 };
    stubApi({ specs: [spec] });
    open(spec);
    expect(
      await screen.findByRole("link", {
        name: "PO version 3. Open the Versions tab.",
      }),
    ).toBeVisible();
    // The tab has no count: it would need the list before the tab is opened.
    expect(screen.getByRole("tab", { name: "Versions" })).toHaveTextContent(
      /^Versions$/,
    );
    expect(
      screen.getByText(
        "These are the lines of PO version 3, the current one. Earlier versions are on the Versions tab.",
      ),
    ).toBeVisible();
  });

  it("opens the Versions tab from the chip", async () => {
    const user = userEvent.setup();
    const spec = { ...SUBMITTED, poVersionNo: 2 };
    stubApi({ specs: [spec] });
    open(spec);
    await user.click(
      await screen.findByRole("link", {
        name: "PO version 2. Open the Versions tab.",
      }),
    );
    const panel = await screen.findByRole("tabpanel", { name: "Versions" });
    expect(
      within(panel).getByRole("heading", { name: "PO versions" }),
    ).toBeVisible();
  });

  it("shows no chip and no note for PO version 1 and for a sample", async () => {
    stubApi({ specs: [SUBMITTED] });
    const view = open(SUBMITTED);
    await screen.findByRole("tab", { name: "Versions" });
    expect(
      screen.queryByRole("link", { name: /Open the Versions tab/ }),
    ).toBeNull();
    expect(screen.queryByText(/the current one/)).toBeNull();
    view.unmount();
    const [sample] = SPECS;
    if (!sample) throw new Error("no sample order");
    stubApi({ specs: [sample] });
    open(sample);
    await screen.findByRole("tab", { name: "Versions" });
    expect(
      screen.queryByRole("link", { name: /Open the Versions tab/ }),
    ).toBeNull();
  });

  it("has no accessibility violations on the Versions tab of a submitted order", async () => {
    stubApi({ specs: [{ ...SUBMITTED, poVersionNo: 2 }] });
    const view = open({ ...SUBMITTED, poVersionNo: 2 }, "?tab=versions");
    await screen.findByRole("heading", { name: "PO versions" });
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
