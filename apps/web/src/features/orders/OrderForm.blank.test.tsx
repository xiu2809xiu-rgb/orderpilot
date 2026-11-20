import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  answerWrite,
  draftDetail,
  fakeServer,
  renderOrders,
  saved,
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

type User = ReturnType<typeof userEvent.setup>;

/** A whole order typed in, with the cursor left in the last cell of line 1. */
async function fillFirstLine(user: User) {
  await user.type(
    await screen.findByRole("combobox", { name: /^Customer$/ }),
    "C-0001",
  );
  await user.click(await screen.findByRole("option", { name: /Quillon/ }));
  await user.type(
    screen.getByRole("textbox", { name: /PO number/ }),
    "PO-8801",
  );
  await user.type(
    await screen.findByRole("combobox", { name: "Item, line 1" }),
    "I-0001{Enter}",
  );
  await waitFor(() => {
    expect(
      screen.getByRole("textbox", { name: "Quantity, line 1" }),
    ).toHaveFocus();
  });
  await user.keyboard("2{Enter}");
  const price = screen.getByRole("textbox", { name: /Unit price, line 1/ });
  await user.clear(price);
  await user.type(price, "18.40");
}

describe("the blank line that Enter adds", () => {
  it("never blocks Save, and is not sent", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    renderOrders("/orders/new");
    answerWrite(
      "post",
      "*/api/v1/orders",
      server.requests.posts,
      saved(draftDetail()),
    );
    await fillFirstLine(user);
    // Enter in the last cell adds a line, as a person typing fast would.
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("combobox", { name: "Item, line 2" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => {
      expect(server.requests.posts).toHaveLength(1);
    });
    expect(server.requests.posts[0]).toMatchObject({
      lines: [expect.objectContaining({ itemNo: "I-0001" })],
    });
    expect(
      (server.requests.posts[0] as { lines: unknown[] }).lines,
    ).toHaveLength(1);
    expect(screen.queryByText(/This line has an error/)).toBeNull();
  });

  it("still shows its errors when it was touched and left incomplete", async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    renderOrders("/orders/new");
    await fillFirstLine(user);
    await user.keyboard("{Enter}");
    await user.type(
      await screen.findByRole("textbox", { name: "Quantity, line 2" }),
      "3",
    );
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(
      await screen.findByText("Choose an item from the list."),
    ).toBeVisible();
    expect(server.requests.posts).toHaveLength(0);
  });
});
