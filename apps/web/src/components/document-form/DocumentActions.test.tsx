import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
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
import { useZodForm } from "@/components/form";
import { signInAs } from "@/components/form/kitHarness";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session";
import { z } from "zod";
import { DocumentActionBar } from "./DocumentActionBar";
import { renderDocument } from "./documentHarness";
import type { DocumentAction } from "./types";
import { useActionRunner } from "./useActionRunner";

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

const submitWith = (run: () => unknown) =>
  ({
    id: "submit",
    kind: "submit",
    permission: "orders.read",
    run,
  }) as const satisfies DocumentAction;
const approve = {
  id: "approve",
  kind: "approve",
  permission: "approvals.decide",
  run: () => 1,
} as const satisfies DocumentAction;
const save = {
  id: "save",
  kind: "save",
  permission: "orders.read",
} as const satisfies DocumentAction;
const btn = (name: string | RegExp, hidden = false) =>
  screen.getByRole("button", { name, hidden });
const po = () => screen.getByRole("textbox", { name: /Customer PO/ });

function never(): { run: () => Promise<void>; finish: () => void } {
  let finish: () => void = () => undefined;
  const run = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  return {
    run,
    finish: () => {
      finish();
    },
  };
}

describe("one action at a time", () => {
  it("runs once however often it is pressed, says it is working, then frees the bar", async () => {
    signInAs("SUPPORT");
    const pending = never();
    const run = vi.fn(pending.run);
    renderDocument({ actions: [submitWith(run), save], allowClean: true });
    await userEvent.click(btn("Submit for approval"));
    await userEvent.click(btn("Submit for approval"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(btn("Submit for approval")).toHaveAccessibleDescription(
      "Another action is running.",
    );
    // Save waits too, so a save cannot overlap a submit.
    expect(btn("Save")).toHaveAccessibleDescription(
      "Another action is running.",
    );
    await act(async () => {
      pending.finish();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(btn("Submit for approval")).not.toHaveAttribute("aria-disabled");
    });
    expect(btn("Save")).not.toHaveAttribute("aria-disabled");
  });

  it("refuses a second run even before the bar is drawn again", () => {
    signInAs("SUPPORT");
    const pending = never();
    const run = vi.fn(pending.run);
    const { result } = renderHook(() => useActionRunner());
    const action = submitWith(run);
    act(() => {
      result.current.run(action);
      result.current.run(action);
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("makes every other action wait while a reasoned confirm is in flight", async () => {
    signInAs("SUPPORT");
    const pending = never();
    const voidRun = vi.fn(pending.run);
    renderDocument({
      actions: [
        submitWith(() => 1),
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
    await userEvent.click(btn("Void"));
    await userEvent.type(
      await screen.findByRole("textbox", { name: /Reason/ }),
      "Customer withdrew",
    );
    await userEvent.click(btn("Void order"));
    await waitFor(() => {
      expect(voidRun).toHaveBeenCalled();
    });
    // The dialog is modal, so the bar behind it is hidden from the tree.
    expect(btn("Submit for approval", true)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await act(async () => {
      pending.finish();
      await Promise.resolve();
    });
  });
});

describe("the one primary button", () => {
  it("is the action that can run now, not a blocked Save", async () => {
    signInAs("APPROVER");
    renderDocument({ actions: [save, approve] });
    expect(btn("Save")).toHaveAttribute("aria-disabled", "true");
    expect(btn("Approve")).toHaveAttribute("data-variant", "default");
    expect(btn("Save")).toHaveAttribute("data-variant", "outline");
    await userEvent.type(po(), "2");
    expect(btn("Save")).toHaveAttribute("data-variant", "default");
    expect(btn("Approve")).toHaveAttribute("data-variant", "outline");
  });

  it("falls back to the first usable one when none can run", () => {
    signInAs("APPROVER");
    renderDocument({
      actions: [save, { ...approve, blocked: "Not yet." }],
    });
    expect(btn("Save")).toHaveAttribute("data-variant", "default");
  });
});

describe("Ctrl+S", () => {
  it("does nothing when the form declares no Save", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDocument({ onSave, actions: [submitWith(() => 1)] });
    await userEvent.type(po(), "2");
    await userEvent.keyboard("{Control>}s{/Control}");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does nothing when the role lacks Save's permission", async () => {
    signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDocument({
      onSave,
      actions: [{ ...save, permission: "approvals.decide" }],
    });
    await userEvent.type(po(), "2");
    await userEvent.keyboard("{Control>}s{/Control}");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("someone else signed in", () => {
  function switchViewer(): void {
    const { session } = useSessionStore.getState();
    if (!session) throw new Error("no session");
    useSessionStore.setState({
      session: {
        ...session,
        user: { ...session.user, id: "00000000-0000-4000-8000-0000000000aa" },
      },
    });
  }

  // The shell already swaps the fields and the bar for a notice. The bar
  // still blocks on its own, so a later change of the shell cannot let an
  // action through; it is drawn here without the shell to see that.
  function BareBar({ run }: { run: () => void }) {
    const form = useZodForm<{ a: string }>({
      schema: z.object({ a: z.string() }),
      defaultValues: { a: "" },
    });
    return (
      <DocumentActionBar
        form={form}
        actions={[
          save,
          submitWith(run),
          { ...approve, run },
          { id: "print", kind: "print", permission: "orders.read" },
        ]}
        save={() => Promise.resolve()}
        saveNew={() => Promise.resolve()}
        onPrint={() => undefined}
        target={{ formId: "bare", label: "SO-1" }}
        saveBlocked={undefined}
        allowClean
      />
    );
  }

  it("blocks every action of the bar, Print included, with the reason", async () => {
    signInAs("APPROVER");
    const run = vi.fn();
    render(<BareBar run={run} />);
    act(switchViewer);
    for (const name of [
      "Save",
      "Submit for approval",
      "Approve",
      "Print or PDF",
    ]) {
      expect(btn(name)).toHaveAccessibleDescription(
        "Someone else signed in. Reopen this document to act on it.",
      );
    }
    await userEvent.click(btn("Approve"));
    expect(run).not.toHaveBeenCalled();
  });

  it("leaves the shell's notice and no action on the page", () => {
    signInAs("APPROVER");
    renderDocument({ actions: [save, approve] });
    act(switchViewer);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("is checked again at the click, not only when the bar was drawn", () => {
    signInAs("SUPPORT");
    const run = vi.fn();
    const { result } = renderHook(() => useActionRunner());
    act(switchViewer);
    act(() => {
      result.current.run(submitWith(run));
    });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("a failure", () => {
  it("shows the server's words and the trace id", async () => {
    signInAs("SUPPORT");
    const refusal = new ApiError(
      "CONFLICT",
      "This order is already approved.",
      409,
      "trace-doc-409",
      [],
    );
    renderDocument({
      actions: [submitWith(() => Promise.reject(refusal))],
    });
    await userEvent.click(btn("Submit for approval"));
    await waitFor(() => {
      expect(useToastStore.getState().items).toHaveLength(1);
    });
    const [item] = useToastStore.getState().items;
    expect(item?.kind).toBe("error");
    expect(item?.message).toBe("This order is already approved.");
    expect(item?.description).toBe("Trace ID: trace-doc-409");
  });

  it("is told when the screen's own follow-up after a save fails", async () => {
    signInAs("SUPPORT");
    renderDocument({
      onSave: () => Promise.resolve("saved"),
      onSaved: () => Promise.reject(new Error("navigation failed")),
    });
    await userEvent.type(po(), "2");
    await userEvent.click(btn("Save"));
    await waitFor(() => {
      expect(useToastStore.getState().items[0]?.kind).toBe("error");
    });
  });
});

describe("declaring actions", () => {
  it("warns in development when two actions share a kind", () => {
    signInAs("SUPPORT");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderDocument({
      actions: [save, { ...save, id: "save-again" }],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('two "save"'));
  });
});
