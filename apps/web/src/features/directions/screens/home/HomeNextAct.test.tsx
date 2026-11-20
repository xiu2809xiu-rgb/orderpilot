import type { Role, WorkflowTask } from "@orderpilot/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { useSessionStore } from "@/stores/session";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";

/**
 * A one-click row says what it records, and what follows it says who has the
 * order next. Each case is one kind of task, as the role that holds it sees it.
 */
beforeAll(async () => {
  await loadHomeNamespaces();
});

beforeEach(() => {
  useSessionStore.setState({ status: "anonymous", session: null });
  useToastStore.setState({ items: [] });
});

interface Case {
  role: Role;
  task: WorkflowTask;
  button: string;
  message: string;
  next: string | undefined;
  records: string;
}

const NOTHING = "Records that this is done. OrderPilot sends nothing.";
const CASES: Case[] = [
  {
    role: "PRODUCT_MANAGER",
    task: makeTask({
      kind: "RAISE_SPR",
      assigneeRole: "PRODUCT_MANAGER",
      orderNo: "SO-0082",
      ref: { recordNo: "SPR-20261115-0006", navisionNo: null },
    }),
    button: "Raise",
    message: "Raised the SPR for SO-0082",
    next: "It goes to the management approvers.",
    records: "Raises the SPR for approval. OrderPilot buys nothing.",
  },
  {
    role: "SUPPORT",
    task: makeTask({
      kind: "SEND_PI",
      assigneeRole: "SUPPORT",
      orderNo: "SO-0084",
    }),
    button: "Mark PI as sent",
    message: "Marked the PI for SO-0084 as sent",
    next: "Finance confirms the payment next.",
    records: NOTHING,
  },
  {
    role: "FINANCE",
    task: makeTask({
      kind: "CONFIRM_PAYMENT",
      assigneeRole: "FINANCE",
      orderNo: "SO-0086",
      expectedPayment: {
        paymentType: "prepayment",
        amount: "100.00",
        currencyCode: "USD",
      },
    }),
    button: "Confirm",
    message: "Confirmed the payment for SO-0086",
    next: "The warehouse packs next.",
    records: "Records that the payment arrived. OrderPilot moves no money.",
  },
  {
    role: "WAREHOUSE",
    task: makeTask({ kind: "PACK_ORDER", orderNo: "SO-0088" }),
    button: "Mark as packed",
    message: "Marked SO-0088 as packed",
    next: "Support makes the invoice and packing list next.",
    records: NOTHING,
  },
  {
    role: "WAREHOUSE",
    task: makeTask({ kind: "RECOUNT_CARTONS", orderNo: "SO-0090" }),
    button: "Mark as counted",
    message: "Marked the cartons for SO-0090 as counted",
    // A step the nine do not place keeps today's words: no claim about who is next.
    next: undefined,
    records: NOTHING,
  },
  {
    role: "LOGISTICS",
    task: makeTask({
      kind: "ADD_SHIPPING_DOCUMENTS",
      assigneeRole: "LOGISTICS",
      orderNo: "SO-0092",
    }),
    button: "Mark documents as added",
    message: "Marked the documents for SO-0092 as added",
    next: "That was the order's last step.",
    records: NOTHING,
  },
];

describe.each(CASES)("the $task.kind row", (row) => {
  const { task } = row;
  const order = task.orderNo ?? "";

  it("says what it records, and describes what it does not do", async () => {
    serveHome({ tasks: [task] });
    renderHome(row.role);
    const button = await screen.findByRole("button", {
      name: `${row.button} for ${order}`,
    });
    expect(button).toHaveAccessibleDescription(row.records);
    // The tour finds the row by these four, so they stay exactly as they were.
    expect(button).toHaveAttribute("data-task-action");
    expect(button).toHaveAttribute("data-task-kind", task.kind);
    expect(button).toHaveAttribute("data-task-id", task.id);
    expect(button).toHaveAttribute("data-order", order);
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("names the order and who has it next, with Undo, and notes it in Done today", async () => {
    const user = userEvent.setup();
    const served = serveHome({ tasks: [task] });
    renderHome(row.role);
    await user.click(
      await screen.findByRole("button", {
        name: `${row.button} for ${order}`,
      }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items).toHaveLength(1);
    });
    const toast = useToastStore.getState().items[0];
    expect(toast?.message).toBe(row.message);
    expect(toast?.description).toBe(row.next);
    expect(toast?.undo).toBeTypeOf("function");
    expect(toast?.action).toEqual({
      label: "Open order",
      to: `/orders/${order}`,
    });
    expect(served.calls.some((call) => call.startsWith("POST "))).toBe(true);

    // The toast offers the order beside Undo, drawn by the shell's toaster.
    const open = await screen.findByRole("link", { name: "Open order" });
    expect(open).toHaveAttribute("href", `/orders/${order}`);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    // Done today says what was done, for which order, and when; and opens the order.
    // The words are fixed text and only the time varies, so the pattern stays a
    // literal: the static scan refuses one built from a string.
    const lead = `${row.message} at `;
    const link = await screen.findByRole("link", {
      name: (name) =>
        name.startsWith(lead) && /^\d\d:\d\d$/.test(name.slice(lead.length)),
    });
    expect(link).toHaveAttribute("href", `/orders/${order}`);
  });
});

describe("the row of the Product manager", () => {
  const raise = makeTask({
    kind: "RAISE_SPR",
    assigneeRole: "PRODUCT_MANAGER",
    orderNo: "SO-0083",
    ref: { recordNo: "SPR-20261115-0007", navisionNo: null },
    spr: {
      itemNo: "I-0100",
      itemDescription: "Samsung SSD 1 TB NVMe",
      quantity: "707.00",
      monthsOfCover: null,
    },
  });

  it("is titled by what must be done and for which order, with the SPR as detail", async () => {
    serveHome({ tasks: [raise] });
    renderHome("PRODUCT_MANAGER");
    // The SPR of the title is a term, so the sentence is in more than one element.
    const title = await screen.findByText("SPR", { selector: "abbr" });
    const row = title.closest("[role='listitem']");
    if (!(row instanceof HTMLElement)) throw new Error("No row");
    expect(
      within(row).getByText("707 short: Samsung SSD 1 TB NVMe"),
    ).toBeVisible();
    expect(
      within(row).getByRole("link", { name: "SPR-20261115-0007" }),
    ).toHaveAttribute("href", "/workflows/sprs/SPR-20261115-0007");
    // The button carries an icon that is not the tick of "done".
    const button = within(row).getByRole("button", {
      name: "Raise for SO-0083",
    });
    expect(button.querySelector("svg")?.getAttribute("class")).toContain(
      "clipboard-plus",
    );
  });

  it("says only what the task carries", async () => {
    serveHome({ tasks: [{ ...raise, spr: undefined }] });
    renderHome("PRODUCT_MANAGER");
    // The SPR of the title is a term, so the sentence is in more than one element.
    const title = await screen.findByText("SPR", { selector: "abbr" });
    const row = title.closest("[role='listitem']");
    if (!(row instanceof HTMLElement)) throw new Error("No row");
    expect(within(row).queryByText(/short:/)).toBeNull();
    expect(
      within(row).getByRole("link", { name: "SPR-20261115-0007" }),
    ).toBeVisible();
  });
});
