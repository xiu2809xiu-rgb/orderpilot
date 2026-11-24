import { act, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { draftKey } from "@/lib/draft-store";
import { SessionEndedDialog } from "@/app/SessionEndedDialog";
import { UserMenu } from "@/app/shell/UserMenu";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";

// The account menu is one of the shell overlays that load after the first paint
// (ADR 0035): load them as the browser would have by the time a person clicks.
beforeAll(loadShellOverlays);

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const ELSEWHERE = <h1>{LABELS.form}</h1>;

function beforeUnloadIsHeld(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function go(
  router: { navigate: (to: string) => Promise<void> },
  to: string,
) {
  await act(async () => {
    await router.navigate(to);
  });
}

describe("leaving a form", () => {
  it("a clean form lets the route change and the tab close", async () => {
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await screen.findByRole("textbox", { name: LABELS.customerPo });
    expect(beforeUnloadIsHeld()).toBe(false);
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a dirty form asks first, and Keep editing stays", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-6",
    );
    expect(beforeUnloadIsHeld()).toBe(true);

    await go(router, "/elsewhere");
    const dialog = await screen.findByRole("dialog", {
      name: "Leave without saving?",
    });
    expect(dialog).toHaveTextContent("They stay as a draft on this device");
    expect(await axeViolations(document.body)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/");
    expect(
      screen.getByRole("textbox", { name: LABELS.customerPo }),
    ).toHaveValue("CPO-6");

    await go(router, "/elsewhere");
    await user.click(
      await screen.findByRole("button", { name: "Leave this page" }),
    );
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("a query string change on the same page passes", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-7",
    );
    await go(router, "/?tab=lines");
    expect(router.state.location.search).toBe("?tab=lines");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saving clears it, so a save that navigates is never asked", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm defaults={VALID} />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "Fragile",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(beforeUnloadIsHeld()).toBe(false);
    });
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("someone who just signed in over the form is not asked about its changes", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-8",
    );
    act(() => {
      useSessionStore.getState().setSession(sessionFor("FINANCE"));
    });
    await go(router, "/elsewhere");
    expect(router.state.location.pathname).toBe("/elsewhere");
  });

  it("opens on Keep editing, and gives focus back to the field it came from", async () => {
    const user = userEvent.setup();
    const { router } = renderInRouter(<KitForm />, ELSEWHERE);
    const field = await screen.findByRole("textbox", {
      name: LABELS.customerPo,
    });
    await user.type(field, "CPO-9");
    await go(router, "/elsewhere");
    const keep = await screen.findByRole("button", { name: "Keep editing" });
    expect(keep).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(field).toHaveFocus();

    await go(router, "/elsewhere");
    await user.click(
      await screen.findByRole("button", { name: "Keep editing" }),
    );
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
  });

  it("Discard hands focus to the first field instead of dropping it", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    localStorage.setItem(
      draftKey(id, "test.order"),
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        values: { customerPo: "CPO-R" },
      }),
    );
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: LABELS.customerPo }),
      ).toHaveFocus();
    });
  });
});

describe("signing out over a form", () => {
  function withMenu() {
    // The menu asks for the signed-in person's picture, so it needs a query client.
    return renderInRouter(
      <QueryClientProvider client={new QueryClient()}>
        <UserMenu collapsed={false} />
        <KitForm />
      </QueryClientProvider>,
      <h1>Sign in</h1>,
    );
  }

  it("asks first, and keeping the changes keeps the draft", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const user = userEvent.setup();
    withMenu();
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-10",
    );
    await waitFor(() => {
      expect(localStorage.getItem(draftKey(id, "test.order"))).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /^Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Sign out without saving?",
    });
    expect(dialog).toHaveTextContent("deletes them from this device");
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(useSessionStore.getState().status).toBe("active");
    expect(localStorage.getItem(draftKey(id, "test.order"))).not.toBeNull();
  });

  it("signs out and deletes the draft once the person says so", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ data: { ok: true } })),
    );
    const user = userEvent.setup();
    const { router } = withMenu();
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-11",
    );
    await waitFor(() => {
      expect(localStorage.getItem(draftKey(id, "test.order"))).not.toBeNull();
    });
    await user.click(screen.getByRole("button", { name: /^Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(localStorage.getItem(draftKey(id, "test.order"))).toBeNull();
    vi.unstubAllGlobals();
  });

  it("signs out at once when nothing is unsaved", async () => {
    signInAs("SUPPORT");
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ data: { ok: true } })),
    );
    const user = userEvent.setup();
    withMenu();
    await screen.findByRole("textbox", { name: LABELS.customerPo });
    await user.click(screen.getByRole("button", { name: /^Account menu/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe("anonymous");
    });
    vi.unstubAllGlobals();
  });
});

describe("a session that ends under a form", () => {
  it("gives the keyboard back its place once signed in again", async () => {
    const user = userEvent.setup();
    const session = signInAs("SUPPORT");
    renderInRouter(
      <QueryClientProvider client={new QueryClient()}>
        <SessionEndedDialog />
        <KitForm />
      </QueryClientProvider>,
    );
    const field = await screen.findByRole("textbox", {
      name: LABELS.customerPo,
    });
    await user.type(field, "CPO-12");
    act(() => {
      useSessionStore.getState().setExpired();
    });
    await screen.findByRole("dialog");
    expect(field).not.toHaveFocus();
    act(() => {
      useSessionStore.getState().setSession(session);
    });
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(field).toHaveValue("CPO-12");
  });
});
