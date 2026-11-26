import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { todayInSingapore } from "@/lib/format";
import { refused, renderOrders } from "./orderTestKit";
import {
  answerConfirm,
  EXISTING,
  http,
  HttpResponse,
  openPanel,
  PREVIEW,
  previewOf,
  saveRefused,
  serveRevision,
  server,
  submittedOrder,
} from "./revisionTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
    "directions-orders",
    "directions-parts",
  ]);
});

beforeEach(() => {
  localStorage.clear();
});

const KEEP = "Keep the order's dates and prepayment";
const keepButton = () => screen.queryByRole("button", { name: KEEP });
const panelOf = () => screen.getByRole("region", { name: /Add this PO as/ });

/** The form's three header fields, as a person reads them. */
const field = {
  prepayment: () => screen.getByRole("textbox", { name: /Prepayment/ }),
  shipment: () => screen.getByLabelText(/Shipment date/),
  orderDate: () => screen.getByLabelText(/^Order date/),
};

async function opened(options: Parameters<typeof serveRevision>[0] = {}) {
  const user = userEvent.setup();
  const served = serveRevision(options);
  renderOrders("/orders/new");
  await saveRefused(user);
  const panel = await openPanel(user);
  return { user, panel, ...served };
}

describe("keeping the order's dates and prepayment", () => {
  it("shows the button only when the order date, the shipment date or the prepayment differ", async () => {
    // The form starts with today, no shipment date and 100%, which the stored
    // order here also holds: nothing to keep, though the lines differ.
    const same = await opened({
      stored: submittedOrder({
        orderDate: todayInSingapore(),
        shipmentDate: null,
        prepaymentPercent: "100.00",
      }),
    });
    expect(keepButton()).toBeNull();
    expect(
      within(same.panel).queryByText(/This form starts with today's date/),
    ).toBeNull();
  });

  it.each([
    ["the order date", { orderDate: "2026-11-08" }],
    ["the shipment date", { shipmentDate: "2026-12-01" }],
    ["the prepayment", { prepaymentPercent: "30.00" }],
  ])("shows the button when only %s differs", async (_name, over) => {
    await opened({
      stored: submittedOrder({
        orderDate: todayInSingapore(),
        shipmentDate: null,
        prepaymentPercent: "100.00",
        ...over,
      }),
    });
    expect(keepButton()).toBeVisible();
  });

  it("sends a second preview with the stored values, and the confirmation sends that same body", async () => {
    const { user, requests } = await opened();
    expect(requests.previews).toHaveLength(1);
    expect(requests.previews[0]).toMatchObject({
      orderDate: todayInSingapore(),
      shipmentDate: null,
      prepaymentPercent: "100.00",
    });
    await user.click(await screen.findByRole("button", { name: KEEP }));
    await waitFor(() => {
      expect(requests.previews).toHaveLength(2);
    });
    expect(requests.previews[1]).toMatchObject({
      orderDate: "2026-11-08",
      shipmentDate: "2026-12-01",
      prepaymentPercent: "30.00",
    });
    // Everything else of the body is the typed PO's own.
    expect(requests.previews[1]).toEqual({
      ...requests.previews[0],
      orderDate: "2026-11-08",
      shipmentDate: "2026-12-01",
      prepaymentPercent: "30.00",
    });
    answerConfirm(requests, () =>
      refused(409, "CONFLICT", null, "Stop here.")(),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm PO version 2" }),
    );
    await waitFor(() => {
      expect(requests.confirms).toHaveLength(1);
    });
    expect(requests.confirms[0]).toEqual({
      ...requests.previews[1],
      confirmed: true,
      expectedPoVersionNo: 1,
    });
  });

  it("puts the stored values in the form's own fields, and the header reads Same", async () => {
    const { user } = await opened();
    expect(field.prepayment()).toHaveValue("100.00");
    await user.click(await screen.findByRole("button", { name: KEEP }));
    await waitFor(() => {
      expect(field.prepayment()).toHaveValue("30.00");
    });
    expect(field.shipment()).toHaveValue("2026-12-01");
    expect(field.orderDate()).toHaveValue("2026-11-08");
    // The three fields, and the currency, now read Same; the sentence and the
    // button are gone, and a polite status says what happened.
    const header = await waitFor(() => {
      const found = within(panelOf()).getByText("Order date").closest("dl");
      if (!found) throw new Error("no header block");
      expect(within(found).getAllByText("Same")).toHaveLength(4);
      return found;
    });
    // Only the total still changes: the lines of this fixture do.
    expect(within(header).getAllByText("Changed")).toHaveLength(1);
    expect(keepButton()).toBeNull();
    expect(screen.queryByText(/This form starts with today's date/)).toBeNull();
    expect(
      screen.getByText("Now using the order's dates and prepayment."),
    ).toHaveAttribute("role", "status");
  });

  it("keeps the offer and the panel after it, and Not a revision leaves the form with the stored values", async () => {
    const { user } = await opened();
    await user.click(await screen.findByRole("button", { name: KEEP }));
    await screen.findByText("Now using the order's dates and prepayment.");
    // The panel is still open: setting the fields was not read as an edit.
    expect(panelOf()).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Not a revision" }));
    const offer = await screen.findByRole("button", {
      name: `This PO revises ${EXISTING}`,
    });
    expect(offer).toBeVisible();
    expect(field.prepayment()).toHaveValue("30.00");
    expect(
      screen.getByRole("link", { name: `Open ${EXISTING}` }),
    ).toBeVisible();
  });

  it("asks about the kept body when the panel is opened again", async () => {
    const { user, requests } = await opened();
    await user.click(await screen.findByRole("button", { name: KEEP }));
    await screen.findByText("Now using the order's dates and prepayment.");
    await user.click(screen.getByRole("button", { name: "Not a revision" }));
    await user.click(
      await screen.findByRole("button", {
        name: `This PO revises ${EXISTING}`,
      }),
    );
    await waitFor(() => {
      expect(requests.previews).toHaveLength(3);
    });
    expect(requests.previews[2]).toEqual(requests.previews[1]);
  });

  it("says the PO matches when keeping the stored values leaves nothing else different", async () => {
    const { user, api } = await opened();
    api.differences = (body) =>
      previewOf(body, api.stored, {
        identical: body.orderDate === "2026-11-08",
        lines: body.orderDate === "2026-11-08" ? [] : previewOf(body).lines,
      });
    await user.click(await screen.findByRole("button", { name: KEEP }));
    expect(
      await screen.findByRole("region", {
        name: "This PO matches PO version 1",
      }),
    ).toHaveTextContent(
      "This PO has the same dates, quantities and prices as PO version 1, so there is nothing to confirm.",
    );
    expect(
      screen.queryByRole("button", { name: /^Confirm PO version/ }),
    ).toBeNull();
    expect(
      screen.getByText("Now using the order's dates and prepayment."),
    ).toBeVisible();
  });

  it("ignores the late answer of an older preview", async () => {
    const { user, requests, api } = await opened();
    // The second preview, which keeping sends, is held back; the third is not.
    let releaseSecond: () => void = () => undefined;
    let calls = 0;
    server.use(
      http.post(PREVIEW, async ({ request }) => {
        calls += 1;
        const body = (await request.json()) as Parameters<
          typeof api.differences
        >[0];
        requests.previews.push(body);
        if (calls === 1) {
          await new Promise<void>((resolve) => {
            releaseSecond = resolve;
          });
          // Said late, and said wrongly: this one must not be drawn.
          return HttpResponse.json({
            data: previewOf(body, api.stored, { identical: true, lines: [] }),
          });
        }
        return HttpResponse.json({ data: api.differences(body) });
      }),
    );
    await user.click(await screen.findByRole("button", { name: KEEP }));
    await waitFor(() => {
      expect(calls).toBe(1);
    });
    await user.click(screen.getByRole("button", { name: "Not a revision" }));
    await user.click(
      await screen.findByRole("button", {
        name: `This PO revises ${EXISTING}`,
      }),
    );
    await screen.findByRole("button", { name: "Confirm PO version 2" });
    act(() => {
      releaseSecond();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      screen.getByRole("region", { name: /Add this PO as PO version 2/ }),
    ).toBeVisible();
    expect(screen.queryByText(/nothing to confirm/)).toBeNull();
  });
});
