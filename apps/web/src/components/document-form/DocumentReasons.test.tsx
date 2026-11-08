import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useToastStore } from "@/components/common/toast";
import { signInAs } from "@/components/form/kitHarness";
import { printer } from "@/components/list-page/printDocument";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { renderDocument } from "./documentHarness";
import type { DocumentAction } from "./types";

beforeAll(async () => {
  await i18n.loadNamespaces([
    "document-form",
    "form",
    "list-page",
    "components",
    "common",
  ]);
});

beforeEach(() => {
  localStorage.clear();
  useToastStore.setState({ items: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const rejectWith = (run: (reason: string) => Promise<unknown>) =>
  ({
    id: "reject",
    kind: "reject",
    permission: "approvals.decide",
    reasoned: {
      title: "Reject this order?",
      confirmLabel: "Reject order",
      doneMessage: "SO-1 rejected",
      run,
    },
  }) as const satisfies DocumentAction;

async function openReject() {
  await userEvent.click(screen.getByRole("button", { name: "Reject" }));
  return screen.findByRole("dialog", { name: "Reject this order?" });
}
const reasonBox = (dialog: HTMLElement) =>
  within(dialog).getByRole("textbox", { name: /Reason/ });

describe("Reject", () => {
  it("asks for a reason, sends it, and ends with a toast", async () => {
    signInAs("APPROVER");
    const run = vi.fn().mockResolvedValue(undefined);
    renderDocument({ actions: [rejectWith(run)] });
    const dialog = await openReject();
    await userEvent.type(reasonBox(dialog), "Price is wrong");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject order" }),
    );
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith("Price is wrong");
    });
    expect(useToastStore.getState().items[0]?.message).toBe("SO-1 rejected");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("is not drawn for a role without the permission to decide", () => {
    signInAs("SUPPORT");
    renderDocument({ actions: [rejectWith(() => Promise.resolve())] });
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("runs nothing when the dialog is cancelled, even with a reason typed", async () => {
    signInAs("APPROVER");
    const run = vi.fn();
    renderDocument({ actions: [rejectWith(run)] });
    const dialog = await openReject();
    await userEvent.type(reasonBox(dialog), "Changed my mind");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(run).not.toHaveBeenCalled();
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it("keeps the dialog open and shows the server's words when sending fails", async () => {
    signInAs("APPROVER");
    const run = vi
      .fn()
      .mockRejectedValue(
        new ApiError("CONFLICT", "This order was already decided.", 409, "t-9"),
      );
    renderDocument({ actions: [rejectWith(run)] });
    const dialog = await openReject();
    await userEvent.type(reasonBox(dialog), "Price is wrong");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Reject order" }),
    );
    await waitFor(() => {
      expect(dialog).toHaveTextContent("This order was already decided.");
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(useToastStore.getState().items).toHaveLength(0);
  });
});

describe("Approve", () => {
  it("runs the screen's work when the approver presses it", async () => {
    signInAs("APPROVER");
    const run = vi.fn().mockResolvedValue(undefined);
    renderDocument({
      actions: [
        { id: "approve", kind: "approve", permission: "approvals.decide", run },
      ],
    });
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Save and new on a form with nothing to save", () => {
  it("is blocked and does not save", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn();
    renderDocument({ onSave });
    const saveNew = screen.getByRole("button", { name: "Save and new" });
    expect(saveNew).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(saveNew);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("Print when the frame cannot open", () => {
  it("ends in the failure toast and frees the next print", async () => {
    signInAs("SUPPORT");
    vi.spyOn(printer, "print").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderDocument({
      print: () => ({ title: "SO-1", fields: [{ label: "A", value: "b" }] }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Print or PDF" }));
    await waitFor(() => {
      expect(useToastStore.getState().items[0]?.kind).toBe("error");
    });
    expect(document.querySelector("iframe")).toBeNull();
  });
});
