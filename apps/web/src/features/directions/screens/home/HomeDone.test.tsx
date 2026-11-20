import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { OrderAction } from "../order/OrderAction";
import { renderWithToasts } from "../order/orderPageTestKit";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * Done today lists what the signed-in person finished today, from Home or from
 * an order's page, and still does after a reload. It is the browser's own copy,
 * per person, so these tests start Home again the way a reload does.
 */
const SENT = /^Marked the PI for SO-0084 as sent at \d\d:\d\d$/;
const PI = makeTask({
  kind: "SEND_PI",
  assigneeRole: "SUPPORT",
  orderNo: "SO-0084",
});

beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  localStorage.clear();
  useSessionStore.setState({ status: "anonymous", session: null });
  useToastStore.setState({ items: [] });
});

describe("Done today on Home", () => {
  it("survives a reload: the same person's list is there when Home starts again", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PI] });
    const first = renderHome("SUPPORT");
    await user.click(
      await screen.findByRole("button", {
        name: "Mark PI as sent for SO-0084",
      }),
    );
    expect(await screen.findByText(SENT)).toBeVisible();
    first.unmount();

    // The task is done on the server now, so only the browser remembers it.
    serveHome({ tasks: [] });
    renderHome("SUPPORT", { keepDone: true });
    expect(await screen.findByText(SENT)).toBeVisible();
    expect(await screen.findByText("Synthetic Harbour Traders")).toBeVisible();
  });

  it("is one person's own: another signed in on the same browser sees none of it", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PI] });
    const first = renderHome("SUPPORT");
    await user.click(
      await screen.findByRole("button", {
        name: "Mark PI as sent for SO-0084",
      }),
    );
    await screen.findByText(SENT);
    first.unmount();

    serveHome({ tasks: [] });
    renderHome("APPROVER", { keepDone: true });
    expect(
      await screen.findByText(/^Nothing finished yet today/),
    ).toBeVisible();
    expect(screen.queryByText(SENT)).toBeNull();
  });

  it("leaves out an entry of another day", async () => {
    const id = sessionFor("SUPPORT").user.id;
    localStorage.setItem(
      `op.done.${id}`,
      JSON.stringify([
        {
          kind: "SEND_PI",
          orderNo: "SO-0084",
          customerName: null,
          at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        },
      ]),
    );
    serveHome({ tasks: [] });
    renderHome("SUPPORT", { keepDone: true });
    expect(
      await screen.findByText(/^Nothing finished yet today/),
    ).toBeVisible();
  });

  // A browser may still hold a line an earlier build noted for a kind that no
  // screen records any more, and the list reads its words by kind, so the two
  // strings of home.json for them stay.
  it("still words a stored line of a kind nothing records any more", async () => {
    const id = sessionFor("FINANCE").user.id;
    localStorage.setItem(
      `op.done.${id}`,
      JSON.stringify([
        {
          kind: "CONFIRM_PAYMENT",
          orderNo: "SO-0084",
          customerName: null,
          at: new Date().toISOString(),
        },
      ]),
    );
    serveHome({ tasks: [] });
    renderHome("FINANCE", { keepDone: true });
    expect(
      await screen.findByText(
        /^Confirmed the payment for SO-0084 at \d\d:\d\d$/,
      ),
    ).toBeVisible();
  });

  it("lists an act made on an order's page", async () => {
    const user = userEvent.setup();
    useSessionStore.setState({
      status: "active",
      session: sessionFor("SUPPORT"),
    });
    serveHome({ tasks: [] });
    const page = renderWithToasts(
      <OrderAction task={PI} orderNo="SO-0084" pending={false} hasInbox />,
      "/orders/SO-0084",
    );
    await user.click(
      await screen.findByRole("button", { name: "Mark PI as sent" }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items).toHaveLength(1);
    });
    page.unmount();

    renderHome("SUPPORT", { keepDone: true });
    expect(await screen.findByText(SENT)).toBeVisible();
  });
});
