import { screen, within } from "@testing-library/react";
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
import { sessionFor } from "@/test/fixtures";
import { loadNamespaces, SPECS, stubApi } from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import { flowOf, renderWithToasts, stubFlow } from "./orderPageTestKit";

const [first] = SPECS;
if (!first) throw new Error("no spec");
// SO-0041 has a PO and a packing list in the demo set; SO-0001 has an invoice.
const WITH_FILES = { ...first, orderNo: "SO-0041" };

const doc = (number: string, type: string) => ({
  id: `d-${type}`,
  type,
  number,
  status: "confirmed",
  receivedAt: "2026-11-02T01:00:00.000Z",
  dueDate: null,
});

function open(orderNo: string, role: "SUPPORT" | "WAREHOUSE" | "LOGISTICS") {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  return renderWithToasts(
    <OrderPage orderNo={orderNo} />,
    `/orders/${orderNo}?tab=documents`,
  );
}

function row(label: string) {
  const found = screen.getByText(label).closest("li");
  if (!found) throw new Error(`no row for ${label}`);
  return found;
}

beforeAll(loadNamespaces);
beforeEach(() => {
  stubFlow(() =>
    flowOf("SO-0041", {
      documents: [
        doc("PO-SO-0041", "CUSTOMER_PO"),
        doc("PL-0041", "PACKING_LIST"),
      ],
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.setState({ status: "booting", session: null });
});

describe("the file of a document that prints prices", () => {
  it("opens for a role that may see prices", async () => {
    stubApi({ specs: [WITH_FILES] });
    open("SO-0041", "SUPPORT");
    await screen.findByText("Customer PO");
    const po = within(row("Customer PO"));
    expect(
      po.getByRole("link", { name: /Open the file of Customer PO/ }),
    ).toHaveAttribute("href", "/demo-documents/po-table-so-0041.pdf");
  });

  it("is withheld from a role whose prices are masked, with the reason, because the PDF prints them", async () => {
    stubApi({ specs: [WITH_FILES], masked: true });
    open("SO-0041", "WAREHOUSE");
    await screen.findByText("Customer PO");
    const po = within(row("Customer PO"));
    expect(po.queryByRole("link")).toBeNull();
    // The mark is the same one the page uses for a hidden amount, with its reason.
    expect(
      po.getByText(/prices are for roles that work with pricing/),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('a[href$=".pdf"]')).toHaveLength(1);
  });

  it("leaves a file that prints no prices open to a role whose prices are masked", async () => {
    stubApi({ specs: [WITH_FILES], masked: true });
    open("SO-0041", "LOGISTICS");
    await screen.findByText("Packing list");
    expect(
      within(row("Packing list")).getByRole("link", {
        name: /Open the file of Packing list/,
      }),
    ).toHaveAttribute("href", "/demo-documents/pl-so-0041-mismatch.pdf");
  });
});
