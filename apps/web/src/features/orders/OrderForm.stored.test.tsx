import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  draftDetail,
  fakeServer,
  NEW_ORDER_NO,
  renderOrders,
} from "./orderTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const PATH = `/orders/${NEW_ORDER_NO}`;
const CLASH = "This is before the order date. Choose that day or a later one.";

describe("a stored draft opened in the form", () => {
  it("shows the description the order holds, which is the item's own when none was typed", async () => {
    // The form leaves Description empty when an item is chosen, and the server
    // stores the item's own words for such a line. Opened again, the line shows
    // what the order holds.
    fakeServer({
      detail: () =>
        draftDetail({
          lines: draftDetail().lines.map((line) => ({
            ...line,
            description: "Norvale Wireless Mouse",
          })),
        }),
    });
    renderOrders(PATH);
    expect(
      await screen.findByRole("textbox", { name: "Description, line 1" }),
    ).toHaveValue("Norvale Wireless Mouse");
  });

  it("asks for the date to be put right when the shipment date is before the order date, and saves nothing", async () => {
    // An order stored before the rule still loads. The form always sends both
    // dates, so it cannot save a change to anything else until the date is right.
    const user = userEvent.setup();
    const { requests } = fakeServer({
      detail: () =>
        draftDetail({ orderDate: "2026-11-20", shipmentDate: "2020-01-01" }),
    });
    renderOrders(PATH);
    const quantity = await screen.findByRole("textbox", {
      name: "Quantity, line 1",
    });
    await user.clear(quantity);
    await user.type(quantity, "5");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));

    expect(await screen.findByText(CLASH)).toBeVisible();
    expect(screen.getByLabelText(/Shipment date/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await waitFor(() => {
      expect(requests.patches).toHaveLength(0);
    });
  });
});
