import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import {
  answerWrite,
  draftDetail,
  fakeServer,
  http,
  HttpResponse,
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
const SUBMIT = "*/api/v1/orders/:orderNo/submit";
const PATCH = "*/api/v1/orders/:orderNo";
const SHORT = {
  itemNo: "I-0001",
  ordered: "2.000",
  availableStock: "1.000",
  shortBy: "1.000",
};
const quantity = () =>
  screen.findByRole("textbox", { name: "Quantity, line 1" });
/** The bar's own button, before the dialog is open. */
const barSubmit = () => screen.getByRole("button", { name: "Submit order" });
const barSave = () => screen.getByRole("button", { name: /^Save$/ });
const confirmIn = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Submit order" });
const isPrimary = (button: HTMLElement) =>
  button.className.split(" ").includes("bg-primary");

/** What the server holds after the submit: the same order, submitted, one version on. */
function submittedAfter(api: { detail: () => ReturnType<typeof draftDetail> }) {
  return () => {
    api.detail = () => draftDetail({ captureState: "submitted", version: 4 });
    return HttpResponse.json({ data: api.detail() });
  };
}

/** A page with the dialog open, and what the server was sent. */
async function openDialog(over: Parameters<typeof draftDetail>[0] = {}) {
  const user = userEvent.setup();
  const kit = fakeServer({ detail: () => draftDetail(over) });
  renderOrders(PATH);
  await quantity();
  await user.click(barSubmit());
  const dialog = await screen.findByRole("dialog");
  return { user, dialog, ...kit };
}

describe("Submit order on a draft's form", () => {
  it("offers Submit order to a role that may edit and not to a reader", async () => {
    fakeServer();
    const first = renderOrders(PATH, "SUPPORT");
    await quantity();
    expect(barSubmit()).toBeVisible();
    first.unmount();
    fakeServer();
    const second = renderOrders(PATH, "PRODUCT_MANAGER");
    await quantity();
    expect(barSubmit()).toBeVisible();
    second.unmount();
    fakeServer();
    renderOrders(PATH, "FINANCE");
    await screen.findByText("Your role may read orders but not change them.");
    expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
  });

  it("offers it on no new order", async () => {
    fakeServer();
    renderOrders("/orders/new");
    await screen.findByRole("button", { name: /^Save$/ });
    expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
  });

  it("makes Save the primary while the form is dirty and Submit the primary once it is saved", async () => {
    const user = userEvent.setup();
    const { api, requests } = fakeServer();
    renderOrders(PATH);
    const box = await quantity();
    // A clean saved draft has nothing to save, so Submit is the one to press.
    expect(isPrimary(barSubmit())).toBe(true);
    expect(isPrimary(barSave())).toBe(false);
    await user.clear(box);
    await user.type(box, "3");
    expect(isPrimary(barSave())).toBe(true);
    expect(isPrimary(barSubmit())).toBe(false);
    answerWrite("patch", PATCH, requests.patches, () => {
      api.detail = () => draftDetail({ version: 4 });
      return HttpResponse.json({ data: api.detail() });
    });
    await user.click(barSave());
    await waitFor(() => {
      expect(isPrimary(barSubmit())).toBe(true);
    });
    expect(isPrimary(barSave())).toBe(false);
  });

  it("waits with 'Save your changes first.' while the form has unsaved changes", async () => {
    const user = userEvent.setup();
    fakeServer();
    renderOrders(PATH);
    const box = await quantity();
    await user.clear(box);
    await user.type(box, "3");
    const button = barSubmit();
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(
      (await screen.findAllByText("Save your changes first.")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks first, puts focus on Keep editing, and sends the version the form holds", async () => {
    const { user, dialog, api, requests } = await openDialog();
    expect(
      within(dialog).getByRole("heading", {
        name: `Submit order ${NEW_ORDER_NO}?`,
      }),
    ).toBeVisible();
    expect(dialog).toHaveAccessibleDescription(/You cannot undo this/);
    expect(
      within(dialog).getByText(/does not approve the order, reserve stock/),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    ).toHaveFocus();
    // Asking sends nothing.
    expect(requests.submits).toEqual([]);
    answerWrite("post", SUBMIT, requests.submits, submittedAfter(api));
    await user.click(confirmIn(dialog));
    expect(
      await screen.findByText(
        "This order is submitted. Only a draft can be changed.",
      ),
    ).toBeVisible();
    expect(requests.submits).toEqual([{ version: 3 }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends nothing on Keep editing and gives focus back to Submit order", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite("post", SUBMIT, requests.submits, saved(draftDetail(), 200));
    await user.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(barSubmit()).toHaveFocus();
    });
    expect(requests.submits).toEqual([]);
  });

  it("does not send when someone else has signed in over the page, and closes the dialog", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite("post", SUBMIT, requests.submits, saved(draftDetail(), 200));
    const session = useSessionStore.getState().session;
    if (!session) throw new Error("no session");
    // Between the sign-in and the next render: the press itself must refuse.
    const first = session.user;
    session.user = { ...first, id: "00000000-0000-4000-8000-0000000000aa" };
    try {
      await user.click(confirmIn(dialog));
      expect(requests.submits).toEqual([]);
      expect(screen.getByRole("dialog")).toBeVisible();
    } finally {
      session.user = first;
    }
    // And once the page is told, the dialog goes.
    act(() => {
      useSessionStore.setState({ session: sessionFor("APPROVER") });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(requests.submits).toEqual([]);
  });

  it("shows the server's words, the trace id and keeps Submit available when the workflow refuses, saying it is still a draft", async () => {
    const { user, dialog, requests } = await openDialog();
    const words =
      "The prepayment due must be an amount above zero, or none at all.";
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(400, "VALIDATION_FAILED", null, words, "trace-refused-4"),
    );
    await user.click(confirmIn(dialog));
    const alert = await within(dialog).findByRole("alert");
    expect(
      within(alert).getByText("The order was not submitted"),
    ).toBeVisible();
    expect(within(alert).getByText(words)).toBeVisible();
    expect(within(alert).getByText("It is still a draft.")).toBeVisible();
    expect(within(alert).getByText("Trace ID: trace-refused-4")).toBeVisible();
    // Announced once, as the alert appears: focus goes to what can be done
    // next, and the button does not read the failure again as its description.
    expect(alert).not.toHaveFocus();
    expect(confirmIn(dialog)).toHaveFocus();
    expect(confirmIn(dialog)).not.toHaveAttribute("aria-describedby");
    expect(
      within(dialog).queryByRole("button", { name: "Reload the order" }),
    ).toBeNull();
    expect(requests.submits).toHaveLength(1);
  });

  it("puts Reload the order first and hides Submit order after a 409, and moves focus to it", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(
        409,
        "CONFLICT",
        null,
        `Order ${NEW_ORDER_NO} is already submitted.`,
      ),
    );
    await user.click(confirmIn(dialog));
    const alert = await within(dialog).findByRole("alert");
    expect(
      within(alert).getByText(`Order ${NEW_ORDER_NO} is already submitted.`),
    ).toBeVisible();
    // A 409 does not prove the order is still a draft, so it does not say so.
    expect(within(alert).queryByText("It is still a draft.")).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Submit order" }),
    ).toBeNull();
    const reload = within(dialog).getByRole("button", {
      name: "Reload the order",
    });
    expect(reload).toHaveFocus();
    expect(alert).not.toHaveFocus();
    expect(isPrimary(reload)).toBe(true);
  });

  it("reads the order again when Reload the order is pressed, and shows the dialog's first view with the new edit token", async () => {
    const { user, dialog, requests, api } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(
        409,
        "CONFLICT",
        null,
        "This order was changed by someone else. Reload it to see it.",
      ),
    );
    await user.click(confirmIn(dialog));
    await within(dialog).findByRole("alert");
    const before = requests.orderReads;
    api.detail = () => draftDetail({ version: 5 });
    await user.click(
      within(dialog).getByRole("button", { name: "Reload the order" }),
    );
    await waitFor(() => {
      expect(requests.orderReads).toBeGreaterThan(before);
    });
    // The page is drawn anew, and the dialog comes back at its first view.
    expect(
      await screen.findByRole("heading", {
        name: `Submit order ${NEW_ORDER_NO}?`,
      }),
    ).toBeVisible();
    const fresh = screen.getByRole("dialog");
    expect(within(fresh).queryByRole("alert")).toBeNull();
    expect(
      within(fresh).queryByRole("button", { name: "Reload the order" }),
    ).toBeNull();
    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Keep editing",
        }),
      ).toHaveFocus();
    });
    answerWrite("post", SUBMIT, requests.submits, submittedAfter(api));
    await user.click(confirmIn(screen.getByRole("dialog")));
    await screen.findByText(
      "This order is submitted. Only a draft can be changed.",
    );
    expect(requests.submits).toEqual([{ version: 3 }, { version: 5 }]);
  });

  describe("every 409 shows the server's own sentence and claims nothing about the order", () => {
    const stale =
      "This order was changed by someone else. Reload it to see it.";
    const already = `Order ${NEW_ORDER_NO} is already submitted.`;
    const nextTeam =
      "The order cannot start: synthetic refusal of the next team.";

    it.each([
      ["a stale edit token", stale],
      ["an order that someone else submitted meanwhile", already],
      ["a refusal by the next team", nextTeam],
    ])(
      "for %s: the sentence, no claim, Reload the order first",
      async (_name, words) => {
        const { user, dialog, requests } = await openDialog();
        answerWrite(
          "post",
          SUBMIT,
          requests.submits,
          refused(409, "CONFLICT", null, words),
        );
        await user.click(confirmIn(dialog));
        const alert = await within(dialog).findByRole("alert");
        expect(within(alert).getByText(words)).toBeVisible();
        expect(within(alert).queryByText("It is still a draft.")).toBeNull();
        expect(
          within(dialog).queryByRole("button", { name: "Submit order" }),
        ).toBeNull();
        expect(
          within(dialog).getByRole("button", { name: "Reload the order" }),
        ).toHaveFocus();
      },
    );

    it.each([
      ["a stale edit token", stale],
      ["a refusal by the next team", nextTeam],
    ])(
      "after %s, Reload the order brings the first view back, because the order is still a draft",
      async (_name, words) => {
        const { user, dialog, requests, api } = await openDialog();
        answerWrite(
          "post",
          SUBMIT,
          requests.submits,
          refused(409, "CONFLICT", null, words),
        );
        await user.click(confirmIn(dialog));
        await within(dialog).findByRole("alert");
        api.detail = () => draftDetail({ version: 6 });
        await user.click(
          within(dialog).getByRole("button", { name: "Reload the order" }),
        );
        expect(
          await screen.findByRole("heading", {
            name: `Submit order ${NEW_ORDER_NO}?`,
          }),
        ).toBeVisible();
        const fresh = screen.getByRole("dialog");
        expect(within(fresh).getByText(/You cannot undo this/)).toBeVisible();
        expect(confirmIn(fresh)).toBeVisible();
        expect(within(fresh).queryByRole("alert")).toBeNull();
        answerWrite("post", SUBMIT, requests.submits, submittedAfter(api));
        await user.click(confirmIn(screen.getByRole("dialog")));
        await screen.findByText(
          "This order is submitted. Only a draft can be changed.",
        );
        expect(requests.submits.at(-1)).toEqual({ version: 6 });
      },
    );

    it("after an order someone else submitted, Reload the order leaves no dialog and no Submit order", async () => {
      const { user, dialog, requests, api } = await openDialog();
      answerWrite(
        "post",
        SUBMIT,
        requests.submits,
        refused(409, "CONFLICT", null, already),
      );
      await user.click(confirmIn(dialog));
      await within(dialog).findByRole("alert");
      api.detail = () => draftDetail({ captureState: "submitted", version: 4 });
      await user.click(
        within(dialog).getByRole("button", { name: "Reload the order" }),
      );
      await screen.findByText(
        "This order is submitted. Only a draft can be changed.",
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
    });

    it("for an order that is not there (404): the sentence, and after Reload the page says so, with no dialog", async () => {
      const { user, dialog, requests } = await openDialog();
      answerWrite(
        "post",
        SUBMIT,
        requests.submits,
        refused(404, "NOT_FOUND", null, "Order not found."),
      );
      await user.click(confirmIn(dialog));
      const alert = await within(dialog).findByRole("alert");
      expect(within(alert).getByText("Order not found.")).toBeVisible();
      expect(within(alert).queryByText("It is still a draft.")).toBeNull();
      server.use(
        http.get(
          "*/api/v1/orders/:orderNo",
          refused(404, "NOT_FOUND", null, "Order not found."),
        ),
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Reload the order" }),
      );
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
    });
  });

  it("says the result is unknown after a 500 and does not say it is still a draft", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(
        500,
        "INTERNAL_ERROR",
        null,
        "Something went wrong.",
        "trace-500-2",
      ),
    );
    const before = requests.orderReads;
    await user.click(confirmIn(dialog));
    const alert = await within(dialog).findByRole("alert");
    expect(
      within(alert).getByText("We could not confirm the result"),
    ).toBeVisible();
    expect(within(alert).getByText(/may have been submitted/)).toBeVisible();
    expect(within(alert).getByText("Trace ID: trace-500-2")).toBeVisible();
    expect(within(alert).queryByText("It is still a draft.")).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Reload the order" }),
    ).toHaveFocus();
    expect(
      within(dialog).queryByRole("button", { name: "Submit order" }),
    ).toBeNull();
    // The page asks again by itself, so it swaps if the order was submitted.
    await waitFor(() => {
      expect(requests.orderReads).toBeGreaterThan(before);
    });
  });

  it("says the result is unknown when the network fails", async () => {
    const { user, dialog } = await openDialog();
    server.use(http.post(SUBMIT, () => HttpResponse.error()));
    await user.click(confirmIn(dialog));
    const alert = await within(dialog).findByRole("alert");
    expect(
      within(alert).getByText("We could not confirm the result"),
    ).toBeVisible();
    expect(within(alert).queryByText("It is still a draft.")).toBeNull();
  });

  it("closes the dialog and puts a 400's issue on its field, with the first invalid field focused", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(400, "VALIDATION_FAILED", [
        {
          path: "shipmentDate",
          message: "The shipment date cannot be before the order date.",
        },
      ]),
    );
    await user.click(confirmIn(dialog));
    expect(
      await screen.findByText(
        "The shipment date cannot be before the order date.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    // The dialog's own return of focus must not take it back from the field.
    await waitFor(() => {
      expect(screen.getByLabelText(/Shipment date/)).toHaveFocus();
    });
  });

  it("shows generic words and the trace id for a refusal with a code it does not word", async () => {
    const { user, dialog, requests } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(
        429,
        "RATE_LIMITED",
        null,
        "Wording that is not meant for a person.",
        "trace-429-1",
      ),
    );
    await user.click(confirmIn(dialog));
    const alert = await within(dialog).findByRole("alert");
    expect(within(alert).queryByText(/not meant for a person/)).toBeNull();
    expect(within(alert).getByText("Trace ID: trace-429-1")).toBeVisible();
    expect(within(alert).getByText("It is still a draft.")).toBeVisible();
    // Something is said in place of the server's words.
    expect(alert.textContent.length).toBeGreaterThan(80);
  });

  it("shows the total and prepayment, the zero-total warning and the stock warning with its more-items form", async () => {
    const { dialog } = await openDialog({
      amount: {
        field: "item.unitPrice",
        classification: "confidential",
        masked: false,
        reason: null,
        value: "0.00",
      },
      prepaymentPercent: "30.00",
      shortage: SHORT,
      shortageCount: 3,
    });
    expect(
      within(dialog).getByText("Customer C-0001, PO PO-7731, 1 line"),
    ).toBeVisible();
    expect(
      within(dialog).getByText("Total USD 0.00, prepayment 30%"),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        "The total is 0.00. Check the unit prices before you submit.",
      ),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        "Stock is short on Norvale Wireless Mouse by 1 and 2 more items.",
      ),
    ).toBeVisible();
    // The dialog says only what is true whoever takes the order afterwards.
    expect(dialog.textContent).not.toMatch(/Nobody will be asked/);
    expect(dialog.textContent).not.toMatch(/workflow/i);
  });

  it("names one short item without a count, and has no zero-total warning for a total above zero", async () => {
    const { dialog } = await openDialog({ shortage: SHORT, shortageCount: 1 });
    expect(
      within(dialog).getByText(
        "Stock is short on Norvale Wireless Mouse by 1.",
      ),
    ).toBeVisible();
    expect(within(dialog).queryByText(/The total is 0.00/)).toBeNull();
    expect(within(dialog).getByText(/Total USD 36.80/)).toBeVisible();
  });

  it("leaves the figures out for a record whose amount is masked", async () => {
    const user = userEvent.setup();
    fakeServer({
      masked: true,
      detail: () =>
        draftDetail({
          amount: {
            field: "item.unitPrice",
            classification: "restricted",
            masked: true,
            value: null,
            reason: "price",
          },
        }),
    });
    renderOrders(PATH, "SUPPORT");
    await quantity();
    await user.click(barSubmit());
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/^Total /)).toBeNull();
    expect(within(dialog).queryByText(/The total is 0.00/)).toBeNull();
    expect(within(dialog).getByText(/Customer C-0001/)).toBeVisible();
  });

  it("ends with a short toast that has no Undo", async () => {
    const { user, dialog, api, requests } = await openDialog();
    answerWrite("post", SUBMIT, requests.submits, submittedAfter(api));
    await user.click(confirmIn(dialog));
    expect(
      await screen.findByText(`Order ${NEW_ORDER_NO} submitted`),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("ignores a second press while the request is in flight, and keeps focus on the button", async () => {
    const { user, dialog, api, requests } = await openDialog();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const answer = submittedAfter(api);
    server.use(
      http.post(SUBMIT, async ({ request }) => {
        requests.submits.push(await request.json());
        await gate;
        return answer();
      }),
    );
    const confirm = confirmIn(dialog);
    await user.click(confirm);
    await user.click(confirm);
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveTextContent("Submitting");
    expect(confirm).toHaveFocus();
    // Escape does nothing while the order is on its way.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
    release();
    await screen.findByText(
      "This order is submitted. Only a draft can be changed.",
    );
    expect(requests.submits).toHaveLength(1);
  });

  it("draws no close X: Keep editing is the way out", async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    expect(within(dialog).getAllByRole("button")).toHaveLength(2);
  });

  it("left-aligns the header, and lets a long PO number or part number wrap inside the dialog", async () => {
    const po = `PO-${"A".repeat(60)}`;
    const part = "B".repeat(60);
    const { dialog } = await openDialog({
      externalDocumentNo: po,
      shortage: SHORT,
      shortageCount: 1,
      lines: draftDetail().lines.map((line) => ({
        ...line,
        description: part,
      })),
    });
    // jsdom has no layout: the classes are what makes a long word wrap.
    const header = dialog.querySelector("[data-slot='dialog-header']");
    expect(header?.className.split(" ")).toContain("text-left");
    expect(header?.className.split(" ")).not.toContain("text-center");
    const summary = within(dialog).getByText(new RegExp(po));
    expect(summary.className.split(" ")).toEqual(
      expect.arrayContaining(["min-w-0", "break-words"]),
    );
    const warning = within(dialog).getByText(new RegExp(`short on ${part}`));
    expect(warning.className.split(" ")).toEqual(
      expect.arrayContaining(["min-w-0", "break-words"]),
    );
    expect(summary.parentElement?.className.split(" ")).toContain("min-w-0");
  });

  it("moves focus to Submit order, not to the alert, after a refusal", async () => {
    const refusal = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      refusal.requests.submits,
      refused(400, "VALIDATION_FAILED", null, "Not now."),
    );
    await refusal.user.click(confirmIn(refusal.dialog));
    const alert = await within(refusal.dialog).findByRole("alert");
    expect(alert).not.toHaveFocus();
    expect(alert).not.toHaveAttribute("tabindex");
    expect(confirmIn(refusal.dialog)).toHaveFocus();
  });

  it("shows no failure to someone who signed in while the request was in flight", async () => {
    const { user, dialog, requests } = await openDialog();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(SUBMIT, async ({ request }) => {
        requests.submits.push(await request.json());
        await gate;
        return refused(
          400,
          "VALIDATION_FAILED",
          null,
          "Words for the first person.",
        )();
      }),
    );
    await user.click(confirmIn(dialog));
    expect(requests.submits).toHaveLength(1);
    const session = useSessionStore.getState().session;
    if (!session) throw new Error("no session");
    // The id changes with no render in between, as a sign-in in another tab
    // does: only a check when the request settles can catch it.
    const first = session.user;
    session.user = { ...first, id: "00000000-0000-4000-8000-0000000000bb" };
    try {
      release();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    } finally {
      session.user = first;
    }
    expect(screen.queryByText("Words for the first person.")).toBeNull();
  });

  it("is clean for axe with the dialog open", async () => {
    const { dialog } = await openDialog({ shortage: SHORT, shortageCount: 1 });
    expect(await axeViolations(dialog)).toEqual([]);
  });
});
