import { act, screen, waitFor } from "@testing-library/react";
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
import { SessionEndedDialog } from "@/app/SessionEndedDialog";
import { useToastStore } from "@/components/common/toast";
import { signInAs } from "@/components/form/kitHarness";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session";
import { renderDocument } from "./documentHarness";

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

const po = () => screen.getByRole("textbox", { name: /Customer PO/ });
const noForm = () => {
  expect(screen.queryByRole("textbox", { name: /Customer PO/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
};
// The draft's storage key holds the owner's id, so it is found by its suffix.
const draftEntries = () =>
  Object.keys(localStorage).filter((key) => key.includes("test.document"));

describe("a record that is not in hand", () => {
  it("shows loading under the title, and no form", () => {
    signInAs("SUPPORT");
    renderDocument({ state: { kind: "loading" } });
    expect(
      screen.getByRole("heading", { name: "Sales order SO-1" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    noForm();
  });

  it("shows the server's words and trace id, and Retry asks again", async () => {
    signInAs("SUPPORT");
    const onRetry = vi.fn();
    renderDocument({
      state: {
        kind: "error",
        error: new ApiError(
          "INTERNAL_ERROR",
          "The server could not read this order.",
          500,
          "trace-7731",
        ),
        onRetry,
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("trace-7731");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    noForm();
  });

  it("says permission denied, with the screen's words when it has them", () => {
    signInAs("SUPPORT");
    renderDocument({
      state: { kind: "denied", description: "Orders are not open to Support." },
    });
    expect(screen.getByText("Orders are not open to Support.")).toBeVisible();
    noForm();
  });

  it("says the document was not found", () => {
    signInAs("SUPPORT");
    renderDocument({ state: { kind: "notFound" } });
    expect(screen.getByText("This document was not found")).toBeVisible();
    noForm();
  });
});

describe("Save and new", () => {
  it("resets the fields to the next document's blank values and clears the draft", async () => {
    signInAs("SUPPORT");
    const onSaved = vi.fn();
    renderDocument({
      onSave: () => Promise.resolve("saved"),
      onSaved,
      nextValues: () => ({ customerPo: "", remarks: "" }),
    });
    await userEvent.type(po(), "2");
    await waitFor(() => {
      expect(draftEntries()).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole("button", { name: "Save and new" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith("saved", true);
    });
    expect(po()).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Remarks/ })).toHaveValue("");
    expect(draftEntries()).toHaveLength(0);
  });

  it("leaves the saved values in place when the screen gives no blank ones", async () => {
    signInAs("SUPPORT");
    renderDocument({ onSave: () => Promise.resolve("saved") });
    await userEvent.type(po(), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save and new" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
    expect(po()).toHaveValue("CPO-12");
  });
});

describe("a session that ends in the middle of an edit", () => {
  const OTHER = "00000000-0000-4000-8000-0000000000aa";

  async function editThenExpire() {
    const session = signInAs("SUPPORT");
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = renderDocument({ onSave, beside: <SessionEndedDialog /> });
    await userEvent.type(po(), "5");
    await waitFor(() => {
      expect(draftEntries()).toHaveLength(1);
    });
    act(() => {
      useSessionStore.getState().setExpired();
    });
    await screen.findByRole("dialog");
    return { session, onSave, view };
  }

  it("keeps the edit and the draft, and the same person goes on and saves", async () => {
    const { session, onSave } = await editThenExpire();
    act(() => {
      useSessionStore.getState().setSession(session);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(po()).toHaveValue("CPO-15");
    expect(draftEntries()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        { customerPo: "CPO-15", remarks: "" },
        false,
      );
    });
  });

  it("restores the draft on a reopened page once the same person signs in", async () => {
    const { session, view } = await editThenExpire();
    act(() => {
      useSessionStore.getState().setSession(session);
    });
    view.unmount();
    renderDocument();
    expect(po()).toHaveValue("CPO-15");
    expect(screen.getByText(/Draft restored/)).toBeInTheDocument();
  });

  it("gives another person no action on the first person's form", async () => {
    const { session, onSave } = await editThenExpire();
    act(() => {
      useSessionStore.getState().setSession({
        ...session,
        user: { ...session.user, id: OTHER },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    noForm();
    for (const name of [
      "Save and new",
      "Submit for approval",
      "Print or PDF",
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(onSave).not.toHaveBeenCalled();
  });
});
