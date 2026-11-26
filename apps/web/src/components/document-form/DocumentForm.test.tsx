import { act, screen, waitFor, within } from "@testing-library/react";
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
import { axeViolations } from "@/test/axe";
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

const button = (name: string | RegExp) =>
  screen.queryByRole("button", { name });
const po = () => screen.getByRole("textbox", { name: /Customer PO/ });

describe("the action bar", () => {
  it("draws only what is declared and the role may use", () => {
    signInAs("SUPPORT");
    renderDocument();
    expect(button("Save")).toBeVisible();
    expect(button("Save and new")).toBeVisible();
    expect(button("Submit for approval")).toBeVisible();
    // Approve is declared, but Support does not hold the permission to decide.
    expect(button("Approve")).toBeNull();
    // Void and Reject are not declared at all.
    expect(button("Void")).toBeNull();
    expect(button("Reject")).toBeNull();
  });

  it("draws Approve for the approver, and makes it the one primary button", () => {
    signInAs("APPROVER");
    renderDocument({
      actions: [
        {
          id: "approve",
          kind: "approve",
          permission: "approvals.decide",
          run: () => 1,
        },
        {
          id: "submit",
          kind: "submit",
          permission: "approvals.decide",
          run: () => 1,
        },
      ],
    });
    expect(button("Approve")).toHaveAttribute("data-variant", "default");
    expect(button("Submit for approval")).toHaveAttribute(
      "data-variant",
      "outline",
    );
  });

  it("gives a blocked action's reason and does not run it", async () => {
    signInAs("SUPPORT");
    const run = vi.fn();
    const blocked: DocumentAction = {
      id: "submit",
      kind: "submit",
      permission: "orders.read",
      blocked: "Only a draft can be submitted.",
      run,
    };
    renderDocument({ actions: [blocked] });
    const submit = screen.getByRole("button", { name: "Submit for approval" });
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription(
      "Only a draft can be submitted.",
    );
    await userEvent.click(submit);
    expect(run).not.toHaveBeenCalled();
    // A tooltip does not open on a tap, so the reason is also plain text.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Only a draft can be submitted.",
    );
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it("drops the reason line once the action can run", async () => {
    signInAs("SUPPORT");
    renderDocument({
      actions: [
        { id: "save", kind: "save", permission: "orders.read" },
        {
          id: "submit",
          kind: "submit",
          permission: "orders.read",
          run: () => 1,
        },
      ],
    });
    await userEvent.type(po(), "2");
    await userEvent.click(
      screen.getByRole("button", { name: "Submit for approval" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Save your changes first.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  it("does not bring an old reason line back when the action is blocked again", async () => {
    signInAs("SUPPORT");
    renderDocument({
      actions: [
        { id: "save", kind: "save", permission: "orders.read" },
        {
          id: "submit",
          kind: "submit",
          permission: "orders.read",
          run: () => 1,
        },
      ],
    });
    await userEvent.type(po(), "2");
    await userEvent.click(
      screen.getByRole("button", { name: "Submit for approval" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Save your changes");
    // The shortcut, not a button, saves: pressing a button would clear the line itself.
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
    await userEvent.type(po(), "3");
    expect(
      screen.getByRole("button", { name: "Submit for approval" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("draws no bar at all when the form declares no action", () => {
    signInAs("SUPPORT");
    const { container } = renderDocument({ actions: [] });
    expect(
      screen.queryByRole("group", { name: "Document actions" }),
    ).toBeNull();
    expect(container.querySelector(".df-bar")).toBeNull();
    // The rest of the form is still there.
    expect(screen.getByRole("region", { name: "Header" })).toBeVisible();
  });

  it("draws the screen's notices between the bar and the header", () => {
    signInAs("SUPPORT");
    renderDocument({ notices: <p>Payment on hold</p> });
    const notice = screen.getByText("Payment on hold");
    const bar = screen.getByRole("group", { name: "Document actions" });
    const header = screen.getByRole("region", { name: "Header" });
    expect(
      bar.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notice.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    signInAs("SUPPORT");
    const { container } = renderDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Save and Save and new", () => {
  it("says why there is nothing to save, then saves the checked values", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDocument({ onSave });
    expect(button("Save")).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(po(), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        { customerPo: "CPO-12", remarks: "" },
        false,
      );
    });
  });

  it("Save and new tells the screen to start the next document", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue("saved");
    const onSaved = vi.fn();
    renderDocument({ onSave, onSaved });
    await userEvent.type(po(), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save and new" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith("saved", true);
    });
    expect(onSave.mock.calls[0]?.[1]).toBe(true);
  });

  it("saves an unchanged form when the screen allows it", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDocument({ onSave, allowClean: true });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it("saves on Ctrl+S", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDocument({ onSave });
    await userEvent.type(po(), "2");
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it("checks fields before it sends anything", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn();
    renderDocument({ onSave, defaults: { customerPo: "" }, allowClean: true });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter the customer's PO number."),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("puts the server's own words on the field", async () => {
    signInAs("SUPPORT");
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          "VALIDATION_FAILED",
          "The request is not valid.",
          400,
          "trace-doc-1",
          [{ path: "customerPo", message: "PO CPO-12 is on another order." }],
        ),
      );
    renderDocument({ onSave });
    await userEvent.type(po(), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("PO CPO-12 is on another order."),
    ).toBeVisible();
  });

  it("blocks Save with the screen's reason", () => {
    signInAs("SUPPORT");
    renderDocument({ saveBlocked: "This order is locked." });
    expect(button("Save")).toHaveAccessibleDescription("This order is locked.");
  });
});

describe("actions on what is saved", () => {
  const submit = {
    id: "submit",
    kind: "submit",
    permission: "orders.read",
  } as const;

  it("waits for a save while the form has changes", async () => {
    signInAs("SUPPORT");
    const run = vi.fn();
    renderDocument({ actions: [{ ...submit, run }] });
    expect(button("Submit for approval")).not.toHaveAttribute("aria-disabled");
    await userEvent.type(po(), "2");
    const waiting = screen.getByRole("button", { name: "Submit for approval" });
    expect(waiting).toHaveAccessibleDescription("Save your changes first.");
    await userEvent.click(waiting);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs once, and tells the person when it fails", async () => {
    signInAs("SUPPORT");
    const failing = vi.fn().mockRejectedValue(new Error("no"));
    renderDocument({ actions: [{ ...submit, run: failing }] });
    await userEvent.click(
      screen.getByRole("button", { name: "Submit for approval" }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items[0]?.kind).toBe("error");
    });
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("Void asks for a reason, then sends it", async () => {
    signInAs("SUPPORT");
    const voidRun = vi.fn().mockResolvedValue(undefined);
    renderDocument({
      actions: [
        {
          id: "void",
          kind: "void",
          permission: "orders.read",
          reasoned: {
            title: "Void this order?",
            confirmLabel: "Void order",
            doneMessage: "SO-1 voided",
            run: voidRun,
          },
        },
      ],
    });
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Void this order?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Void order" }),
    );
    expect(voidRun).not.toHaveBeenCalled();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /Reason/ }),
      "Customer withdrew",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Void order" }),
    );
    await waitFor(() => {
      expect(voidRun).toHaveBeenCalledWith("Customer withdrew");
    });
    expect(useToastStore.getState().items[0]?.message).toBe("SO-1 voided");
  });

  it("moves focus into the reason dialog and back to the trigger on cancel", async () => {
    signInAs("SUPPORT");
    const voidRun = vi.fn();
    renderDocument({
      actions: [
        {
          id: "void",
          kind: "void",
          permission: "orders.read",
          reasoned: {
            title: "Void this order?",
            confirmLabel: "Void order",
            doneMessage: "SO-1 voided",
            run: voidRun,
          },
        },
      ],
    });
    const trigger = screen.getByRole("button", { name: "Void" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Void this order?",
    });
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(voidRun).not.toHaveBeenCalled();
  });
});

describe("unsaved changes", () => {
  it("survive leaving the page, and the restored draft says so", async () => {
    signInAs("SUPPORT");
    const first = renderDocument();
    await userEvent.type(po(), "9");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    first.unmount();
    renderDocument();
    expect(po()).toHaveValue("CPO-19");
    expect(screen.getByText(/Draft restored/)).toBeInTheDocument();
  });
});

describe("Print or PDF", () => {
  it("writes the document into a print frame of its own and opens the print dialog", async () => {
    signInAs("SUPPORT");
    let printed = "";
    vi.spyOn(printer, "print").mockImplementation((frame) => {
      printed = frame.document.body.textContent;
      frame.dispatchEvent(new Event("afterprint"));
    });
    renderDocument({
      print: () => ({
        title: "Sales order SO-1",
        fields: [{ label: "Customer PO", value: "CPO-1" }],
        lines: { columns: ["Item", "Qty"], rows: [["I-0001", "3"]] },
        totals: [{ label: "Total", value: "USD 59.97" }],
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Print or PDF" }));
    await waitFor(() => {
      expect(printed).toContain("Sales order SO-1");
    });
    expect(printed).toContain("Synthetic demo data");
    expect(printed).toContain("I-0001");
    expect(printed).toContain("USD 59.97");
    await waitFor(() => {
      expect(document.querySelector("iframe")).toBeNull();
    });
  });

  it("prints the status, one translated note and the page language", async () => {
    signInAs("SUPPORT");
    let printed = "";
    let lang = "";
    vi.spyOn(printer, "print").mockImplementation((frame) => {
      printed = frame.document.body.textContent;
      lang = frame.document.documentElement.lang;
      frame.dispatchEvent(new Event("afterprint"));
    });
    renderDocument({
      print: () => ({
        title: "Sales order SO-1",
        fields: [{ label: "Customer PO", value: "CPO-1" }],
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "Print or PDF" }));
    await waitFor(() => {
      expect(printed).toContain("Sales order SO-1");
    });
    expect(printed).toContain("StatusWaiting for approval");
    expect(printed).toMatch(/Synthetic demo data - Printed /);
    expect(lang).toBe(i18n.language);
  });

  it("waits while the form has unsaved changes", async () => {
    signInAs("SUPPORT");
    const spy = vi.spyOn(printer, "print");
    renderDocument({
      print: () => ({ title: "Sales order SO-1", fields: [] }),
    });
    await userEvent.type(po(), "9");
    await userEvent.click(screen.getByRole("button", { name: "Print or PDF" }));
    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Print or PDF" }),
    ).toHaveAccessibleDescription(/Save your changes first/);
  });

  it("ends in the failure toast when the screen's builder throws", async () => {
    signInAs("SUPPORT");
    const spy = vi.spyOn(printer, "print");
    renderDocument({
      print: () => {
        throw new Error("record not loaded");
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Print or PDF" }));
    await waitFor(() => {
      expect(useToastStore.getState().items[0]?.kind).toBe("error");
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("opens one frame, however many times Print is pressed", async () => {
    signInAs("SUPPORT");
    const spy = vi.spyOn(printer, "print").mockImplementation(() => undefined);
    renderDocument({
      print: () => ({ title: "Sales order SO-1", fields: [] }),
    });
    const print = screen.getByRole("button", { name: "Print or PDF" });
    await userEvent.click(print);
    await userEvent.click(print);
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    // Closing the dialog frees the next print.
    const frame = document.querySelector("iframe")?.contentWindow;
    frame?.dispatchEvent(new Event("afterprint"));
    await waitFor(() => {
      expect(document.querySelector("iframe")).toBeNull();
    });
  });

  it("is not drawn when the form has nothing to print", () => {
    signInAs("SUPPORT");
    renderDocument();
    expect(button("Print or PDF")).toBeNull();
  });
});
