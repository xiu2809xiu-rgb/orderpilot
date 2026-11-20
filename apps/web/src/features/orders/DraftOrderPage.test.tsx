import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { draftKey, writeDraft } from "@/lib/draft-store";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { fromDetail } from "./orderFormValues";
import {
  answerWrite,
  draftDetail,
  errorBody,
  fakeServer,
  http,
  HttpResponse,
  maskedPrice,
  NEW_ORDER_NO,
  refused,
  renderOrders,
  saved,
  server,
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
const PATCH = "*/api/v1/orders/:orderNo";
const quantity = () =>
  screen.findByRole("textbox", { name: "Quantity, line 1" });
const save = () => screen.getByRole("button", { name: /^Save$/ });
const voidButton = () => screen.getByRole("button", { name: "Void" });
const storedDrafts = () =>
  Object.keys(localStorage).filter((key) => key.includes(".order."));

async function retype(user: ReturnType<typeof userEvent.setup>, value: string) {
  const box = await quantity();
  await user.clear(box);
  await user.type(box, value);
}

/** A draft typed earlier on this device, as the draft store keeps it. */
function storeTypedDraft(version: number, amount: string, key = NEW_ORDER_NO) {
  const viewer = sessionFor("SUPPORT").user.id;
  const values = fromDetail(draftDetail());
  const [line] = values.lines;
  writeDraft(draftKey(viewer, `order.${key}`), {
    version: 1,
    savedAt: new Date().toISOString(),
    values: {
      ...values,
      version,
      lines: [{ ...line, quantity: amount }],
    },
  });
}

describe("a draft order's page", () => {
  it("shows loading, then the order, from the record's own values", async () => {
    fakeServer();
    renderOrders(PATH);
    expect(await quantity()).toHaveValue("2");
    expect(screen.getByRole("textbox", { name: /PO number/ })).toHaveValue(
      "PO-7731",
    );
    expect(screen.getByText("Synthetic demo data")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: `Sales order ${NEW_ORDER_NO}` }),
    ).toBeVisible();
    expect(await screen.findByText(/40 PCS available/)).toBeVisible();
  });

  it("says when the order is not found", async () => {
    fakeServer();
    server.use(
      http.get(PATCH, () =>
        HttpResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Order was not found",
              details: null,
              traceId: "t-1",
            },
          },
          { status: 404 },
        ),
      ),
    );
    renderOrders("/orders/SO-NONE");
    expect(
      await screen.findByText("This document was not found"),
    ).toBeVisible();
  });

  it("shows the trace id of a failed load and tries again on request", async () => {
    const user = userEvent.setup();
    fakeServer();
    let healthy = false;
    server.use(
      http.get(PATCH, () =>
        healthy
          ? HttpResponse.json({ data: draftDetail() })
          : refused(500, "INTERNAL_ERROR", null, "Broke.", "trace-load-7")(),
      ),
    );
    renderOrders(PATH);
    expect(await screen.findByText(/trace-load-7/)).toBeVisible();
    healthy = true;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await quantity()).toHaveValue("2");
  });

  it("sends the version it was typed against, then the one the save answered with", async () => {
    const user = userEvent.setup();
    const { requests } = fakeServer();
    renderOrders(PATH);
    answerWrite(
      "patch",
      PATCH,
      requests.patches,
      saved(draftDetail({ version: 4 }), 200),
    );
    await retype(user, "5");
    await user.click(save());
    await waitFor(() => {
      expect(requests.patches).toHaveLength(1);
    });
    await screen.findByText(`Order ${NEW_ORDER_NO} saved`);
    // Clean at once: Void does not ask to save first, and nothing stays in storage.
    await user.click(voidButton());
    expect(await screen.findByText("Void this draft?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    answerWrite(
      "patch",
      PATCH,
      requests.patches,
      saved(draftDetail({ version: 5 }), 200),
    );
    await retype(user, "6");
    await user.click(save());
    await waitFor(() => {
      expect(requests.patches).toHaveLength(2);
    });
    expect(requests.patches).toMatchObject([
      { version: 3, lines: [{ quantity: "5" }] },
      { version: 4, lines: [{ quantity: "6" }] },
    ]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(storedDrafts()).toEqual([]);
  });

  it("sends a restored draft's own version, and offers Reload when it is stale", async () => {
    const user = userEvent.setup();
    const { requests } = fakeServer();
    storeTypedDraft(2, "9");
    renderOrders(PATH);
    expect(await screen.findByText(/Draft restored/)).toBeVisible();
    expect(await quantity()).toHaveValue("9");
    answerWrite(
      "patch",
      PATCH,
      requests.patches,
      refused(
        409,
        "CONFLICT",
        null,
        "This order was changed by someone else.",
        "trace-stale-1",
      ),
    );
    await user.click(save());
    expect(await screen.findByText("This draft changed")).toBeVisible();
    expect(requests.patches).toMatchObject([{ version: 2 }]);
    expect(screen.getByText(/trace-stale-1/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => {
      expect(screen.queryByText("This draft changed")).toBeNull();
    });
    expect(await quantity()).toHaveValue("2");
    expect(storedDrafts()).toEqual([]);
  });

  it("does not bring a typed draft back over an order that is void now", async () => {
    fakeServer({ detail: () => draftDetail({ captureState: "void" }) });
    storeTypedDraft(3, "9");
    renderOrders(PATH);
    const row = await screen.findByRole("row", { name: "Line 1" });
    expect(within(row).getByText("2")).toBeVisible();
    expect(screen.queryByText(/Draft restored/)).toBeNull();
    expect(
      screen.getByText("This order is void. It cannot be changed."),
    ).toBeVisible();
  });

  it("voids a draft with a reason and then shows it read-only", async () => {
    const user = userEvent.setup();
    const { requests, api } = fakeServer();
    renderOrders(PATH);
    await quantity();
    answerWrite("post", "*/api/v1/orders/:orderNo/void", requests.voids, () => {
      api.detail = () => draftDetail({ captureState: "void", version: 4 });
      return HttpResponse.json({ data: api.detail() });
    });
    await user.click(voidButton());
    await user.type(
      await screen.findByRole("textbox", { name: /Reason/ }),
      "Customer withdrew the PO",
    );
    await user.click(screen.getByRole("button", { name: "Void order" }));
    expect(
      await screen.findByText("This order is void. It cannot be changed."),
    ).toBeVisible();
    expect(requests.voids).toEqual([
      { version: 3, reason: "Customer withdrew the PO" },
    ]);
    expect(screen.queryByRole("button", { name: /^Save$/ })).toBeNull();
  });

  it.each([
    [
      "a submitted order",
      { captureState: "submitted" as const },
      "SUPPORT",
      "This order is submitted. Only a draft can be changed.",
    ],
    [
      "a void order",
      { captureState: "void" as const },
      "SUPPORT",
      "This order is void. It cannot be changed.",
    ],
    [
      "a sample order",
      { captureState: null, source: "sample" as const, version: null },
      "SUPPORT",
      "A sample order of the synthetic demo set. Samples are read only here.",
    ],
    [
      "a draft opened by a role that may only read",
      {},
      "FINANCE",
      "Your role may read orders but not change them.",
    ],
  ] as const)(
    "is read-only for %s, and Ctrl+S does nothing",
    async (_name, over, role, words) => {
      const user = userEvent.setup();
      const { requests } = fakeServer({ detail: () => draftDetail(over) });
      renderOrders(PATH, role);
      expect(await screen.findByText(words)).toBeVisible();
      expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
      expect(
        screen.getByRole("textbox", { name: /PO number/ }),
      ).toHaveAttribute("readonly");
      // Nothing can be typed, so nothing is asked for and nothing is hinted.
      expect(document.body.textContent).not.toContain("*");
      expect(
        screen.queryByText(/Search by Business Central number/),
      ).toBeNull();
      expect(screen.queryByText(/One customer and PO number/)).toBeNull();
      expect(screen.queryByText(/comes from the customer's PO/)).toBeNull();
      expect(screen.getByText(/Availability is mock/)).toBeVisible();
      const row = await screen.findByRole("row", { name: "Line 1" });
      expect(within(row).queryByRole("textbox")).toBeNull();
      // No note is shown on a read-only page, so no last price is asked for.
      expect(requests.lastPriceReads).toBe(0);
      await user.click(screen.getByRole("textbox", { name: /PO number/ }));
      await user.keyboard("{Control>}s{/Control}");
      expect(requests.patches).toEqual([]);
    },
  );

  it("shows a role that may not see prices the mask, never a price, and passes axe", async () => {
    fakeServer({
      masked: true,
      detail: () =>
        draftDetail({
          amount: maskedPrice,
          lines: draftDetail().lines.map((line) => ({
            ...line,
            unitPrice: maskedPrice,
            lineAmount: maskedPrice,
          })),
        }),
    });
    const view = renderOrders(PATH, "WAREHOUSE");
    await screen.findByRole("row", { name: "Line 1" });
    expect(screen.queryByText(/18\.40|36\.80/)).toBeNull();
    expect(screen.getAllByLabelText("Hidden").length).toBeGreaterThan(0);
    // The reason names no role by name: area 4 owns who sees prices.
    const row = screen.getByRole("row", { name: "Line 1" });
    const [why] = within(row).getAllByRole("button", {
      name: "Why is this hidden?",
    });
    if (!why) throw new Error("no reason button");
    await userEvent.setup().click(why);
    expect(await screen.findByText(/Roles that handle prices/)).toBeVisible();
    expect(screen.queryByText(/Support and Finance/)).toBeNull();
    expect(await axeViolations(view.container)).toEqual([]);
  });

  it("is clean for axe as an editable draft", async () => {
    fakeServer();
    const view = renderOrders(PATH);
    await quantity();
    expect(
      within(view.container).getByRole("table", { name: "Order lines" }),
    ).toBeVisible();
    expect(await axeViolations(view.container)).toEqual([]);
  });
});

describe("the stock beside each line", () => {
  it("refreshes without making the form look changed", async () => {
    const user = userEvent.setup();
    const { api, requests } = fakeServer();
    const { client, router } = renderOrders(PATH);
    await screen.findByText(/40 PCS available/);
    api.stock = () => "35.000";
    await act(() =>
      client.invalidateQueries({
        queryKey: ["/api/v1/master-data/available-stock"],
      }),
    );
    expect(await screen.findByText(/35 PCS available/)).toBeVisible();
    expect(requests.stockReads).toBeGreaterThan(1);
    // Nothing to save, so Void works at once and leaving asks nothing.
    await user.click(voidButton());
    expect(await screen.findByText("Void this draft?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await act(() => router.navigate("/orders"));
    expect(router.state.location.pathname).toBe("/orders");
    expect(storedDrafts()).toEqual([]);
  });

  it("turns the figure into Not known when a later refresh fails, and keeps the form clean", async () => {
    const user = userEvent.setup();
    fakeServer();
    const { client, router } = renderOrders(PATH);
    await screen.findByText(/40 PCS available/);
    server.use(
      http.get("*/api/v1/master-data/available-stock", () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR"), { status: 500 }),
      ),
    );
    await act(() =>
      client.invalidateQueries({
        queryKey: ["/api/v1/master-data/available-stock"],
      }),
    );
    expect(await screen.findByText("Not known")).toBeVisible();
    expect(screen.queryByText(/40 PCS available/)).toBeNull();
    await user.click(voidButton());
    expect(await screen.findByText("Void this draft?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await act(() => router.navigate("/orders"));
    expect(storedDrafts()).toEqual([]);
  });

  it("turns the figure into Not known when the answer leaves the item out", async () => {
    fakeServer();
    const { client } = renderOrders(PATH);
    await screen.findByText(/40 PCS available/);
    server.use(
      http.get("*/api/v1/master-data/available-stock", () =>
        HttpResponse.json({ data: [], meta: { mock: true } }),
      ),
    );
    await act(() =>
      client.invalidateQueries({
        queryKey: ["/api/v1/master-data/available-stock"],
      }),
    );
    expect(await screen.findByText("Not known")).toBeVisible();
  });

  it("asks again every 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const { requests } = fakeServer();
      renderOrders(PATH);
      await screen.findByText(/40 PCS available/);
      const first = requests.stockReads;
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      await waitFor(() => {
        expect(requests.stockReads).toBeGreaterThan(first);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves a saved form clean when a refresh lands during the save", async () => {
    const user = userEvent.setup();
    const { api, requests } = fakeServer();
    const { client } = renderOrders(PATH);
    await screen.findByText(/40 PCS available/);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(PATCH, async ({ request }) => {
        requests.patches.push(await request.json());
        await held;
        return HttpResponse.json({ data: draftDetail({ version: 4 }) });
      }),
    );
    await retype(user, "5");
    await user.click(save());
    await waitFor(() => {
      expect(requests.patches).toHaveLength(1);
    });
    api.stock = () => "30.000";
    const before = requests.stockReads;
    await act(() =>
      client.invalidateQueries({
        queryKey: ["/api/v1/master-data/available-stock"],
      }),
    );
    expect(requests.stockReads).toBeGreaterThan(before);
    // Lets the answer reach the page while the save is still held.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    release();
    await screen.findAllByText(`Order ${NEW_ORDER_NO} saved`);
    expect(await screen.findByText(/30 PCS available/)).toBeVisible();
    await user.click(voidButton());
    expect(await screen.findByText("Void this draft?")).toBeVisible();
  });
});
