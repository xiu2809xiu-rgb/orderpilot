import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * Every figure on a row says what it is, and a role whose prices are masked
 * sees none. Whether prices may be seen is the server's own answer on the
 * orders list, so each case serves that answer, as Warehouse and Logistics
 * receive it today.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
});

function rowOf(title: string): HTMLElement {
  // The title is on the timeline too, so the row is looked for in Needs you.
  const needs = screen.getByRole("region", { name: "Needs you" });
  // A sentence with a glossary word in it is split in elements: match its whole text.
  const [titled] = within(needs).getAllByText(
    (_, node) => node?.textContent === title,
  );
  const row = titled?.closest("[role='listitem']");
  if (!(row instanceof HTMLElement)) throw new Error(`No row for ${title}`);
  return row;
}

describe("the amount on a task row", () => {
  it("calls an SPR's figure the SPR amount, not the order's", async () => {
    serveHome({
      prices: true,
      tasks: [
        makeTask({
          kind: "RAISE_SPR",
          assigneeRole: "PRODUCT_MANAGER",
          orderNo: "SO-0082",
          ref: { recordNo: "SPR-20261115-0006", navisionNo: null },
          amount: "34614.72",
        }),
      ],
    });
    renderHome("PRODUCT_MANAGER");
    expect(await screen.findByText("USD 34,614.72")).toBeVisible();
    const row = rowOf("Raise the SPR for SO-0082");
    expect(row).toHaveTextContent("SPR amount USD 34,614.72");
  });

  it("calls the figure of an SPR to approve the SPR amount too", async () => {
    serveHome({
      prices: true,
      tasks: [
        makeTask({
          kind: "APPROVE_SPR",
          assigneeRole: "APPROVER",
          orderNo: "SO-0083",
          ref: { recordNo: "SPR-20261115-0007", navisionNo: null },
          amount: "1200.50",
        }),
      ],
    });
    renderHome("APPROVER");
    expect(await screen.findByText(/SPR amount/)).toBeVisible();
    expect(screen.getByText(/SPR amount/).parentElement).toHaveTextContent(
      "SPR amount USD 1,200.50",
    );
  });

  it("says what is due and the order's whole total on a payment", async () => {
    serveHome({
      prices: true,
      tasks: [
        makeTask({
          kind: "CONFIRM_PAYMENT",
          assigneeRole: "FINANCE",
          orderNo: "SO-0300",
          amount: "16864.74",
          expectedPayment: {
            paymentType: "prepayment",
            amount: "8432.37",
            currencyCode: "USD",
          },
        }),
      ],
    });
    renderHome("FINANCE");
    expect(
      await screen.findByText(/Due/, { selector: "span.fs-12" }),
    ).toBeVisible();
    expect(rowOf("Confirm the payment")).toHaveTextContent(
      "Due USD 8,432.37 of USD 16,864.74",
    );
  });

  it("does not say 'of' when what is due is the whole", async () => {
    serveHome({
      prices: true,
      tasks: [
        makeTask({
          kind: "CONFIRM_PAYMENT",
          assigneeRole: "FINANCE",
          orderNo: "SO-0301",
          amount: "500.00",
          expectedPayment: {
            paymentType: "full-payment",
            amount: "500.00",
            currencyCode: "USD",
          },
        }),
      ],
    });
    renderHome("FINANCE");
    await within(
      await screen.findByRole("region", { name: "Needs you" }),
    ).findByText("Confirm the payment");
    await waitFor(() => {
      expect(rowOf("Confirm the payment")).toHaveTextContent("Due USD 500.00");
    });
    expect(rowOf("Confirm the payment")).not.toHaveTextContent(" of USD");
  });

  it("calls any other figure the order value", async () => {
    serveHome({
      prices: true,
      tasks: [makeTask({ kind: "SEND_PI", assigneeRole: "SUPPORT" })],
    });
    renderHome("SUPPORT");
    await waitFor(() => {
      expect(rowOf("Send the PI to the customer")).toHaveTextContent(
        "Order value USD 12,340.00",
      );
    });
  });

  it("keeps tabular figures", async () => {
    serveHome({ prices: true, tasks: [makeTask({ assigneeRole: "SUPPORT" })] });
    renderHome("SUPPORT");
    const label = await screen.findByText("Order value");
    expect(label.parentElement?.className).toContain("numeral");
  });

  it.each(["WAREHOUSE", "LOGISTICS"] as const)(
    "shows %s the Orders page's mask with its reason, and no figure",
    async (role) => {
      const served = serveHome({
        prices: false,
        tasks: [makeTask({ assigneeRole: role })],
      });
      renderHome(role);
      await within(
        await screen.findByRole("region", { name: "Needs you" }),
      ).findByText("Pack the order");
      await waitFor(() => {
        expect(served.calls).toContain("GET /api/v1/orders");
      });
      const row = await waitFor(() => {
        const found = rowOf("Pack the order");
        // The mask is a button with the reason as its description, as on the Orders page.
        expect(
          within(found).getByRole("button", { name: /Hidden/ }),
        ).toBeVisible();
        return found;
      });
      const mask = within(row).getByRole("button", { name: /Hidden/ });
      expect(mask).toHaveAccessibleDescription(
        "Hidden: prices are for roles that work with pricing",
      );
      // The label stays, so the mask says which figure is hidden; the figure never reaches the page.
      expect(row).toHaveTextContent("Order value");
      expect(within(row).queryByText(/USD/)).toBeNull();
      expect(row).not.toHaveTextContent("12,340");
    },
  );

  it("draws the mask where an SPR amount would be, for a role that may not see prices", async () => {
    serveHome({
      prices: false,
      tasks: [
        makeTask({
          kind: "RAISE_SPR",
          assigneeRole: "PRODUCT_MANAGER",
          orderNo: "SO-0082",
          ref: { recordNo: "SPR-20261115-0006", navisionNo: null },
          amount: "34614.72",
        }),
      ],
    });
    renderHome("PRODUCT_MANAGER");
    const row = await waitFor(() => {
      const found = rowOf("Raise the SPR for SO-0082");
      within(found).getByRole("button", { name: /Hidden/ });
      return found;
    });
    expect(row).toHaveTextContent("SPR amount");
    expect(row).not.toHaveTextContent("34,614");
  });

  it.each(["empty", "failed"] as const)(
    "shows neither a figure nor a mask when the orders list is %s, so a mask is never drawn on a guess",
    async (orders) => {
      // A role that may see prices loses its figure here, because the answer is
      // read from the first order: with none (or no answer) it is not known.
      const served = serveHome({
        orders,
        tasks: [makeTask({ assigneeRole: "SUPPORT" })],
      });
      renderHome("SUPPORT");
      await within(
        await screen.findByRole("region", { name: "Needs you" }),
      ).findByText("Pack the order");
      await waitFor(() => {
        expect(served.calls).toContain("GET /api/v1/orders");
      });
      // Let the answer land before looking for what must not be there.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const row = rowOf("Pack the order");
      expect(within(row).queryByText(/USD/)).toBeNull();
      expect(within(row).queryByText("Order value")).toBeNull();
      expect(within(row).queryByRole("button", { name: /Hidden/ })).toBeNull();
    },
  );
});
