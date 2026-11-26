import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as ReactRouter from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { renderOrders } from "./orderTestKit";
import {
  answerConfirm,
  EXISTING,
  openPanel,
  saveRefused,
  serveRevision,
  submittedOrder,
} from "./revisionTestKit";
import { differences } from "@/features/directions/screens/order/versions/versionsTestKit";

// The route change is held back here, as a slow one would be, so what the page
// shows between the saved answer and the new page can be looked at.
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => navigate,
}));

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
  navigate.mockReset();
});

describe("the panel after a saved confirmation, before the page changes", () => {
  it("keeps the panel in its saving state, with no Save bar, until the page changes", async () => {
    const user = userEvent.setup();
    const { requests } = serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    await openPanel(user);
    answerConfirm(requests, () =>
      Response.json(
        {
          data: {
            poVersionNo: 2,
            supersedesPoVersionNo: 1,
            differences: differences(),
            order: submittedOrder({ poVersionNo: 2, version: 5 }),
          },
        },
        { status: 201 },
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm PO version 2" }),
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        `/orders/${EXISTING}?tab=versions`,
        {
          replace: true,
        },
      );
    });
    // The form was reset for the next visit, but the page is still this one.
    const saving = await screen.findByRole("button", {
      name: "Saving PO version 2",
    });
    expect(saving).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    // Nothing the person does now brings the bar back or closes the panel.
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Saving PO version 2" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(requests.confirms).toHaveLength(1);
  });

  it("keeps what was typed in the form, and drops the draft, until the page changes", async () => {
    const user = userEvent.setup();
    const { requests } = serveRevision();
    renderOrders("/orders/new");
    await saveRefused(user);
    const typed = screen.getByRole<HTMLInputElement>("textbox", {
      name: /Customer PO number/,
    }).value;
    expect(typed).not.toBe("");
    await openPanel(user);
    answerConfirm(requests, () =>
      Response.json(
        {
          data: {
            poVersionNo: 2,
            supersedesPoVersionNo: 1,
            differences: differences(),
            order: submittedOrder({ poVersionNo: 2, version: 5 }),
          },
        },
        { status: 201 },
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm PO version 2" }),
    );
    await waitFor(() => {
      expect(navigate).toHaveBeenCalled();
    });
    // A slow page leaves this one on screen: it must not show an emptied form.
    expect(
      screen.getByRole("textbox", { name: /Customer PO number/ }),
    ).toHaveValue(typed);
    // The draft is gone all the same, so the next New order starts blank.
    expect(
      Object.keys(localStorage).filter((key) => key.includes(".draft.")),
    ).toEqual([]);
  });
});
