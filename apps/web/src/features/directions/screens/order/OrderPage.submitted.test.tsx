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

const statusFacts = async () => {
  const stage = await screen.findByText("Current Stage");
  const facts = stage.closest("dl");
  if (!facts) throw new Error("no status facts");
  return facts;
};

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

describe("the page of a submitted order that no team holds", () => {
  it("says Held at Nobody and Not in the order flow, and the stock sentence as information, not as a hold", async () => {
    stubApi({ specs: [{ ...TYPED, shortBy: "20.00" }] });
    open({ ...TYPED, shortBy: "20.00" });
    const facts = await statusFacts();
    expect(within(facts).getByText("Not in the order flow")).toBeVisible();
    expect(within(facts).getByText("Nobody")).toBeVisible();
    const sentence = await screen.findByText(/^Stock today: 20 short on /);
    expect(sentence).toHaveTextContent(
      "No team has been asked to hold this order.",
    );
    // The reason of a hold is not said: nothing holds this order.
    expect(screen.queryByText(/^20 short on /)).toBeNull();
  });

  it("says nothing of stock when no line is short", async () => {
    stubApi({ specs: [TYPED] });
    open();
    await statusFacts();
    expect(screen.queryByText(/Stock today/)).toBeNull();
  });

  it("says the stock of a longer shortage with the number of the other items", async () => {
    const spec = { ...TYPED, shortBy: "20.00", shortItems: 3 };
    stubApi({ specs: [spec] });
    open(spec);
    expect(
      await screen.findByText(/and 2 more items\. No team has been asked/),
    ).toBeVisible();
  });

  it("keeps Held at as Not set for a draft and a void order, and gives them the same stage words", async () => {
    stubApi({ specs: [{ ...TYPED, entered: "draft" }] });
    const view = open({ ...TYPED, entered: "draft" });
    const draft = await statusFacts();
    expect(within(draft).getByText("Not in the order flow")).toBeVisible();
    expect(within(draft).getByText("Not set")).toBeVisible();
    expect(within(draft).queryByText("Nobody")).toBeNull();
    view.unmount();
    stubApi({ specs: [{ ...TYPED, entered: "void" }] });
    open({ ...TYPED, entered: "void" });
    const voided = await statusFacts();
    expect(within(voided).getByText("Not in the order flow")).toBeVisible();
  });

  it("shows the workflow's label as the stage when a team holds it, and not Nobody", async () => {
    const spec = { ...TYPED, workflowLabel: "Waiting for payment" };
    stubApi({ specs: [spec] });
    open(spec);
    const facts = await statusFacts();
    expect(within(facts).getByText("Waiting for payment")).toBeVisible();
    expect(within(facts).queryByText("Nobody")).toBeNull();
    expect(within(facts).queryByText("Not in the order flow")).toBeNull();
  });
});

describe("the Journey card of a submitted order that no team holds", () => {
  it("says it has no journey because it is not in the order flow, with no yet", async () => {
    stubApi({ specs: [TYPED] });
    open();
    const card = (await screen.findByText("Journey")).closest("section");
    if (!card) throw new Error("no Journey card");
    expect(
      within(card).getByText(
        "This order has no journey: it is not in the order flow.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/no journey yet/)).toBeNull();
  });

  it.each(["draft", "void"] as const)(
    "keeps its own line for a %s order",
    async (entered) => {
      stubApi({ specs: [{ ...TYPED, entered }] });
      open({ ...TYPED, entered });
      expect(
        await screen.findByText(
          "This order has no journey yet: the tracker does not know it.",
        ),
      ).toBeVisible();
      expect(screen.queryByText(/it is not in the order flow\./)).toBeNull();
    },
  );
});

describe("the tabs of a submitted order that no team holds", () => {
  it("says no steps in the Activity tab, with no 0 badge, and lists what people did below", async () => {
    stubApi({ specs: [TYPED] });
    open(TYPED, "?tab=activity");
    expect(await screen.findByText("No steps to show")).toBeVisible();
    expect(
      screen.getByText("What people did to this order is listed below."),
    ).toBeVisible();
    expect(screen.queryByText("Nothing has happened yet")).toBeNull();
    const tab = screen.getByRole("tab", { name: "Activity" });
    expect(tab).toHaveTextContent(/^Activity$/);
    // The other tabs keep their counts.
    expect(screen.getByRole("tab", { name: /^Lines/ })).toHaveTextContent("2");
  });

  it("says the Documents and Checks tabs of a typed-in order are not read", async () => {
    stubApi({ specs: [TYPED] });
    const user = userEvent.setup();
    open();
    const tab = await screen.findByRole("tab", { name: /^Documents/ });
    // The count is what the panel lists: no invented Customer PO is counted.
    expect(tab).toHaveTextContent(/^Documents0$/);
    await user.click(tab);
    expect(
      await screen.findByText(
        "No PO file is stored for an order typed in here.",
      ),
    ).toBeVisible();
    // No Customer PO row is invented for it.
    expect(screen.queryByText("Customer PO")).toBeNull();
    await user.click(screen.getByRole("tab", { name: /^Checks/ }));
    expect(await screen.findByText("Not checked")).toBeVisible();
    expect(
      screen.getByText(
        "Orders typed in here are not checked. Checks run on documents that have been read.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("No checks have run yet")).toBeNull();
  });

  it("keeps the invented Customer PO row of the Documents tab for a draft a reader opens", async () => {
    stubApi({ specs: [{ ...TYPED, entered: "draft" }] });
    const user = userEvent.setup();
    open({ ...TYPED, entered: "draft" });
    await user.click(await screen.findByRole("tab", { name: /^Documents/ }));
    expect(await screen.findByText("Customer PO")).toBeVisible();
  });

  it("has no accessibility violations with the notice and the typed-in tabs", async () => {
    stubApi({ specs: [{ ...TYPED, shortBy: "20.00" }] });
    const view = open({ ...TYPED, shortBy: "20.00" }, "?tab=activity");
    await screen.findByText("No steps to show");
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
