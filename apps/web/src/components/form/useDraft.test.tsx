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
import i18n from "@/i18n";
import { logout } from "@/lib/api/auth";
import { DRAFT_MAX_AGE_MS, draftKey } from "@/lib/draft-store";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { fitsShape, omitPaths } from "./draftValues";
import {
  kitDefaults,
  KitForm,
  LABELS,
  renderInRouter,
  signInAs,
  VALID,
} from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const KEY = "test.order";
const box = (name: string) => screen.getByRole("textbox", { name });

function stored(viewerId: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(draftKey(viewerId, KEY));
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

function plant(viewerId: string, draft: unknown) {
  localStorage.setItem(draftKey(viewerId, KEY), JSON.stringify(draft));
}

async function typeAndWaitForDraft(
  viewerId: string,
  name: string,
  text: string,
) {
  const user = userEvent.setup();
  await user.type(await screen.findByRole("textbox", { name }), text);
  await waitFor(() => {
    expect(stored(viewerId)).not.toBeNull();
  });
  return user;
}

describe("drafts", () => {
  it("come back after a remount, with a notice and a way out", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const first = renderInRouter(<KitForm />);
    await typeAndWaitForDraft(id, LABELS.customerPo, "CPO-1");
    first.unmount();

    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    expect(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("CPO-1");
    expect(screen.getByText(/Draft restored./)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(box(LABELS.customerPo)).toHaveValue("");
    expect(stored(id)).toBeNull();
    expect(screen.queryByText("Draft restored.")).toBeNull();
  });

  it("carry a version and a time, and never a field marked to leave out", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const first = renderInRouter(<KitForm />);
    const user = await typeAndWaitForDraft(id, LABELS.customerPo, "CPO-2");
    await user.type(box(LABELS.creditLimit), "250000.00");
    await waitFor(() => {
      expect(stored(id)).toMatchObject({ values: { customerPo: "CPO-2" } });
    });
    const draft = stored(id);
    expect(draft?.version).toBe(1);
    expect(typeof draft?.savedAt).toBe("string");
    expect(JSON.stringify(draft)).not.toContain("250000");
    expect(draft?.values).not.toHaveProperty("creditLimit");
    first.unmount();

    renderInRouter(<KitForm />);
    expect(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("CPO-2");
    expect(box(LABELS.creditLimit)).toHaveValue("");
  });

  it("are kept per viewer: another person never sees them", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const first = renderInRouter(<KitForm />);
    await typeAndWaitForDraft(id, LABELS.customerPo, "CPO-3");
    first.unmount();

    const other = signInAs("FINANCE");
    renderInRouter(<KitForm />);
    expect(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("");
    expect(screen.queryByText("Draft restored.")).toBeNull();
    expect(stored(other.user.id)).toBeNull();
    expect(stored(id)).not.toBeNull();
  });

  it("are dropped when stale, broken, of another shape or another version", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const old = new Date(Date.now() - DRAFT_MAX_AGE_MS - 60_000).toISOString();
    const cases: unknown[] = [
      { version: 1, savedAt: old, values: { customerPo: "STALE" } },
      {
        version: 2,
        savedAt: new Date().toISOString(),
        values: { customerPo: "NEWER" },
      },
      {
        version: 1,
        savedAt: new Date().toISOString(),
        values: { customerPo: 7 },
      },
      {
        version: 1,
        savedAt: new Date().toISOString(),
        values: { gone: "field" },
      },
      { values: { customerPo: "NO-VERSION" } },
    ];
    for (const draft of cases) {
      plant(id, draft);
      const view = renderInRouter(<KitForm />);
      expect(
        await screen.findByRole("textbox", { name: LABELS.customerPo }),
      ).toHaveValue("");
      expect(stored(id)).toBeNull();
      view.unmount();
    }
    localStorage.setItem(draftKey(id, KEY), "{not json");
    renderInRouter(<KitForm />);
    expect(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("");
    expect(stored(id)).toBeNull();
  });

  it("keep a prototype key in storage away from the form", () => {
    const planted: unknown = JSON.parse('{"__proto__": {"polluted": true}}');
    expect(fitsShape(kitDefaults(), planted)).toBe(false);
    expect(
      omitPaths({ lines: [{ price: "1", qty: "2" }] }, ["lines.*.price"]),
    ).toEqual({
      lines: [{ qty: "2" }],
    });
  });

  it("go on save, and the saved values become the clean state", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<KitForm defaults={VALID} onSave={onSave} />);
    const user = await typeAndWaitForDraft(id, LABELS.remarks, "Fragile");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(stored(id)).toBeNull();
    });
    expect(box(LABELS.remarks)).toHaveValue("Fragile");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("stay when the session expires, and go on an explicit sign-out", async () => {
    const support = signInAs("SUPPORT");
    plant(sessionFor("FINANCE").user.id, {
      version: 1,
      savedAt: new Date().toISOString(),
      values: { customerPo: "THEIRS" },
    });
    renderInRouter(<KitForm />);
    await typeAndWaitForDraft(support.user.id, LABELS.customerPo, "CPO-4");

    act(() => {
      useSessionStore.getState().setExpired();
    });
    expect(box(LABELS.customerPo)).toHaveValue("CPO-4");
    expect(stored(support.user.id)).not.toBeNull();

    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    await act(async () => {
      await logout().catch(() => undefined);
    });
    expect(stored(support.user.id)).toBeNull();
    expect(stored(sessionFor("FINANCE").user.id)).not.toBeNull();
  });

  it("are safe when someone else signs in over a mounted form", async () => {
    const support = signInAs("SUPPORT");
    const onSave = vi.fn(() => Promise.resolve());
    // Valid values, so only the change of person can stop a save.
    renderInRouter(<KitForm defaults={VALID} onSave={onSave} />);
    const user = await typeAndWaitForDraft(
      support.user.id,
      LABELS.remarks,
      "Fragile",
    );

    // The new person has a draft of their own for this record, which would
    // make the form dirty again under them.
    const finance = sessionFor("FINANCE");
    plant(finance.user.id, {
      version: 1,
      savedAt: new Date().toISOString(),
      values: { remarks: "Theirs" },
    });
    act(() => {
      useSessionStore.getState().setSession(finance);
    });
    expect(screen.queryByRole("textbox", { name: LABELS.remarks })).toBeNull();
    expect(screen.queryByDisplayValue("Fragile")).toBeNull();
    expect(screen.queryByDisplayValue("CPO-7731")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This form was opened by someone else",
    );
    // Save goes with the fields, and the shortcut sends nothing.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await user.keyboard("{Control>}s{/Control}");
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(onSave).not.toHaveBeenCalled();
    expect(stored(support.user.id)).toMatchObject({
      values: { remarks: "Fragile" },
    });
    expect(stored(finance.user.id)).toMatchObject({
      values: { remarks: "Theirs" },
    });
  });
});
